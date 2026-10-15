'use strict';

const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// ---------- Config (all from environment, no hardcoded IDs) ----------
const GRAPH = 'https://graph.facebook.com/v21.0';
const PORT = process.env.PORT || 3000;

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || '';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'inbound-media';

const AUTO_REPLY = process.env.AUTO_REPLY === 'true';

const MAX_MEDIA_BYTES = 40 * 1024 * 1024; // refuse anything bigger (RAM safety)
const INLINE_LIMIT_BYTES = 10 * 1024 * 1024; // above this, use Gemini Files API

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---------- Helpers ----------
const maskPhone = (p) => (p ? `***${String(p).slice(-4)}` : 'unknown');
const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();
const safeKey = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

const EXT = {
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
};

const ITEMS = [
  'Foundation',
  'Steel Frame - Bottom',
  'Steel Frame - Top',
  'Lower Mesh',
  'Upper Mesh',
  'Glass',
  'Silicone',
  'Turf',
  'Sand',
  'Net Posts',
  'Net',
  'Site Cleanliness & Final Walkthrough',
];

// ---------- Signature verification (Meta X-Hub-Signature-256) ----------
function validSignature(req) {
  if (!META_APP_SECRET) return false;
  const header = req.get('x-hub-signature-256') || '';
  if (!header.startsWith('sha256=') || !req.rawBody) return false;
  const expected = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');
  const got = header.slice('sha256='.length);
  const a = Buffer.from(got, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Supabase private storage ----------
const sbHeaders = () => ({
  Authorization: `Bearer ${SUPABASE_KEY}`,
  apikey: SUPABASE_KEY,
});

async function ensurePrivateBucket() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
    return false;
  }
  try {
    let bucket = null;
    try {
      const r = await axios.get(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, { headers: sbHeaders() });
      bucket = r.data;
    } catch (e) {
      if (e.response && (e.response.status === 404 || e.response.status === 400)) bucket = null;
      else throw e;
    }
    if (!bucket) {
      await axios.post(
        `${SUPABASE_URL}/storage/v1/bucket`,
        { id: BUCKET, name: BUCKET, public: false },
        { headers: sbHeaders() }
      );
      console.log(`[Storage] created private bucket "${BUCKET}"`);
    } else if (bucket.public) {
      await axios.put(
        `${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`,
        { public: false },
        { headers: sbHeaders() }
      );
      console.log(`[Storage] bucket "${BUCKET}" set to private`);
    }
    console.log(`[Storage] bucket "${BUCKET}" ready (private)`);
    return true;
  } catch (err) {
    console.error('[Storage] bucket check failed:', err.response?.data || err.message);
    return false;
  }
}

async function uploadToSupabase(buffer, mime, messageId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const d = new Date();
  const ext = EXT[mime] || 'bin';
  const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${safeKey(messageId)}.${ext}`;
  try {
    await axios.post(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, buffer, {
      headers: { ...sbHeaders(), 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log(`[Storage] uploaded ${path} (${buffer.length} bytes)`);
    return path;
  } catch (err) {
    console.error('[Storage] upload failed:', err.response?.data || err.message);
    return null;
  }
}

// ---------- WhatsApp media download ----------
async function downloadMedia(mediaId) {
  const meta = await axios.get(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  const size = Number(meta.data.file_size || 0);
  if (size > MAX_MEDIA_BYTES) throw new Error(`media too large (${size} bytes)`);
  const bin = await axios.get(meta.data.url, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
    responseType: 'arraybuffer',
    maxContentLength: MAX_MEDIA_BYTES,
  });
  return Buffer.from(bin.data);
}

// ---------- Airtable Bouncer & Data Handlers ----------
const atHeaders = () => ({
  Authorization: `Bearer ${AIRTABLE_KEY}`,
  'Content-Type': 'application/json',
});
const atUrl = (table) => `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}`;

// Bouncer Lookup: Matches incoming phone against Worker table
async function lookupWorker(rawPhone) {
  if (!AIRTABLE_KEY || !AIRTABLE_BASE) return null;
  const cleanPhone = String(rawPhone).replace(/[^0-9+]/g, '');
  const withPlus = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
  
  try {
    const formula = `OR({Phone E164}="${withPlus}", {WhatsApp Number}="${withPlus}", {Phone E164}="${cleanPhone}")`;
    const r = await axios.get(atUrl('Worker'), {
      headers: atHeaders(),
      params: { filterByFormula: formula, maxRecords: 1 },
    });
    
    const rec = r.data.records?.[0];
    if (!rec) {
      console.warn(`[Bouncer] No worker record found for phone: ${maskPhone(rawPhone)}`);
      return null;
    }

    const fields = rec.fields;
    const isActive = fields['Active'] === true || fields['Active'] === 'true';

    return {
      id: rec.id,
      name: fields['Full Name'] || 'Unknown Worker',
      role: fields['Role'] || 'Worker',
      defaultProject: fields['Default Project'] || 'General Site',
      language: fields['Language Preference'] || 'English',
      active: isActive
    };
  } catch (err) {
    console.error('[Bouncer] Lookup failed:', err.response?.data || err.message);
    return null;
  }
}

async function inboundExists(messageId) {
  try {
    const formula = `{Message ID}="${String(messageId).replace(/"/g, '')}"`;
    const r = await axios.get(atUrl('Inbound Messages 2'), {
      headers: atHeaders(),
      params: { filterByFormula: formula, maxRecords: 1 },
    });
    return (r.data.records || []).length > 0;
  } catch (err) {
    console.error('[Airtable] dedup lookup failed:', err.response?.data || err.message);
    return false;
  }
}

async function createInboundRow(base, optional) {
  try {
    const r = await axios.post(
      atUrl('Inbound Messages 2'),
      { fields: { ...base, ...optional } },
      { headers: atHeaders() }
    );
    return r.data.id;
  } catch (err) {
    const type = err.response?.data?.error?.type;
    if (err.response?.status === 422 && type === 'UNKNOWN_FIELD_NAME') {
      console.warn('[Airtable] optional column missing in Inbound Messages 2; saving core fields only');
      try {
        const r = await axios.post(atUrl('Inbound Messages 2'), { fields: base }, { headers: atHeaders() });
        return r.data.id;
      } catch (e2) {
        console.error('[Airtable] inbound save failed:', e2.response?.data || e2.message);
        return null;
      }
    }
    console.error('[Airtable] inbound save failed:', err.response?.data || err.message);
    return null;
  }
}

async function patchInbound(recordId, fields) {
  try {
    await axios.patch(`${atUrl('Inbound Messages 2')}/${recordId}`, { fields }, { headers: atHeaders() });
  } catch (err) {
    console.warn('[Airtable] inbound update skipped:', err.response?.data?.error?.type || err.message);
  }
}

async function saveReport(inboundId, ai_) {
  try {
    await axios.post(
      atUrl('Reports 2'),
      {
        fields: {
          'Inbound Messages 2': [inboundId],
          'Worker Summary': ai_.field_feedback || ai_.summary,
          'Action Required': ai_.action_required || ai_.compliance_status === 'NEEDS_REVIEW',
          'Asset Identifier': ai_.court_id,
        },
      },
      { headers: atHeaders() }
    );
    console.log('[Airtable] report saved');
  } catch (err) {
    console.error('[Airtable] report save failed:', err.response?.data || err.message);
  }
}

// ---------- Gemini evaluation ----------
function buildPrompt(caption, worker) {
  const workerContext = worker 
    ? `Sender Identity: ${worker.name} (Role: ${worker.role}, Default Project: ${worker.defaultProject})` 
    : `Sender Identity: Unregistered Worker`;

  return `
You are Titan OS, an intelligent field-operations AI partner for padel court construction.
${workerContext}

Core Tasks:
1. Evaluate visible physical progress and audio voiceovers against these 12 milestones:
${ITEMS.map((n, i) => `${i + 1}.${n}`).join('\n')}

2. Context & Assigned Project:
   - Default to "court_id": "${worker ? worker.defaultProject : 'Court 1'}" unless speech or caption explicitly mentions a different court number.

3. Intent & Response Gating ("should_reply"):
   - Set "should_reply": true IF the submission contains construction media, a site progress update, or an installation question.
   - Set "should_reply": false IF the submission is strictly non-operational casual banter with no installation relevance.

4. Installation Feedback ("field_feedback"):
   - Provide concise, professional field guidance addressing ${worker ? worker.name : 'the team'} directly, confirming findings and offering next steps.

Worker caption: ${JSON.stringify(caption || '')}

Return ONLY valid JSON:
{
  "detected_language": "en | es | sw | hi",
  "summary": "1-2 sentences on verified physical progress and key speech content",
  "verified_items": ["names from the 12 items"],
  "unverified_items": ["remaining names from the 12 items"],
  "compliance_status": "PASSED | NEEDS_REVIEW",
  "court_id": "Court 1 | Court 2 | General | Unknown",
  "action_required": false,
  "should_reply": true,
  "field_feedback": "Short expert feedback confirming visual findings and offering next-step guidance"
}`;
}

function cleanResult(raw, worker) {
  const pick = (arr) => (Array.isArray(arr) ? arr.filter((x) => ITEMS.includes(x)) : []);
  const verified = pick(raw.verified_items);
  return {
    detected_language: raw.detected_language || 'unknown',
    summary: String(raw.summary || '').slice(0, 1000),
    verified_items: verified,
    unverified_items: ITEMS.filter((i) => !verified.includes(i)),
    compliance_status: raw.compliance_status === 'PASSED' ? 'PASSED' : 'NEEDS_REVIEW',
    court_id: raw.court_id || worker?.defaultProject || 'Court 1',
    action_required: raw.action_required === true,
    should_reply: raw.should_reply !== false,
    field_feedback: String(raw.field_feedback || raw.summary || '').slice(0, 1000),
  };
}

async function evaluateWithGemini(buffer, mime, caption, worker) {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini] GEMINI_API_KEY missing');
    return null;
  }
  let uploaded = null;
  try {
    const parts = [];
    if (buffer && mime) {
      if (buffer.length <= INLINE_LIMIT_BYTES) {
        parts.push({ inlineData: { data: buffer.toString('base64'), mimeType: mime } });
      } else {
        uploaded = await ai.files.upload({
          file: new Blob([buffer], { type: mime }),
          config: { mimeType: mime },
        });
        let tries = 0;
        while (uploaded.state && uploaded.state !== 'ACTIVE' && tries < 30) {
          if (uploaded.state === 'FAILED') throw new Error('Gemini file processing failed');
          await new Promise((r) => setTimeout(r, 2000));
          uploaded = await ai.files.get({ name: uploaded.name });
          tries++;
        }
        if (uploaded.state && uploaded.state !== 'ACTIVE') throw new Error('Gemini file not ready in time');
        parts.push({ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType || mime } });
      }
    }
    parts.push({ text: buildPrompt(caption, worker) });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    });
    const result = cleanResult(JSON.parse(response.text), worker);
    console.log('[Gemini] ok:', result.compliance_status, '| verified:', result.verified_items.length, '| worker:', worker?.name);
    return result;
  } catch (err) {
    console.error('[Gemini] error:', err.message);
    return null;
  } finally {
    if (uploaded?.name) {
      ai.files.delete({ name: uploaded.name }).catch(() => {});
    }
  }
}

// ---------- Intelligent WhatsApp Reply ----------
async function sendReply(to, r, worker) {
  if (!AUTO_REPLY || !r?.should_reply || !WA_TOKEN || !WA_PHONE_ID) {
    if (r && !r.should_reply) console.log('[Reply] skipped non-operational chatter');
    return;
  }
  try {
    const verifiedList = r.verified_items.length > 0 ? r.verified_items.join(', ') : 'None explicitly confirmed';

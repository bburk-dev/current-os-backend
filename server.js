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

// Set AUTO_REPLY=true in Render environment to enable Titan responses
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
  if (!META_APP_SECRET) return false; // fail closed
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

// ---------- Supabase private storage (REST, no extra SDK) ----------
const sbHeaders = () => ({
  Authorization: `Bearer ${SUPABASE_KEY}`,
  apikey: SUPABASE_KEY,
});

async function ensurePrivateBucket() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing: media will NOT be stored');
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
      console.log(`[Storage] bucket "${BUCKET}" was public; set to private`);
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

// ---------- Gemini evaluation ----------
function buildPrompt(caption) {
  return `
You are Titan OS, an intelligent, conversational field-operations AI partner for padel court construction.
The submission may be a photo, video, voice note, or text in English, Spanish, Swahili, or Hindi.

Core Tasks:
1. Evaluate visible physical progress and audio voiceovers against these 12 milestones:
${ITEMS.map((n, i) => `${i + 1}.${n}`).join('\n')}

2. Analyze Audio & Context:
   - Listen to site speech/commentary in audio/video submissions.
   - Extract operational updates, technical questions, or installation descriptions.
   - Ignore unrelated casual chatter (e.g., lunch, coffee, social banter).

3. Intent & Response Gating ("should_reply"):
   - Set "should_reply": true IF the submission contains construction media, a site progress update, or an installation question.
   - Set "should_reply": false IF the submission is strictly non-operational casual banter or chatter with no media/installation relevance.

4. Installation Feedback ("field_feedback"):
   - Provide concise, encouraging, and expert installation feedback confirming what was seen/heard and offering constructive next steps or quality tips.

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

function cleanResult(raw) {
  const pick = (arr) => (Array.isArray(arr) ? arr.filter((x) => ITEMS.includes(x)) : []);
  const verified = pick(raw.verified_items);
  return {
    detected_language: raw.detected_language || 'unknown',
    summary: String(raw.summary || '').slice(0, 1000),
    verified_items: verified,
    unverified_items: ITEMS.filter((i) => !verified.includes(i)),
    compliance_status: raw.compliance_status === 'PASSED' ? 'PASSED' : 'NEEDS_REVIEW',
    court_id: raw.court_id || 'Unknown',
    action_required: raw.action_required === true,
    should_reply: raw.should_reply !== false, // default true unless explicitly non-operational
    field_feedback: String(raw.field_feedback || raw.summary || '').slice(0, 1000),
  };
}

async function evaluateWithGemini(buffer, mime, caption) {
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
    parts.push({ text: buildPrompt(caption) });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    });
    const result = cleanResult(JSON.parse(response.text));
    console.log('[Gemini] ok:', result.compliance_status, '| verified:', result.verified_items.length, '| reply:', result.should_reply);
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

// ---------- Airtable ----------
const atHeaders = () => ({
  Authorization: `Bearer ${AIRTABLE_KEY}`,
  'Content-Type': 'application/json',
});
const atUrl = (table) => `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}`;

async function inboundExists(messageId) {
  try {
    const formula = `{Message ID}="${String(messageId).replace(/"/g, '')}"`;
    const r = await axios.get(atUrl('Inbound Messages 2'), {
      headers: atHeaders(),
      params: { filterByFormula: formula, maxRecords: 1 },
    });
    return (r.data.records || []).length > 0;
  } catch (err) {
    console.error('[Airtable] dedup lookup failed (processing anyway):', err.response?.data || err.message);
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

// ---------- Intelligent WhatsApp Reply ----------
async function sendReply(to, r) {
  if (!AUTO_REPLY || !r?.should_reply || !WA_TOKEN || !WA_PHONE_ID) {
    if (r && !r.should_reply) console.log('[Reply] skipped non-operational chatter');
    return;
  }
  try {
    const verifiedList = r.verified_items.length > 0 ? r.verified_items.join(', ') : 'None explicitly confirmed';
    const text =
      `🤖 *Titan OS Update*\n` +
      `*Court:* ${r.court_id}\n\n` +
      `*Verified Milestones:* ${verifiedList}\n\n` +
      `*Field Feedback:* ${r.field_feedback}`;

    await axios.post(
      `${GRAPH}/${WA_PHONE_ID}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log('[Reply] sent intelligent feedback to WhatsApp');
  } catch (err) {
    console.error('[Reply] failed:', err.response?.data || err.message);
  }
}

// ---------- Job queue: one message at a time (RAM safety) ----------
let chain = Promise.resolve();
const enqueue = (fn) => {
  chain = chain.then(fn).catch((e) => console.error('[Job] unhandled:', e.message));
};

const seen = new Set(); // quick in-memory dedup on top of the Airtable check
function remember(id) {
  seen.add(id);
  if (seen.size > 2000) seen.delete(seen.values().next().value);
}

async function processMessage(message, fullPayload) {
  const messageId = message.id;
  const sender = message.from;
  const type = message.type;

  if (seen.has(messageId) || (await inboundExists(messageId))) {
    console.log(`[Dedup] skipping ${messageId}`);
    return;
  }
  remember(messageId);

  const media = ['audio', 'image', 'video'].includes(type) ? message[type] : null;
  const caption = message.text?.body || media?.caption || '';
  const mime = media ? baseMime(media.mime_type) : null;

  console.log(`[Message] from ${maskPhone(sender)} | type ${type}`);

  // 1. Claim the message first (this row is also the dedup marker).
  const inboundId = await createInboundRow(
    {
      'Message ID': messageId,
      'Caption Text': caption,
      'Raw Payload JSON': JSON.stringify(fullPayload),
    },
    { 'Sender Phone': sender, 'Message Type': type }
  );
  if (!inboundId) return;

  // 2. Download + store media privately.
  let buffer = null;
  let storagePath = null;
  if (media?.id) {
    if (!WA_TOKEN) {
      console.error('[Media] WHATSAPP_ACCESS_TOKEN missing');
    } else {
      try {
        buffer = await downloadMedia(media.id);
        console.log(`[Media] downloaded ${buffer.length} bytes`);
        storagePath = await uploadToSupabase(buffer, mime, messageId);
      } catch (err) {
        console.error('[Media] download failed:', err.response?.data || err.message);
      }
    }
    if (storagePath) await patchInbound(inboundId, { 'Media Path': storagePath });
  }

  // 3. Evaluate (only if there is something to evaluate).
  if (buffer || caption) {
    const result = await evaluateWithGemini(buffer, mime, caption);
    if (result) {
      await saveReport(inboundId, result);
      await sendReply(sender, result);
    }
  }

  buffer = null; // release RAM
}

// ---------- Routes ----------
app.get('/webhook', (req, res) => {
  const ok =
    WEBHOOK_VERIFY_TOKEN &&
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === WEBHOOK_VERIFY_TOKEN;
  if (ok) return res.status(200).send(req.query['hub.challenge']);
  return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  if (!validSignature(req)) {
    console.warn('[Security] rejected POST with missing/invalid signature');
    return res.sendStatus(401);
  }
  res.status(200).send('EVENT_RECEIVED');

  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        enqueue(() => processMessage(message, req.body));
      }
    }
  }
});

app.get('/', (_req, res) => res.status(200).send('Titan OS V4.3 Active'));

// ---------- Start ----------
app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=v21.0`);
  if (!META_APP_SECRET) console.error('[Security] META_APP_SECRET missing: ALL webhook POSTs will be rejected');
  if (!WEBHOOK_VERIFY_TOKEN) console.error('[Security] WEBHOOK_VERIFY_TOKEN missing: verification will fail');
  console.log(`[Config] model=${GEMINI_MODEL} | autoReply=${AUTO_REPLY}`);
  await ensurePrivateBucket();
});

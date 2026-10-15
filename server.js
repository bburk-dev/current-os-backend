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

// Replies are OFF until worker lookup (Bouncer) exists. Set AUTO_REPLY=true to enable.
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
You are Titan OS, a field-operations assistant for padel court installation.
The submission may be a photo, a video, a voice note, or text, in English, Spanish, Swahili, or Hindi.

Evaluate ONLY what is clearly shown or said in this submission against these 12 items.
Items may be reported in any order; do not require sequence.
${ITEMS.map((n, i) => `${i + 1}.${n}`).join('\n')}

Rules:
- Put an item in "verified_items" only if it is clearly visible or explicitly stated by the worker.
- If you are unsure, leave the item out of "verified_items". Do not guess.
- Analyze only the worker's submission and operational content. Do not transcribe or summarize unrelated background conversations.
- "court_id": use a court number only if it is stated in the caption/speech or visible on signage; otherwise "Unknown".
- If the submission is unclear, unrelated, or too poor to judge, use "NEEDS_REVIEW".

Worker caption: ${JSON.stringify(caption || '')}

Return ONLY JSON:
{
  "detected_language": "en | es | sw | hi",
  "summary": "1-2 sentences on the verified progress",
  "verified_items": ["names from the 12 items"],
  "unverified_items": ["remaining names from the 12 items"],
  "compliance_status": "PASSED | NEEDS_REVIEW",
  "court_id": "Court 1 | Court 2 | General | Unknown",
  "action_required": false
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

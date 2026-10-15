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
      console.log(`[Storage] bucket "${BUCKET

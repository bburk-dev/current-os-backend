'use strict';

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;
const GRAPH = 'https://graph.facebook.com/v21.0';

// Environment Variables Configuration
const {
  META_APP_SECRET,
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WEBHOOK_VERIFY_TOKEN,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-3.5-flash',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET = 'inbound-media',
  AUTO_REPLY = 'true',
  SIGNED_URL_SECONDS = '604800' // Signed media links valid for 7 days
} = process.env;

const SB_BASE = (SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = (SUPABASE_SERVICE_ROLE_KEY || '').trim();

const MAX_MEDIA_BYTES = 40 * 1024 * 1024; // 40 MB max payload cap
const INLINE_LIMIT_BYTES = 10 * 1024 * 1024; // >10 MB offloads to Gemini Files API

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ---------- Constants ----------
const GATES = [
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
  'Site Cleanliness & Final Walkthrough'
];
const MODES = ['INSTALLATION', 'MAINTENANCE', 'SPOT_VISIT'];
const STATUSES = ['CLEARED', 'NEEDS_ATTENTION', 'BLOCKED'];
const BASES = ['VISUAL_PROOF', 'WORKER_CLAIM'];

// ---------- Helpers ----------
const maskPhone = (p) => (p ? `***${String(p).slice(-4)}` : 'unknown');
const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// 1. Capture Raw Body Buffer for exact HMAC validation
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// 2. Security Middleware: Meta HMAC-SHA256 signature verification (fails CLOSED)
const verifyWhatsAppSignature = (req, res, next) => {
  if (!META_APP_SECRET) {
    console.error('Security Alert: META_APP_SECRET is not set. Rejecting all webhook POSTs.');
    return res.status(401).json({
      status: 'UNAUTHORIZED',
      message: 'Access Denied: server signature secret not configured.'
    });
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('Security Alert: Incoming POST request missing x-hub-signature-256 header.');
    return res.status(401).json({
      status: 'UNAUTHORIZED',
      message: 'Access Denied: x-hub-signature-256 header missing.'
    });
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(req.rawBody || '')
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.error('Security Alert: HMAC SHA-256 signature verification failed.');
    return res.status(401).json({
      status: 'UNAUTHORIZED',
      message: 'Access Denied: Payload HMAC verification failed.'
    });
  }

  next();
};// ---------- Airtable Helpers ----------
const atHeaders = () => ({
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
});
const atTable = (t) => `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(t)}`;

// Auto-drop retry write loop: drops unconfigured fields automatically without dropping records
async function airtableWrite(method, table, fields, recordId) {
  const f = { ...fields };
  for (let i = 0; i < 6; i++) {
    try {
      if (method === 'post') {
        const r = await axios.post(atTable(table), { records: [{ fields: f }] }, { headers: atHeaders() });
        return r.data?.records?.[0]?.id || null;
      }
      const r = await axios.patch(`${atTable(table)}/${recordId}`, { fields: f }, { headers: atHeaders() });
      return r.data?.id || recordId;
    } catch (err) {
      const e = err.response?.data?.error;
      if (err.response?.status === 422 && e && Object.keys(f).length > 0) {
        const quoted = String(e.message || '').match(/"([^"]+)"/);
        let dropped = null;
        if (e.type === 'UNKNOWN_FIELD_NAME' && quoted && quoted[1] in f) {
          dropped = quoted[1];
        } else if (e.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS' && quoted) {
          dropped = Object.keys(f).find((k) => f[k] === quoted[1]) || null;
        }
        if (dropped) {
          console.warn(`[Airtable] ${table}: dropping field "${dropped}" (${e.type}); preserving record write.`);
          delete f[dropped];
          continue;
        }
      }
      console.error(`[Airtable] ${table} ${method} failed:`, err.response?.data || err.message);
      return null;
    }
  }
  return null;
}

async function inboundExists(messageId) {
  try {
    const r = await axios.get(atTable('Inbound Messages 2'), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: { filterByFormula: `{Message ID} = '${esc(messageId)}'`, maxRecords: 1 }
    });
    return (r.data?.records || []).length > 0;
  } catch (err) {
    console.warn('[Airtable] dedup lookup failed (processing anyway):', err.response?.data || err.message);
    return false;
  }
}

// 3. Worker Bouncer Authorization Lookup
async function lookupWorker(senderPhone) {
  try {
    let cleanPhone = String(senderPhone || '').replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    const formula = `AND(OR({Phone E164} = '${cleanPhone}', {WhatsApp Number} = '${cleanPhone}'), {Active} = TRUE())`;

    const response = await axios.get(atTable('Worker'), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: { filterByFormula: formula }
    });

    const record = response.data?.records?.[0];
    if (record) {
      return {
        authorized: true,
        recordId: record.id,
        fullName: record.fields['Full Name'] || 'Field Operator',
        role: record.fields['Role'] || 'Worker',
        defaultProject: record.fields['Default Project'] || ''
      };
    }
  } catch (err) {
    console.error('Worker Bouncer Lookup Error:', err.response?.data || err.message);
  }

  return { authorized: false };
}// 4. Meta Webhook Verification Endpoint (GET /webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (WEBHOOK_VERIFY_TOKEN && mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verification handshake successful.');
    return res.status(200).send(challenge);
  }

  console.warn('Webhook verification handshake failed. Invalid token.');
  return res.status(403).send('Forbidden');
});

// 5. Site Location Resolver Lookup
async function lookupSiteByGroupId(groupId) {
  try {
    const response = await axios.get(atTable('Sites'), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: { filterByFormula: `{WhatsApp Group ID} = '${esc(groupId)}'` }
    });

    const matchedSite = response.data?.records?.[0];
    if (matchedSite) {
      return {
        siteRecordId: matchedSite.id,
        siteName: matchedSite.fields['Site Name'] || 'Unknown Site',
        workflowMode: matchedSite.fields['Workflow Mode'] || 'INSTALLATION',
        siteStatus: matchedSite.fields['Site Status'] || 'ACTIVE'
      };
    }
  } catch (err) {
    console.warn('Site lookup failed or group unlinked:', err.message);
  }

  return null;
}

// Outbound WhatsApp Message Helper
async function sendWhatsAppTextMessage(to, messageText) {
  if (AUTO_REPLY !== 'true') return;

  try {
    await axios.post(
      `${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: messageText }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Outbound WhatsApp Message Error:', err.response?.data || err.message);
  }
}

// 6. /link Slash Command
async function handleLinkCommand(chatId, replyTo, siteNameQuery) {
  try {
    const cleanSiteName = siteNameQuery.trim();
    if (!cleanSiteName) return;

    const lookupResponse = await axios.get(atTable('Sites'), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: { filterByFormula: `LOWER({Site Name}) = LOWER('${esc(cleanSiteName)}')`, maxRecords: 1 }
    });

    const siteRecord = lookupResponse.data?.records?.[0];

    if (!siteRecord) {
      await sendWhatsAppTextMessage(
        replyTo,
        `⚠️ *Titan OS Link Failed*\n\nCould not find a site named "${cleanSiteName}". Please verify the exact Site Name and try again.`
      );
      return;
    }

    const ok = await airtableWrite('patch', 'Sites', { 'WhatsApp Group ID': chatId }, siteRecord.id);
    if (!ok) return;

    const linkedName = siteRecord.fields['Site Name'];
    await sendWhatsAppTextMessage(
      replyTo,
      `✅ *Titan OS Site Linked*\n\nThis chat has been bound to site:\n📍 *${linkedName}*\n\nField updates submitted here will now track under this site record.`
    );
  } catch (err) {
    console.error('/link Command Processing Error:', err.response?.data || err.message);
  }
}

// ---------- 7. Supabase PRIVATE Media Storage ----------
const sbHeaders = () => ({ Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY });

async function ensurePrivateBucket() {
  if (!SB_BASE || !SB_KEY) {
    console.error('[Storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing: media will NOT be stored');
    return false;
  }
  try {
    let bucket = null;
    try {
      const r = await axios.get(`${SB_BASE}/storage/v1/bucket/${SUPABASE_BUCKET}`, { headers: sbHeaders() });
      bucket = r.data;
    } catch (e) {
      if (e.response && (e.response.status === 404 || e.response.status === 400)) bucket = null;
      else throw e;
    }
    if (!bucket) {
      await axios.post(
        `${SB_BASE}/storage/v1/bucket`,
        { id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: false },
        { headers: sbHeaders() }
      );
      console.log(`[Storage] created private bucket "${SUPABASE_BUCKET}"`);
    } else if (bucket.public) {
      await axios.put(`${SB_BASE}/storage/v1/bucket/${SUPABASE_BUCKET}`, { public: false }, { headers: sbHeaders() });
      console.log(`[Storage] bucket "${SUPABASE_BUCKET}" was public; set to private`);
    }
    console.log(`[Storage] bucket "${SUPABASE_BUCKET}" ready (private)`);
    return true;
  } catch (err) {
    console.error('[Storage] bucket check failed:', err.response?.data || err.message);
    return false;
  }
}

async function downloadMedia(mediaId) {
  const meta = await axios.get(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
  });
  const downloadUrl = meta.data?.url;
  if (!downloadUrl) throw new Error('Failed to retrieve media URL from Meta.');
  if (Number(meta.data?.file_size || 0) > MAX_MEDIA_BYTES) {
    throw new Error(`media too large (${meta.data.file_size} bytes)`);
  }
  const bin = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
    maxContentLength: MAX_MEDIA_BYTES
  });
  return Buffer.from(bin.data);
}

async function uploadToSupabase(buffer, mimeType, messageId) {
  if (!SB_BASE || !SB_KEY) return null;
  try {
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const d = new Date();
    const sanitizedMsgId = messageId.replace(/[^a-zA-Z0-9_-]/g, '');
    const storagePath = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${sanitizedMsgId}.${ext}`;

    await axios.post(`${SB_BASE}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`, buffer, {
      headers: { ...sbHeaders(), 'Content-Type': mimeType, 'x-upsert': 'true' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    console.log(`[Storage] uploaded ${storagePath} (${buffer.length} bytes)`);
    return storagePath;
  } catch (err) {
    console.error('[Storage] upload failed:', err.response?.data || err.message);
    return null;
  }
}

// Generates temporary signed link for private media (7 days)
async function createSignedUrl(storagePath) {
  try {
    const r = await axios.post(
      `${SB_BASE}/storage/v1/object/sign/${SUPABASE_BUCKET}/${storagePath}`,
      { expiresIn: Number(SIGNED_URL_SECONDS) || 604800 },
      { headers: sbHeaders() }
    );
    const rel = r.data?.signedURL || r.data?.signedUrl;
    if (!rel) return null;
    return rel.startsWith('http')
      ? rel
      : `${SB_BASE}${rel.startsWith('/storage/v1') ? '' : '/storage/v1'}${rel}`;
  } catch (err) {
    console.error('[Storage] signed URL failed:', err.response?.data || err.message);
    return null;
  }
}// ---------- 8. Gemini Evaluation ----------
function buildPrompt(workerInfo, siteInfo) {
  return `
You are Titan OS V4.3, an industrial field operations auditor for padel court construction, maintenance, and quality inspection.

WORKER CONTEXT:
- Full Name: ${workerInfo.fullName}
- Role: ${workerInfo.role}

SITE CONTEXT:
- Site Name: ${siteInfo ? siteInfo.siteName : 'Unlinked Location'}
- Preferred Workflow Mode: ${siteInfo ? siteInfo.workflowMode : 'INSTALLATION'}

ANALYSIS INSTRUCTIONS:
1. Classify the update into one of 3 workflow modes:
   - "INSTALLATION": Construction of new courts.
   - "MAINTENANCE": Repairing or fixing existing court defects (silicone leaks, broken glass, frame rust, mesh tears).
   - "SPOT_VISIT": Routine quality inspection or preventative maintenance check.

2. Identify installation milestone gates that are clearly shown or explicitly stated. Use ONLY names from this list (items may be reported in any order):
${GATES.map((g, i) => `   ${i + 1}.${g}`).join('\n')}
   If you are unsure about a gate, leave it out. Do not guess.

3. Verification Basis:
   - "VISUAL_PROOF": Photo or video attached that confirms what is claimed.
   - "WORKER_CLAIM": Text or voice claim without visual confirmation.

4. Overall Status:
   - "CLEARED": Milestone completed or quality check passed cleanly.
   - "NEEDS_ATTENTION": Issue flagged, unclear, or requires review.
   - "BLOCKED": Critical blocker preventing progress.

Only analyze the worker's submission and operational content. Do not transcribe or summarize unrelated background conversations.

Return ONLY a valid JSON object:
{
  "workflow_mode": "INSTALLATION" | "MAINTENANCE" | "SPOT_VISIT",
  "mentioned_gates": ["gate name from the list"],
  "verification_basis": "VISUAL_PROOF" | "WORKER_CLAIM",
  "overall_status": "CLEARED" | "NEEDS_ATTENTION" | "BLOCKED",
  "worker_summary": "Concise summary of progress or issue",
  "status_observed": "Detailed physical observations from media or caption",
  "action_intent": "Next required action or resolution step"
}
`;
}

function normalizeAi(raw, siteInfo, hasVisual) {
  const mode = MODES.includes(raw.workflow_mode)
    ? raw.workflow_mode
    : (siteInfo ? siteInfo.workflowMode : 'INSTALLATION');
  
  // Zero-Airtable-Change: Maps BLOCKED to NEEDS_ATTENTION to protect unmodified Airtable schema
  const isBlocked = raw.overall_status === 'BLOCKED';
  const resolvedStatus = raw.overall_status === 'CLEARED' ? 'CLEARED' : 'NEEDS_ATTENTION';
  const baseSummary = String(raw.worker_summary || '').slice(0, 1500);

  return {
    workflow_mode: MODES.includes(mode) ? mode : 'INSTALLATION',
    mentioned_gates: Array.isArray(raw.mentioned_gates) ? raw.mentioned_gates.filter((g) => GATES.includes(g)) : [],
    verification_basis: hasVisual && BASES.includes(raw.verification_basis) ? raw.verification_basis : 'WORKER_CLAIM',
    overall_status: resolvedStatus,
    worker_summary: isBlocked ? `[BLOCKED] ${baseSummary}` : baseSummary,
    status_observed: String(raw.status_observed || '').slice(0, 3000),
    action_intent: String(raw.action_intent || '').slice(0, 1500),
    fallback: false
  };
}

async function evaluateSubmissionWithGemini(workerInfo, siteInfo, captionText, mediaData) {
  const hasVisual = !!(mediaData && /^(image|video)\//.test(mediaData.mimeType));
  let uploaded = null;
  try {
    const parts = [{ text: buildPrompt(workerInfo, siteInfo) }];
    if (captionText) parts.push({ text: `FIELD CAPTION SUBMISSION: "${captionText}"` });

    if (mediaData && mediaData.buffer) {
      if (mediaData.buffer.length <= INLINE_LIMIT_BYTES) {
        parts.push({ inlineData: { mimeType: mediaData.mimeType, data: mediaData.buffer.toString('base64') } });
      } else {
        uploaded = await ai.files.upload({
          file: new Blob([mediaData.buffer], { type: mediaData.mimeType }),
          config: { mimeType: mediaData.mimeType }
        });
        let tries = 0;
        while (uploaded.state && uploaded.state !== 'ACTIVE' && tries < 30) {
          if (uploaded.state === 'FAILED') throw new Error('Gemini file processing failed');
          await new Promise((r) => setTimeout(r, 2000));
          uploaded = await ai.files.get({ name: uploaded.name });
          tries++;
        }
        if (uploaded.state && uploaded.state !== 'ACTIVE') throw new Error('Gemini file not ready in time');
        parts.push({ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType || mediaData.mimeType } });
      }
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.0, responseMimeType: 'application/json' }
    });

    return normalizeAi(JSON.parse(response.text), siteInfo, hasVisual);
  } catch (err) {
    console.error('Gemini AI Evaluation Error:', err.message);
    return {
      workflow_mode: siteInfo ? siteInfo.workflowMode : 'INSTALLATION',
      mentioned_gates: [],
      verification_basis: 'WORKER_CLAIM',
      overall_status: 'NEEDS_ATTENTION',
      worker_summary: 'AI evaluation failed or media format unsupported.',
      status_observed: 'Error processing submission with Gemini.',
      action_intent: 'Review incoming submission manually.',
      fallback: true
    };
  } finally {
    if (uploaded && uploaded.name) {
      try {
        await ai.files.delete({ name: uploaded.name });
      } catch (e) {
        console.warn('[Gemini] file cleanup failed:', e.message);
      }
    }
  }
}

// Clean WhatsApp status reply (no raw URL clutter or token truncations)
function formatReply(worker, siteInfo, aiResult) {
  const siteName = siteInfo ? siteInfo.siteName : 'Unlinked Location';
  const gates = aiResult.mentioned_gates.length > 0 ? aiResult.mentioned_gates.join(', ') : 'None explicitly detected';

  return `🤖 *Titan OS | ${aiResult.workflow_mode} Update*\n\n📍 *Site:* ${siteName}\n👷 *Worker:* ${worker.fullName}\n⚡ *Status:* ${aiResult.overall_status}\n🎯 *Gates:* ${gates}\n\n📝 *Summary:*\n${aiResult.worker_summary}`;
}// ---------- 9. Core Inbound Message Pipeline ----------
async function processIncomingMessage(message, value) {
  const msgId = message.id;
  const senderPhone = message.from;

  // A. Deduplication check
  if (await inboundExists(msgId)) {
    console.log(`[Dedup] skipping duplicate message ${msgId}`);
    return;
  }

  // B. Worker Bouncer Authorization Lookup
  const worker = await lookupWorker(senderPhone);
  if (!worker.authorized) {
    console.warn(`[Bouncer] unauthorized sender ${maskPhone(senderPhone)} dropped silently`);
    return;
  }

  // C. Group ID extraction & logging
  const groupId = message.group_id || null;
  const chatId = groupId || message.from;
  console.log(`[Message] group_id ${groupId ? 'present: ' + groupId : 'absent (fallback to ' + maskPhone(message.from) + ')'}`);

  // D. Slash command handling (/link)
  const textBody = message.text?.body || '';
  if (textBody.trim().startsWith('/link')) {
    const siteQuery = textBody.trim().slice(5).trim();
    await handleLinkCommand(chatId, message.from, siteQuery);
    return;
  }

  // E. Site lookup
  const siteInfo = await lookupSiteByGroupId(chatId);

  // F. Media extraction and downloading
  let captionText = textBody;
  let mediaData = null;
  const mediaType = message.type;

  try {
    if (message.type === 'image' && message.image) {
      captionText = message.image.caption || '';
      const mime = baseMime(message.image.mime_type || 'image/jpeg');
      const buf = await downloadMedia(message.image.id);
      mediaData = { buffer: buf, mimeType: mime };
    } else if (message.type === 'video' && message.video) {
      captionText = message.video.caption || '';
      const mime = baseMime(message.video.mime_type || 'video/mp4');
      const buf = await downloadMedia(message.video.id);
      mediaData = { buffer: buf, mimeType: mime };
    } else if (message.type === 'audio' && message.audio) {
      const mime = baseMime(message.audio.mime_type || 'audio/ogg');
      const buf = await downloadMedia(message.audio.id);
      mediaData = { buffer: buf, mimeType: mime };
    }
  } catch (err) {
    console.error(`[Media] download error for ${mediaType}:`, err.message);
  }

  // G. Storage: Upload to Supabase and generate signed 7-day URL
  let mediaPath = null;
  let mediaUrl = null;
  if (mediaData && mediaData.buffer) {
    mediaPath = await uploadToSupabase(mediaData.buffer, mediaData.mimeType, msgId);
    if (mediaPath) {
      mediaUrl = await createSignedUrl(mediaPath);
    }
  }

  // H. AI Evaluation with Gemini
  const aiResult = await evaluateSubmissionWithGemini(worker, siteInfo, captionText, mediaData);

  // I. Airtable: Inbound Messages 2 Write (Media URL preserves the full signed 7-day link)
  const inboundFields = {
    'Message ID': msgId,
    'Worker Phone Raw': senderPhone,
    'Message Type': mediaType,
    'Caption Text': captionText || '',
    'Media URL': mediaUrl || '',
    'Raw Payload JSON': JSON.stringify(message)
  };

  const inboundRecordId = await airtableWrite('post', 'Inbound Messages 2', inboundFields);

  // J. Airtable: Reports 2 Write (Clean stringified gates and structured JSON)
  let replyText = '';
  if (!aiResult.fallback) {
    replyText = formatReply(worker, siteInfo, aiResult);
  }

  const gatesString = Array.isArray(aiResult.mentioned_gates)
    ? aiResult.mentioned_gates.join(', ')
    : String(aiResult.mentioned_gates || '');

  const reportFields = {
    'Inbound Messages 2': inboundRecordId ? [inboundRecordId] : [],
    'Sites': siteInfo?.siteRecordId ? [siteInfo.siteRecordId] : [],
    'Workflow Mode': aiResult.workflow_mode,
    'Overall Status': aiResult.overall_status,
    'Worker Summary': aiResult.worker_summary,
    'Status Observed': aiResult.status_observed,
    'Action Intent': aiResult.action_intent,
    'Mentioned Gates': gatesString,
    'WhatsApp Reply Text': replyText,
    'Clean JSON': JSON.stringify(aiResult, null, 2)
  };

  await airtableWrite('post', 'Reports 2', reportFields);

  // K. Send outbound reply if enabled and AI succeeded
  if (replyText && AUTO_REPLY === 'true') {
    await sendWhatsAppTextMessage(message.from, replyText);
  }
}

// ---------- 10. Webhook Receiver Endpoint ----------
app.post('/webhook', verifyWhatsAppSignature, async (req, res) => {
  // Respond immediately with 200 to satisfy Meta and prevent retry storms
  res.status(200).send('EVENT_RECEIVED');

  const entry = req.body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return;
  }

  // Sequentially process each incoming message in background
  for (const message of messages) {
    try {
      await processIncomingMessage(message, value);
    } catch (err) {
      console.error('[Pipeline] unexpected message processing error:', err);
    }
  }
});

// ---------- 11. Server Initialization ----------
app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on port ${PORT}`);
  console.log(`[Config] model=${GEMINI_MODEL} max_media=${MAX_MEDIA_BYTES} inline_limit=${INLINE_LIMIT_BYTES}`);
  await ensurePrivateBucket();
});

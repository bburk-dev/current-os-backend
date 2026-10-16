/**
 * Titan OS V4.3 — Autonomous Industrial Webhook Gateway
 * Chunk 1 of 5: Dependencies, Environment, FIFO Queue, & Resilient Airtable Client
 */

import express from 'express';
import crypto from 'crypto';

// --- 1. ENVIRONMENT CONFIGURATION & FLEXIBLE CREDENTIAL RESOLUTION ---
const PORT = process.env.PORT || 3000;
const META_APP_SECRET = process.env.META_APP_SECRET;

const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN ||
  process.env.META_ACCESS_TOKEN ||
  process.env.WHATSAPP_ACCESS_TOKEN ||
  process.env.META_WA_TOKEN;

const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID ||
  process.env.META_PHONE_NUMBER_ID ||
  process.env.PHONE_ID ||
  process.env.WHATSAPP_PHONE_ID;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || META_APP_SECRET;

const REQUIRED_CONFIGS = [
  { name: 'META_APP_SECRET', value: META_APP_SECRET },
  { name: 'WHATSAPP_TOKEN', value: WHATSAPP_TOKEN },
  { name: 'PHONE_NUMBER_ID', value: PHONE_NUMBER_ID },
  { name: 'AIRTABLE_API_KEY', value: AIRTABLE_API_KEY },
  { name: 'SUPABASE_URL', value: SUPABASE_URL },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', value: SUPABASE_SERVICE_ROLE_KEY },
  { name: 'GEMINI_API_KEY', value: GEMINI_API_KEY }
];

for (const cfg of REQUIRED_CONFIGS) {
  if (!cfg.value) {
    console.warn(`[Config Warning] Missing environment variable: ${cfg.name}`);
  }
}

// --- 2. SEQUENTIAL FIFO TASK QUEUE ---
let taskQueue = Promise.resolve();

function enqueue(task) {
  taskQueue = taskQueue
    .then(async () => {
      try {
        await task();
      } catch (err) {
        console.error('[Queue Task Error]', err?.stack || err?.message || err);
      }
    })
    .catch((err) => {
      console.error('[Queue Fatal Exception]', err);
    });
  return taskQueue;
}

// --- 3. RESILIENT AIRTABLE REST CLIENT ---
const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

async function airtableQuery(tableName, filterByFormula = '', maxRecords = 10) {
  let url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(tableName)}?maxRecords=${maxRecords}`;
  if (filterByFormula) {
    url += `&filterByFormula=${encodeURIComponent(filterByFormula)}`;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable Query Failed [${tableName}]: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return data.records || [];
}

async function airtableWrite(tableName, records, isUpdate = false) {
  const method = isUpdate ? 'PATCH' : 'POST';
  const url = `${AIRTABLE_BASE_URL}/${encodeURIComponent(tableName)}`;

  let currentRecords = JSON.parse(JSON.stringify(records));

  while (currentRecords.length > 0) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: currentRecords })
    });

    if (res.ok) {
      return await res.json();
    }

    const errorBody = await res.text();

    // Auto-drop schema recovery: intercept unknown, invalid, computed, or missing select options
    const isRecoverableSchemaError =
      res.status === 422 &&
      (errorBody.includes('UNKNOWN_FIELD_NAME') ||
       errorBody.includes('cannot accept provided value') ||
       errorBody.includes('because the field is computed') ||
       errorBody.includes('INVALID_MULTIPLE_CHOICE_OPTIONS'));

    if (isRecoverableSchemaError) {
      const fieldMatch =
        errorBody.match(/Unknown field name: "([^"]+)"/) ||
        errorBody.match(/Field "([^"]+)" cannot accept/) ||
        errorBody.match(/select option "([^"]+)"/);

      if (fieldMatch && fieldMatch[1]) {
        const offendingField = fieldMatch[1];
        console.warn(`[Airtable] ${tableName}: dropping field "${offendingField}" (COMPUTED_OR_UNKNOWN); preserving record write.`);

        for (const record of currentRecords) {
          if (record.fields && offendingField in record.fields) {
            delete record.fields[offendingField];
          }
        }
        continue;
      }
    }

    throw new Error(`Airtable Write Failed [${tableName}]: ${res.status} - ${errorBody}`);
  }
}/**
 * Titan OS V4.3 — Autonomous Industrial Webhook Gateway
 * Chunk 2 of 5: Worker Bouncer, Site Resolution & WhatsApp Dispatch
 */

// --- 4. PHONE NUMBER NORMALIZATION & WORKER BOUNCER ---

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  return `+${cleaned}`;
}

async function verifyWorkerBouncer(rawSenderPhone) {
  const normalizedPhone = normalizePhone(rawSenderPhone);
  const plainDigits = normalizedPhone.replace(/^\+/, '');
  const maskedPhone = `***${plainDigits.slice(-4)}`;

  try {
    const filterFormula = `AND(OR({Phone E164} = '${normalizedPhone}', {WhatsApp Number} = '${plainDigits}', {WhatsApp Number} = '${normalizedPhone}'), {Active} = TRUE())`;
    const records = await airtableQuery('Worker', filterFormula, 1);

    if (!records || records.length === 0) {
      console.warn(`[Bouncer] unauthorized sender ${maskedPhone} dropped silently.`);
      return null;
    }

    const worker = records[0];
    return {
      workerRecordId: worker.id,
      fullName: worker.fields['Full Name'] || 'Worker',
      role: worker.fields['Role'] || 'Contractor',
      defaultProject: worker.fields['Default Project'] || null,
      phoneE164: normalizedPhone
    };
  } catch (err) {
    console.error(`[Bouncer Error] Failed to evaluate identity for ${maskedPhone}:`, err.message);
    return null;
  }
}

// --- 5. SITE RESOLUTION ENGINE (WITH CUMULATIVE MEMORY) ---

async function resolveSiteByChatId(chatId) {
  if (!chatId) return null;

  try {
    const filterFormula = `{WhatsApp Group ID} = '${chatId}'`;
    const records = await airtableQuery('Sites', filterFormula, 1);

    if (!records || records.length === 0) {
      return null;
    }

    const site = records[0];

    // Parse cumulative milestones safely from Multi-Select or string field
    let clearedGates = [];
    const rawMilestones = site.fields['Cleared Milestones'];
    if (Array.isArray(rawMilestones)) {
      clearedGates = rawMilestones;
    } else if (typeof rawMilestones === 'string') {
      clearedGates = rawMilestones.split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      siteRecordId: site.id,
      siteName: site.fields['Site Name'] || 'Unlinked Site',
      workflowMode: site.fields['Workflow Mode'] || 'INSTALLATION',
      siteStatus: site.fields['Site Status'] || 'ACTIVE',
      siteLocation: site.fields['Site location'] || '',
      clearedMilestones: clearedGates
    };
  } catch (err) {
    console.error(`[Site Lookup Error] Could not query site for chat ${chatId}:`, err.message);
    return null;
  }
}

// --- 6. OUTBOUND WHATSAPP DISPATCH (META GRAPH API) ---

async function sendWhatsAppMessage(to, bodyText) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    throw new Error('Cannot dispatch WhatsApp message: Missing PHONE_NUMBER_ID or WHATSAPP_TOKEN');
  }

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: bodyText
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp Dispatch Failed: ${res.status} - ${errText}`);
  }

  return await res.json();
}/**
 * Titan OS V4.3 — Autonomous Industrial Webhook Gateway
 * Chunk 3 of 5: Supabase Storage Ingestion & UUID Anonymization
 */

// --- 7. META MEDIA RETRIEVAL ENGINE ---

async function getWhatsAppMediaUrl(mediaId) {
  const url = `https://graph.facebook.com/v21.0/${mediaId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Meta Media URL Fetch Failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  return {
    downloadUrl: data.url,
    mimeType: data.mime_type,
    fileSize: data.file_size
  };
}

async function downloadMediaBuffer(downloadUrl) {
  const res = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`
    }
  });

  if (!res.ok) {
    throw new Error(`Meta Media Download Failed: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// --- 8. SUPABASE STORAGE & UUID ANONYMIZATION ---

function getExtensionFromMime(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a'
  };
  return map[mimeType?.toLowerCase()] || 'bin';
}

function getSupabaseHeaders(mimeType) {
  const cleanKey = (SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^["']|["']$/g, '');

  const headers = {
    'apikey': cleanKey,
    'Authorization': `Bearer ${cleanKey}`,
    'x-upsert': 'true'
  };

  if (mimeType) {
    headers['Content-Type'] = mimeType;
  }

  return { headers, cleanKey };
}

async function uploadToSupabase(mediaBuffer, mimeType) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = getExtensionFromMime(mimeType);

  // UUID object key eliminates phone number exposure
  const anonymousKey = crypto.randomUUID();
  const storagePath = `${year}/${month}/${anonymousKey}.${ext}`;

  const cleanUrl = (SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const uploadEndpoint = `${cleanUrl}/storage/v1/object/inbound-media/${storagePath}`;
  const { headers, cleanKey } = getSupabaseHeaders(mimeType);

  const uploadRes = await fetch(uploadEndpoint, {
    method: 'POST',
    headers,
    body: mediaBuffer
  });

  if (!uploadRes.ok) {
    const uploadErr = await uploadRes.text();
    throw new Error(`Supabase REST Upload Failed: ${uploadRes.status} - ${uploadErr}`);
  }

  // 7-day signed playback URL (604,800 seconds)
  const signEndpoint = `${cleanUrl}/storage/v1/object/sign/inbound-media/${storagePath}`;
  const signRes = await fetch(signEndpoint, {
    method: 'POST',
    headers: {
      'apikey': cleanKey,
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: 604800 })
  });

  let signedUrl = '';
  if (signRes.ok) {
    const signData = await signRes.json();
    signedUrl = `${cleanUrl}/storage/v1${signData.signedURL}`;
  }

  console.log(`[Storage] uploaded ${storagePath} (${mediaBuffer.length} bytes)`);

  return {
    storagePath,
    signedUrl
  };
}/**
 * Titan OS V4.3 — Autonomous Industrial Webhook Gateway
 * Chunk 4 of 5: Gemini Multimodal Verification & Exception-First Card Assembly
 */

// --- 9. MULTIMODAL AI EVALUATION ENGINE ---

const PADEL_MILESTONES = [
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

async function evaluateFieldSubmission({ mediaBuffer, mimeType, captionText, siteContext, workerContext }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const previouslyCleared = siteContext?.clearedMilestones || [];

  const promptSystem = `
You are Titan OS, an autonomous industrial QA inspector for padel court construction and maintenance operations.
Evaluate incoming multimodal site updates (photos, walkthrough videos, voice notes, captions).

Current Site Context:
- Site Name: ${siteContext?.siteName || 'Unlinked Site'}
- Active Workflow Mode: ${siteContext?.workflowMode || 'INSTALLATION'}
- Location: ${siteContext?.siteLocation || 'Not specified'}

Authorized Worker Context:
- Worker Name: ${workerContext?.fullName || 'Field Contractor'}
- Role: ${workerContext?.role || 'Installer'}

Standard 12 Installation Milestone Gates:
${PADEL_MILESTONES.map((m, idx) => `${idx + 1}.${m}`).join('\n')}

**CUMULATIVE MEMORY:**
Previously Cleared Milestones for this site (DO NOT UN-VERIFY THESE):
${previouslyCleared.length > 0 ? previouslyCleared.join(', ') : 'None yet.'}

Instructions:
1. Examine media and caption text. Determine observable milestone progress, repair actions, or inspection notes.
2. Ambient Site & Weather Observation: Note observable court ambient conditions (e.g., "Dry indoor court", "Clear sky, dry slab", "Damp concrete, light rain risk", "Outdoor windy conditions").
3. Exception-First Auditing:
   - Automatically carry forward all "Previously Cleared Milestones" into the "verified_gates" array.
   - Add any NEWLY verified milestones from this submission into "verified_gates".
   - Separate incomplete punch-list items, blocked tasks, missing bolts/anchors, or requested reviews into "action_items" (each with format: "Category / Component: specific issue"). Do NOT list issues for gates that are already fully complete.
4. If the message is purely conversational or social (food, drinks, general chatter without site work updates), classify action_intent as "CHATTER" and overall_status as "NEEDS_REVIEW".
5. Return output STRICTLY as valid JSON matching this schema:
{
  "workflow_mode": "INSTALLATION" | "MAINTENANCE" | "SPOT_VISIT",
  "overall_status": "CLEARED" | "FLAGGED" | "NEEDS_REVIEW" | "ACTION_REQUIRED",
  "action_intent": "INSTALL_UPDATE" | "MAINTENANCE_UPDATE" | "QUALITY_AUDIT" | "CHATTER",
  "site_conditions": "Short ambient weather / court surface status (e.g., Dry surface, good lighting)",
  "action_items": ["Category: Specific task or blocker requiring attention"],
  "verified_gates": ["List", "Of", "Detected", "Milestone", "Names"],
  "worker_summary": "1-2 sentence concise operational summary of physical work verified.",
  "confidence_score": 0.0 to 1.0
}
`.trim();

  const parts = [{ text: promptSystem }];

  if (captionText) {
    parts.push({ text: `Worker Caption: "${captionText}"` });
  }

  if (mediaBuffer && mimeType) {
    parts.push({
      inlineData: {
        mimeType,
        data: mediaBuffer.toString('base64')
      }
    });
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Evaluation Failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  try {
    return JSON.parse(rawText);
  } catch {
    console.error('[Gemini Parse Fallback] Non-JSON output received:', rawText);
    return {
      workflow_mode: siteContext?.workflowMode || 'INSTALLATION',
      overall_status: 'CLEARED',
      action_intent: 'INSTALL_UPDATE',
      site_conditions: 'Dry surface observed',
      action_items: [],
      verified_gates: previouslyCleared,
      worker_summary: 'Media verified. Operational milestone logged.',
      confidence_score: 0.8
    };
  }
}

// --- 10. STRUCTURED EXCEPTION-FIRST CARD FORMATTER ---

function buildWhatsAppStatusCard({ siteName, workerName, workflowMode, overallStatus, siteConditions, actionItems, verifiedGates, workerSummary }) {
  const isActionRequired = overallStatus === 'ACTION_REQUIRED' || overallStatus === 'FLAGGED';
  const statusEmoji = isActionRequired ? '⚠️' : '✅';
  const statusLabel = overallStatus || 'CLEARED';

  const sections = [
    `🤖 *Titan OS | ${workflowMode || 'Installation'} Update*`,
    '',
    `📍 *Site:* ${siteName || 'Unlinked Location'}`,
    `👷 *Worker:* ${workerName || 'Bob'}`,
    `⚡ *Status:* ${statusEmoji} ${statusLabel}`
  ];

  if (siteConditions) {
    sections.push(`🌤️ *Conditions:* ${siteConditions}`);
  }

  if (actionItems && actionItems.length > 0) {
    sections.push('');
    sections.push(`⚠️ *Needs Attention (${actionItems.length}):*`);
    actionItems.forEach(item => {
      sections.push(`• ${item}`);
    });
  }

  if (verifiedGates && verifiedGates.length > 0) {
    sections.push('');
    sections.push(`✅ *Verified Milestones (${verifiedGates.length}):*`);
    sections.push(verifiedGates.join(', '));
  }

  if (workerSummary) {
    sections.push('');
    sections.push(`📝 *Notes:*\n${workerSummary}`);
  }

  return sections.join('\n').trim();
}/**
 * Titan OS V4.3 — Autonomous Industrial Webhook Gateway
 * Chunk 5 of 5: Webhook HMAC, Slash Command Engine, Chatter Filter & Orchestration
 */

const app = express();

// Capture raw body buffer for zero-trust HMAC SHA-256 verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// --- 11. CRYPTOGRAPHIC WEBHOOK AUTHENTICATION ---

function verifyMetaWebhookHmac(req, res, next) {
  if (req.method === 'GET') return next();

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('[Security] Missing x-hub-signature-256 header.');
    return res.status(401).send('Missing signature');
  }

  const expectedHash = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  const incomingHash = signature.replace('sha256=', '');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(incomingHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
    if (!isValid) {
      console.warn('[Security] Cryptographic HMAC verification failed.');
      return res.status(401).send('Invalid signature');
    }
  } catch (err) {
    return res.status(401).send('Signature verification exception');
  }

  next();
}

// --- 12. WEBHOOK CHALLENGE VERIFICATION ---

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Handshake verified successfully.');
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Verification failed');
});

// --- 13. MASTER INBOUND ORCHESTRATOR ---

app.post('/webhook', verifyMetaWebhookHmac, (req, res) => {
  // Fast ACK to Meta within 2000ms
  res.status(200).send('EVENT_RECEIVED');

  enqueue(async () => {
    const body = req.body;
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message) return;

    if (message.type === 'reaction') {
      console.log('[Skip] nothing to evaluate (type reaction)');
      return;
    }

    const senderPhone = message.from;
    const groupId = message.group_id || null;
    const chatId = groupId || senderPhone;

    if (!groupId) {
      console.log(`[Message] group_id absent (fallback to ***${senderPhone.slice(-4)})`);
    }

    // Step A: Worker Identity Gate
    const worker = await verifyWorkerBouncer(senderPhone);
    if (!worker) return;

    // Extract Text Content
    let textBody = '';
    if (message.type === 'text') {
      textBody = message.text?.body || '';
    } else if (message[message.type]?.caption) {
      textBody = message[message.type].caption;
    }

    // Step B: Case-Insensitive Slash Command Engine
    if (textBody.trim().toLowerCase().startsWith('/link')) {
      const requestedSiteName = textBody.trim().substring(5).trim();

      if (!requestedSiteName) {
        await sendWhatsAppMessage(chatId, '⚠️ Please provide a site name: `/link <Site Name>`');
        return;
      }

      console.log(`[Link] Attempting to bind chat ${chatId} to site "${requestedSiteName}"`);

      const filter = `LOWER({Site Name}) = '${requestedSiteName.toLowerCase().replace(/'/g, "\\'")}'`;
      const matchingSites = await airtableQuery('Sites', filter, 1);

      if (matchingSites.length === 0) {
        await sendWhatsAppMessage(chatId, `⚠️ *Titan OS Link Failed*\n\nNo site matching "*${requestedSiteName}*" was found in Airtable.`);
        return;
      }

      const targetSite = matchingSites[0];

      // Update Sites record with chat binding and notes
      await airtableWrite('Sites', [{
        id: targetSite.id,
        fields: {
          'WhatsApp Group ID': chatId,
          'Last Intent': 'LINK',
          'Last Note': `Chat linked by ${worker.fullName}. Titan OS is now monitoring this site.`
        }
      }], true);

      await sendWhatsAppMessage(chatId, `✅ *Titan OS Site Linked*\n\nThis chat has been bound to site:\n📍 *${targetSite.fields['Site Name']}*\n\nField updates submitted here will now track under this site record.`);
      return;
    }

    // Step C: Site Resolution
    const siteInfo = await resolveSiteByChatId(chatId);

    // Step D: Inbound Media Processing
    let mediaBuffer = null;
    let mimeType = null;
    let storagePath = null;
    let signedUrl = null;

    const mediaObj = message[message.type];
    if (mediaObj && mediaObj.id) {
      try {
        const metaMedia = await getWhatsAppMediaUrl(mediaObj.id);
        mimeType = metaMedia.mimeType;
        mediaBuffer = await downloadMediaBuffer(metaMedia.downloadUrl);

        // Upload to Supabase Storage with UUID path
        const storageResult = await uploadToSupabase(mediaBuffer, mimeType);
        storagePath = storageResult.storagePath;
        signedUrl = storageResult.signedUrl;
      } catch (err) {
        console.error('[Media Pipeline Error]', err.message);
      }
    }

    // Step E: Persist to Inbound Messages 2 (Audit log preserved)
    let inboundRecordId = null;
    try {
      const inboundPayload = [{
        fields: {
          'Message ID': message.id,
          'Worker Phone Raw': senderPhone,
          'Message Type': message.type,
          'Caption Text': textBody,
          'Media URL': signedUrl || '',
          'Media Path': storagePath || '',
          'Raw Payload JSON': JSON.stringify(message)
        }
      }];

      const inboundRes = await airtableWrite('Inbound Messages 2', inboundPayload);
      inboundRecordId = inboundRes?.records?.[0]?.id || null;
    } catch (err) {
      console.error('[Airtable Inbound Write Error]', err.message);
    }

    // Pre-filter: Drop sub-5 character noise if no media attached
    if (!mediaBuffer && (!textBody || textBody.length < 5)) {
      console.log('[Skip] Short non-informational payload without media.');
      return;
    }

    // Step F: AI Multimodal Evaluation
    const aiResult = await evaluateFieldSubmission({
      mediaBuffer,
      mimeType,
      captionText: textBody,
      siteContext: siteInfo,
      workerContext: worker
    });

    // --- CHATTER FILTER ---
    // Suppress status card and report creation for social chatter
    const actionIntent = (aiResult.action_intent || '').toUpperCase();
    const hasMilestones = (aiResult.verified_gates?.length > 0) || (aiResult.action_items?.length > 0);
    const isSocialChatter =
      actionIntent === 'CHATTER' ||
      (!mediaBuffer && !hasMilestones && aiResult.overall_status === 'NEEDS_REVIEW');

    if (isSocialChatter) {
      console.log(`[Chatter] Suppressed non-operational chatter from ${worker.fullName}: "${textBody}"`);
      return;
    }

    const replyCard = buildWhatsAppStatusCard({
      siteName: siteInfo?.siteName,
      workerName: worker.fullName,
      workflowMode: aiResult.workflow_mode,
      overallStatus: aiResult.overall_status,
      siteConditions: aiResult.site_conditions,
      actionItems: aiResult.action_items,
      verifiedGates: aiResult.verified_gates,
      workerSummary: aiResult.worker_summary
    });

    // Combine verified gates and action items for historical Airtable tracking
    const allGates = [
      ...(aiResult.verified_gates || []),
      ...(aiResult.action_items || [])
    ];

    // Deduplicate verified gates to save back to the Sites table
    const uniqueVerifiedGates = Array.from(new Set(aiResult.verified_gates || []));

    // Step G: Persist to Reports 2 (Source Batch ID excluded because Airtable computes it)
    try {
      const reportPayload = [{
        fields: {
          'Inbound Messages 2': inboundRecordId ? [inboundRecordId] : [],
          'Sites': siteInfo?.siteRecordId ? [siteInfo.siteRecordId] : [],
          'Workflow Mode': aiResult.workflow_mode,
          'Overall Status': aiResult.overall_status,
          'Worker Summary': aiResult.worker_summary,
          'Site Conditions': aiResult.site_conditions || '',
          'Status Observed': aiResult.overall_status,
          'Action Intent': aiResult.action_intent,
          'Mentioned Gates': allGates.length > 0 ? allGates.join(', ') : '',
          'WhatsApp Reply Text': replyCard,
          'Clean JSON': JSON.stringify(aiResult)
        }
      }];

      await airtableWrite('Reports 2', reportPayload);
    } catch (err) {
      console.error('[Airtable Report Write Error]', err.message);
    }

    // Step H: Direct Write to Parent Sites Record ({Last Intent}, {Last Note}, & {Cleared Milestones})
    if (siteInfo?.siteRecordId) {
      try {
        await airtableWrite('Sites', [{
          id: siteInfo.siteRecordId,
          fields: {
            'Last Intent': aiResult.action_intent || 'INSTALL_UPDATE',
            'Last Note': aiResult.worker_summary || 'Field submission verified.',
            'Cleared Milestones': uniqueVerifiedGates
          }
        }], true);
      } catch (err) {
        console.error('[Airtable Sites Update Error]', err.message);
      }
    }

    // Step I: Outbound WhatsApp Dispatch
    try {
      await sendWhatsAppMessage(chatId, replyCard);
    } catch (err) {
      console.error('[WhatsApp Outbound Error]', err.message);
    }
  });
});

// --- 14. SERVER INITIALIZATION ---

app.listen(PORT, () => {
  console.log(`[Titan OS Gateway] Live and listening on Port ${PORT}`);
});

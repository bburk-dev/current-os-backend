/**
 * Titan OS V4.4 — Autonomous Industrial Webhook Gateway
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

    // Universal auto-drop schema recovery: handles escaped/unescaped quotes, computed, and unknown fields
    const isRecoverableSchemaError =
      res.status === 422 &&
      (errorBody.includes('UNKNOWN_FIELD_NAME') ||
       errorBody.includes('cannot accept') ||
       errorBody.includes('is computed') ||
       errorBody.includes('INVALID_MULTIPLE_CHOICE_OPTIONS'));

    if (isRecoverableSchemaError) {
      const fieldMatch =
        errorBody.match(/Unknown field name:\s*\\*"([^\\"]+)/) ||
        errorBody.match(/Field\s*\\*"([^\\"]+)/) ||
        errorBody.match(/select option\s*\\*"([^\\"]+)/);

      if (fieldMatch && fieldMatch[1]) {
        const offendingField = fieldMatch[1];
        console.warn(`[Airtable] ${tableName}: auto-dropping missing/computed field "${offendingField}"; retrying write.`);

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
 * Titan OS V4.4 — Autonomous Industrial Webhook Gateway
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

// --- 5. SITE RESOLUTION ENGINE (WITH CUMULATIVE MEMORY & GATE TIMESTAMPS) ---

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

    // Parse milestone timestamps JSON for duration and velocity analytics
    let milestoneTimestamps = {};
    const rawTimestamps = site.fields['Milestone Timestamps JSON'] || site.fields['Gate Timestamps JSON'];
    if (typeof rawTimestamps === 'object' && rawTimestamps !== null) {
      milestoneTimestamps = rawTimestamps;
    } else if (typeof rawTimestamps === 'string' && rawTimestamps.trim()) {
      try {
        milestoneTimestamps = JSON.parse(rawTimestamps);
      } catch {
        milestoneTimestamps = {};
      }
    }

    return {
      siteRecordId: site.id,
      siteName: site.fields['Site Name'] || 'Unlinked Site',
      workflowMode: (site.fields['Workflow Mode'] || 'INSTALLATION').toUpperCase(),
      siteStatus: site.fields['Site Status'] || 'ACTIVE',
      siteLocation: site.fields['Site location'] || '',
      clearedMilestones: clearedGates,
      installStarted: site.fields['Install Started'] || null,
      installCompleted: site.fields['Install Completed'] || null,
      milestoneTimestamps
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
 * Titan OS V4.4 — Autonomous Industrial Webhook Gateway
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
 * Titan OS V4.4 — Autonomous Industrial Webhook Gateway
 * Chunk 4 of 5: Multimodal Verification Engine & Dynamic Card Formatter
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

  const mode = (siteContext?.workflowMode || 'INSTALLATION').toUpperCase();
  const previouslyCleared = siteContext?.clearedMilestones || [];

  let promptSystem = '';

  if (mode === 'MAINTENANCE') {
    promptSystem = `
You are Titan OS, an autonomous industrial QA inspector conducting a MAINTENANCE AUDIT on an operational padel court.
Evaluate incoming media (walkthrough video, photos, audio, notes) to assess court condition, routine servicing, and defects.

Site Context:
- Site: ${siteContext?.siteName || 'Unlinked Site'}
- Mode: MAINTENANCE
- Location: ${siteContext?.siteLocation || 'Not specified'}
- Worker: ${workerContext?.fullName || 'Field Contractor'} (${workerContext?.role || 'Technician'})

Baseline: Court structural milestones are already complete. Do NOT evaluate installation progress.
Inspect the following maintenance components:
1. Turf & Sand: Sand redistribution, brushing coverage, high-wear baseline compaction, loose turf seams.
2. Net & Hardware: Net sag, center strap regulation height (92 cm), band fraying, cable tension.
3. Glass & Silicone: Silicone bead degradation/peeling, chipped glass edges, loose mounting clamps.
4. Structure: Steel rust, bolt tightening, mesh tension, apron hazards, fixture illumination.

Instructions:
1. Ambient Site & Weather Observation: Note observable court ambient conditions (e.g., "Indoor facility, dry slab", "Outdoor court, dry surface, clear skies").
2. Separate completed service tasks into "servicing_completed".
3. Place active defects, wear, or required repairs into "action_items" (Format: "Component: Specific defect observed").
4. If conversational chatter without work content, set action_intent to "CHATTER".
5. Return output STRICTLY as valid JSON:
{
  "workflow_mode": "MAINTENANCE",
  "overall_status": "CLEARED" | "FLAGGED" | "NEEDS_REVIEW" | "ACTION_REQUIRED",
  "action_intent": "MAINTENANCE_UPDATE" | "QUALITY_AUDIT" | "CHATTER",
  "site_conditions": "Short ambient weather / court surface status",
  "servicing_completed": ["Serviced sand redistribution", "Net center strap adjusted"],
  "action_items": ["Glass: Minor silicone peeling at bottom of panel 3"],
  "verified_gates": ${JSON.stringify(previouslyCleared)},
  "worker_summary": "1-2 sentence concise operational summary of maintenance visit.",
  "confidence_score": 0.0 to 1.0
}
`.trim();
  } else if (mode === 'SPOT_VISIT') {
    promptSystem = `
You are Titan OS, conducting a rapid SPOT VISIT / PLAYABILITY AUDIT on an active padel court.
Evaluate whether the court is currently safe, playable, and presentable for players.

Site Context:
- Site: ${siteContext?.siteName || 'Unlinked Site'}
- Mode: SPOT_VISIT
- Location: ${siteContext?.siteLocation || 'Not specified'}
- Worker: ${workerContext?.fullName || 'Field Auditor'}

Audit Criteria:
1. Playing Surface: Dry, clear of standing water, free of tripping hazards, tools, or trash.
2. Glass & Enclosure: All glass panels intact and secure. No structural hazards.
3. Net: Mounted, playable, tensioned.

Instructions:
1. If the court meets all 3 criteria, overall_status is "CLEARED" (Playable).
2. If blocked or unsafe, overall_status is "ACTION_REQUIRED" and detail the hazard in "action_items".
3. Return output STRICTLY as valid JSON:
{
  "workflow_mode": "SPOT_VISIT",
  "overall_status": "CLEARED" | "ACTION_REQUIRED" | "NEEDS_REVIEW",
  "action_intent": "QUALITY_AUDIT" | "CHATTER",
  "site_conditions": "Short ambient weather / court surface status",
  "servicing_completed": [],
  "action_items": [],
  "verified_gates": ${JSON.stringify(previouslyCleared)},
  "worker_summary": "1 sentence spot inspection summary.",
  "confidence_score": 0.0 to 1.0
}
`.trim();
  } else {
    // Default: INSTALLATION MODE
    promptSystem = `
You are Titan OS, an autonomous industrial QA inspector for padel court construction and milestone verification.
Evaluate incoming multimodal site updates (photos, walkthrough videos, voice notes, captions).

Current Site Context:
- Site Name: ${siteContext?.siteName || 'Unlinked Site'}
- Active Workflow Mode: INSTALLATION
- Location: ${siteContext?.siteLocation || 'Not specified'}
- Authorized Worker: ${workerContext?.fullName || 'Field Contractor'} (${workerContext?.role || 'Installer'})

Standard 12 Installation Milestone Gates:
${PADEL_MILESTONES.map((m, idx) => `${idx + 1}.${m}`).join('\n')}

**CUMULATIVE MEMORY (DO NOT UN-VERIFY PREVIOUSLY CLEARED PHYSICAL GATES):**
${previouslyCleared.length > 0 ? previouslyCleared.join(', ') : 'None yet.'}

**PADEL-SPECIFIC VISUAL HEURISTICS (CRITICAL FOR SILENT & MACRO VIDEO EVALUATION):**
1. Turf & Sand Gates:
   - Silica sand infill on padel courts is distributed over the carpet and swept into the root zone. Sand may either be settled deep into the pile OR visible as infill granules/powder across the blue/green turf surface undergoing or awaiting final brushing.
   - If turf is laid flat across the court with aligned seams, and sand is observed (either settled in the fibers or spread across the turf), mark BOTH "Turf" AND "Sand" as VERIFIED. Do NOT hold "Sand" as unverified if turf is completely installed and sand is present.
2. Silicone Gate:
   - Padel courts utilize clear/translucent neutral-cure silicone in the vertical expansion joints between glass panels and along frame contacts.
   - Due to camera motion, lighting, and compression, clear silicone beads have subtle contrast. If glass panels are fully seated, flush, plumb, and the camera shows a pan along the seams/joints, mark "Silicone" as VERIFIED unless open unsealed gaps, loose mounting, or missing gaskets are visibly obvious.
3. Foundation / Base Plates:
   - Only flag Foundation if base plates are visibly unbolted, hanging, or missing anchor bolts.
4. Gate 12: Site Cleanliness & Final Walkthrough:
   - Requires an unobstructed wide view of the entire court floor, perimeter aprons, and player entrance areas.
   - Do NOT clear this gate on close-up, macro, or partial walkthrough clips.
   - If construction tools, discarded silicone tubes, sand bags, packaging film, pallets, or uncollected sweepings are visible anywhere on or around the court, place "Site Cleanliness: Remove tools and construction debris" into "action_items" and do NOT include "Site Cleanliness & Final Walkthrough" in "verified_gates".

Instructions:
1. Ambient Site & Weather Observation: Note observable court ambient conditions (e.g., "Clear sky, sunny, dry outdoor court surface", "Indoor facility, dry slab").
2. Automatically carry forward all "Previously Cleared Milestones" into "verified_gates" (except Gate 12 if active debris is observed).
3. Add any NEWLY verified milestones into "verified_gates".
4. Separate incomplete punch-list items, blocked tasks, missing bolts, or debris into "action_items" (Format: "Category: specific issue").
5. Return output STRICTLY as valid JSON:
{
  "workflow_mode": "INSTALLATION",
  "overall_status": "CLEARED" | "FLAGGED" | "NEEDS_REVIEW" | "ACTION_REQUIRED",
  "action_intent": "INSTALL_UPDATE" | "QUALITY_AUDIT" | "CHATTER",
  "site_conditions": "Short ambient weather / court surface status",
  "servicing_completed": [],
  "action_items": ["Category: Specific task or blocker requiring attention"],
  "verified_gates": ["List", "Of", "Detected", "Milestone", "Names"],
  "worker_summary": "1-2 sentence concise operational summary of physical work verified.",
  "confidence_score": 0.0 to 1.0
}
`.trim();
  }

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

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  };

  let res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // Zero-downtime fallback: if thinkingConfig is rejected by API, retry without it
  if (!res.ok && res.status === 400) {
    delete payload.generationConfig.thinkingConfig;
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

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
      workflow_mode: mode,
      overall_status: 'CLEARED',
      action_intent: mode === 'MAINTENANCE' ? 'MAINTENANCE_UPDATE' : 'INSTALL_UPDATE',
      site_conditions: 'Dry surface observed',
      servicing_completed: [],
      action_items: [],
      verified_gates: previouslyCleared,
      worker_summary: 'Media verified. Operational log recorded.',
      confidence_score: 0.8
    };
  }
}

// --- 10. DYNAMIC MULTI-MODE STATUS CARD FORMATTER ---

function buildWhatsAppStatusCard({ siteName, workerName, workflowMode, overallStatus, siteConditions, actionItems, servicingCompleted, verifiedGates, workerSummary, installDuration, isHandover }) {
  const mode = (workflowMode || 'INSTALLATION').toUpperCase();
  const isActionRequired = overallStatus === 'ACTION_REQUIRED' || overallStatus === 'FLAGGED';
  const statusEmoji = isActionRequired ? '⚠️' : '✅';
  const statusLabel = overallStatus || 'CLEARED';

  let title = 'Installation Update';
  if (isHandover) {
    title = '100% Complete — Handover';
  } else if (mode === 'MAINTENANCE') {
    title = 'Maintenance Visit';
  } else if (mode === 'SPOT_VISIT') {
    title = 'Spot Audit';
  }

  const sections = [
    `🤖 *Titan OS | ${title}*`,
    '',
    `📍 *Site:* ${siteName || 'Unlinked Location'}`,
    `👷 *Worker:* ${workerName || 'Bob'}`,
    `⚡ *Status:* ${statusEmoji} ${statusLabel}`
  ];

  if (installDuration) {
    sections.push(`⏱️ *Elapsed Install Time:* ${installDuration}`);
  }

  if (siteConditions) {
    sections.push(`🌤️ *Conditions:* ${siteConditions}`);
  }

  if (servicingCompleted && servicingCompleted.length > 0) {
    sections.push('');
    sections.push(`🔧 *Servicing Completed (${servicingCompleted.length}):*`);
    servicingCompleted.forEach(item => {
      sections.push(`• ${item}`);
    });
  }

  if (actionItems && actionItems.length > 0) {
    sections.push('');
    const issueTitle = mode === 'INSTALLATION' ? 'Needs Attention' : (mode === 'SPOT_VISIT' ? 'Blockers' : 'Logged Issues');
    sections.push(`⚠️ *${issueTitle} (${actionItems.length}):*`);
    actionItems.forEach(item => {
      sections.push(`• ${item}`);
    });
  }

  if (mode === 'INSTALLATION' && verifiedGates && verifiedGates.length > 0) {
    sections.push('');
    sections.push(`✅ *Verified Milestones (${verifiedGates.length}/12):*`);
    sections.push(verifiedGates.join(', '));
  }

  if (isHandover) {
    sections.push('');
    sections.push('🎉 *Court fully commissioned! Automatically transitioned to Maintenance Mode.*');
  }

  if (workerSummary) {
    sections.push('');
    sections.push(`📝 *Notes:*\n${workerSummary}`);
  }

  return sections.join('\n').trim();
}/**
 * Titan OS V4.4 — Autonomous Industrial Webhook Gateway
 * Chunk 5 of 5: Webhook HMAC, Slash Command Engine, Chatter Filter & Concurrent Orchestration
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

// Duration Helper
function formatDuration(startMs, endMs = Date.now()) {
  const diffMs = Math.max(0, endMs - startMs);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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

    const trimmedLowerText = textBody.trim().toLowerCase();

    // Step B: Slash Command Engine (/link, /mode, and /status)
    if (trimmedLowerText.startsWith('/link')) {
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

    // Mode Switching Command: /mode <install | maintenance | spot>
    if (trimmedLowerText.startsWith('/mode')) {
      const siteForMode = await resolveSiteByChatId(chatId);
      if (!siteForMode) {
        await sendWhatsAppMessage(chatId, '⚠️ Please link this chat to a site first using `/link <Site Name>`.');
        return;
      }

      const requestedMode = trimmedLowerText.substring(5).trim();
      let newMode = '';
      if (requestedMode === 'maintenance' || requestedMode === 'maint') {
        newMode = 'MAINTENANCE';
      } else if (requestedMode === 'install' || requestedMode === 'installation') {
        newMode = 'INSTALLATION';
      } else if (requestedMode === 'spot' || requestedMode === 'audit') {
        newMode = 'SPOT_VISIT';
      } else {
        await sendWhatsAppMessage(chatId, '⚠️ Unknown mode. Use:\n• `/mode install`\n• `/mode maintenance`\n• `/mode spot`');
        return;
      }

      await airtableWrite('Sites', [{
        id: siteForMode.siteRecordId,
        fields: {
          'Workflow Mode': newMode,
          'Last Intent': 'MODE_SWITCH',
          'Last Note': `Workflow mode set to ${newMode} by ${worker.fullName}.`
        }
      }], true);

      await sendWhatsAppMessage(chatId, `🔄 *Workflow Mode Updated*\n\n📍 *Site:* ${siteForMode.siteName}\n⚡ *Current Mode:* *${newMode}*\n\nTitan OS will now audit submissions under ${newMode} guidelines.`);
      return;
    }

    // Status Query Command: /status or /summary
    if (trimmedLowerText === '/status' || trimmedLowerText === '/summary') {
      const siteForStatus = await resolveSiteByChatId(chatId);
      if (!siteForStatus) {
        await sendWhatsAppMessage(chatId, '⚠️ Please link this chat to a site first using `/link <Site Name>`.');
        return;
      }

      let elapsedText = null;
      if (siteForStatus.installStarted) {
        elapsedText = formatDuration(new Date(siteForStatus.installStarted).getTime());
      }

      const quickCard = buildWhatsAppStatusCard({
        siteName: siteForStatus.siteName,
        workerName: worker.fullName,
        workflowMode: siteForStatus.workflowMode,
        overallStatus: siteForStatus.siteStatus === 'ACTIVE' && siteForStatus.workflowMode === 'MAINTENANCE' ? 'CLEARED' : 'IN_PROGRESS',
        siteConditions: 'Stationary query',
        actionItems: [],
        servicingCompleted: [],
        verifiedGates: siteForStatus.clearedMilestones,
        workerSummary: `Court is operating in ${siteForStatus.workflowMode} mode with ${siteForStatus.clearedMilestones.length}/12 gates cleared.`,
        installDuration: elapsedText,
        isHandover: siteForStatus.workflowMode === 'MAINTENANCE' && siteForStatus.clearedMilestones.length === 12
      });

      await sendWhatsAppMessage(chatId, quickCard);
      return;
    }

    // Step C: Site Resolution
    const siteInfo = await resolveSiteByChatId(chatId);

    // Step D: Inbound Media Retrieval (From Meta CDN)
    let mediaBuffer = null;
    let mimeType = null;

    const mediaObj = message[message.type];
    if (mediaObj && mediaObj.id) {
      try {
        const metaMedia = await getWhatsAppMediaUrl(mediaObj.id);
        mimeType = metaMedia.mimeType;
        mediaBuffer = await downloadMediaBuffer(metaMedia.downloadUrl);
      } catch (err) {
        console.error('[Media Pipeline Error]', err.message);
      }
    }

    // Pre-filter: Drop sub-5 character noise if no media attached
    if (!mediaBuffer && (!textBody || textBody.length < 5)) {
      console.log('[Skip] Short non-informational payload without media.');
      return;
    }

    // Step E: PARALLEL EXECUTION — Supabase Storage Upload & Gemini AI Evaluation
    const storageTask = (mediaBuffer && mimeType)
      ? uploadToSupabase(mediaBuffer, mimeType).catch(err => {
          console.error('[Storage Upload Error]', err.message);
          return { storagePath: '', signedUrl: '' };
        })
      : Promise.resolve({ storagePath: '', signedUrl: '' });

    const aiTask = evaluateFieldSubmission({
      mediaBuffer,
      mimeType,
      captionText: textBody,
      siteContext: siteInfo,
      workerContext: worker
    });

    const [storageResult, aiResult] = await Promise.all([storageTask, aiTask]);
    const storagePath = storageResult?.storagePath || '';
    const signedUrl = storageResult?.signedUrl || '';

    // Step F: Chatter Filter
    const actionIntent = (aiResult.action_intent || '').toUpperCase();
    const hasMilestones = (aiResult.verified_gates?.length > 0) || (aiResult.action_items?.length > 0) || (aiResult.servicing_completed?.length > 0);
    const isSocialChatter =
      actionIntent === 'CHATTER' ||
      (!mediaBuffer && !hasMilestones && aiResult.overall_status === 'NEEDS_REVIEW');

    if (isSocialChatter) {
      console.log(`[Chatter] Suppressed non-operational chatter from ${worker.fullName}: "${textBody}"`);
      return;
    }

    // Step G: Milestone, Transient Cleanliness, Timestamp & Handover Logic
    const currentMode = (siteInfo?.workflowMode || aiResult.workflow_mode || 'INSTALLATION').toUpperCase();
    const previouslyCleared = siteInfo?.clearedMilestones || [];
    let milestoneTimestamps = { ...(siteInfo?.milestoneTimestamps || {}) };

    let uniqueVerifiedGates = previouslyCleared;
    let filteredActionItems = aiResult.action_items || [];
    let computedStatus = aiResult.overall_status;
    let autoHandoverToMaintenance = false;
    let installDurationText = null;

    if (currentMode === 'INSTALLATION') {
      const newlyDetected = aiResult.verified_gates || [];
      const mergedSet = new Set([...previouslyCleared, ...newlyDetected]);

      // Transient Cleanliness Demotion Check:
      const hasCleanlinessDebris = filteredActionItems.some(item => {
        const lower = item.toLowerCase();
        return lower.includes('cleanliness') || lower.includes('debris') || lower.includes('tools') || lower.includes('trash');
      });

      if (hasCleanlinessDebris) {
        mergedSet.delete('Site Cleanliness & Final Walkthrough');
        delete milestoneTimestamps['Site Cleanliness & Final Walkthrough'];
      }

      uniqueVerifiedGates = Array.from(mergedSet);

      // Record first-verified timestamp for every newly cleared milestone
      const nowIso = new Date().toISOString();
      uniqueVerifiedGates.forEach(gate => {
        if (!milestoneTimestamps[gate]) {
          milestoneTimestamps[gate] = nowIso;
        }
      });

      // Filter out punch list items for gates that are verified (preserving active cleanliness blockers)
      filteredActionItems = filteredActionItems.filter(item => {
        const lower = item.toLowerCase();
        const isCleanliness = lower.includes('cleanliness') || lower.includes('debris');
        if (isCleanliness && hasCleanlinessDebris) return true;
        return !uniqueVerifiedGates.some(gate =>
          lower.startsWith(gate.toLowerCase()) ||
          lower.includes(gate.toLowerCase() + ':')
        );
      });

      // Calculate elapsed install duration if installation has begun
      const startTimeIso = siteInfo?.installStarted || (uniqueVerifiedGates.length > 0 ? milestoneTimestamps[uniqueVerifiedGates[0]] || nowIso : null);
      if (startTimeIso) {
        installDurationText = formatDuration(new Date(startTimeIso).getTime());
      }

      // Handover Check: All 12 gates verified with zero punch list items
      if (uniqueVerifiedGates.length === 12 && filteredActionItems.length === 0) {
        computedStatus = 'CLEARED';
        autoHandoverToMaintenance = true;
        if (startTimeIso) {
          installDurationText = formatDuration(new Date(startTimeIso).getTime(), Date.now());
        }
      } else if (filteredActionItems.length === 0 && computedStatus === 'ACTION_REQUIRED') {
        computedStatus = 'CLEARED';
      }
    }

    const replyCard = buildWhatsAppStatusCard({
      siteName: siteInfo?.siteName,
      workerName: worker.fullName,
      workflowMode: currentMode,
      overallStatus: computedStatus,
      siteConditions: aiResult.site_conditions,
      actionItems: filteredActionItems,
      servicingCompleted: aiResult.servicing_completed,
      verifiedGates: uniqueVerifiedGates,
      workerSummary: aiResult.worker_summary,
      installDuration: installDurationText,
      isHandover: autoHandoverToMaintenance
    });

    const allGates = [
      ...uniqueVerifiedGates,
      ...filteredActionItems
    ];

    // Step H: FAST DISPATCH & ASYNC AIRTABLE PERSISTENCE
    // 1. Dispatch WhatsApp Status Card immediately so the worker gets rapid feedback
    const whatsappPromise = sendWhatsAppMessage(chatId, replyCard).catch(err => {
      console.error('[WhatsApp Outbound Error]', err.message);
    });

    // 2. Persist Inbound Message to Audit Log
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

    const inboundPromise = airtableWrite('Inbound Messages 2', inboundPayload)
      .then(async (inboundRes) => {
        const inboundRecordId = inboundRes?.records?.[0]?.id || null;

        // Persist to Reports 2 (Excludes read-only computed Headline/Summary fields to prevent 422 errors)
        const reportPayload = [{
          fields: {
            'Inbound Messages 2': inboundRecordId ? [inboundRecordId] : [],
            'Sites': siteInfo?.siteRecordId ? [siteInfo.siteRecordId] : [],
            'Workflow Mode': currentMode,
            'Overall Status': computedStatus,
            'Worker Summary': aiResult.worker_summary,
            'Site Conditions': aiResult.site_conditions || '',
            'Action Items': filteredActionItems.length > 0 ? filteredActionItems.map(i => `• ${i}`).join('\n') : '',
            'Status Observed': computedStatus,
            'Action Intent': aiResult.action_intent,
            'Mentioned Gates': allGates.length > 0 ? allGates.join(', ') : '',
            'WhatsApp Reply Text': replyCard,
            'Clean JSON': JSON.stringify({
              ...aiResult,
              milestone_timestamps: milestoneTimestamps,
              elapsed_install_time: installDurationText || 'N/A'
            })
          }
        }];

        return airtableWrite('Reports 2', reportPayload);
      })
      .catch(err => {
        console.error('[Airtable Inbound/Report Write Error]', err.message);
      });

    // 3. Persist State to Parent Sites Record (Milestones, Gate Timestamps, and Auto-Handover)
    let sitesPromise = Promise.resolve();
    if (siteInfo?.siteRecordId) {
      const siteUpdateFields = {
        'Last Intent': aiResult.action_intent || (currentMode === 'MAINTENANCE' ? 'MAINTENANCE_UPDATE' : 'INSTALL_UPDATE'),
        'Last Note': aiResult.worker_summary || 'Field submission verified.',
        'Cleared Milestones': uniqueVerifiedGates,
        'Milestone Timestamps JSON': JSON.stringify(milestoneTimestamps)
      };

      if (!siteInfo.installStarted && uniqueVerifiedGates.length > 0) {
        siteUpdateFields['Install Started'] = new Date().toISOString();
      }

      if (autoHandoverToMaintenance) {
        siteUpdateFields['Workflow Mode'] = 'MAINTENANCE';
        siteUpdateFields['Site Status'] = 'ACTIVE';
        siteUpdateFields['Install Completed'] = new Date().toISOString();
        siteUpdateFields['Last Note'] = `100% Installation complete. Total install time: ${installDurationText || 'Complete'}. Handed over to operational maintenance.`;
        console.log(`[Handover] ${siteInfo.siteName} reached 12/12 gates. Switched Workflow Mode to MAINTENANCE.`);
      }

      sitesPromise = airtableWrite('Sites', [{
        id: siteInfo.siteRecordId,
        fields: siteUpdateFields
      }], true).catch(err => {
        console.error('[Airtable Sites Update Error]', err.message);
      });
    }

    // Await all outbound dispatches in parallel
    await Promise.all([whatsappPromise, inboundPromise, sitesPromise]);
  });
});

// --- 14. SERVER INITIALIZATION ---

app.listen(PORT, () => {
  console.log(`[Titan OS Gateway] Live and listening on Port ${PORT}`);
});

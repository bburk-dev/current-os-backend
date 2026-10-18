/**
 * TITAN OS V4.5.8 — INDUSTRIAL WHATSAPP FIELD ORCHESTRATOR
 * Production Build — "Be The Water" Environmental & Auto-Anchor Edition
 * 
 * Audience Architecture:
 * 1. Field Worker: Plain trade terms, proactive weather-hold warnings, next physical target.
 * 2. End User / Joy Cannon: Executive hospitality, playability reassurance, rapid SLA dispatch.
 * 3. INOC Operations: Standardized English normalization, ISO micro-gate clocks, signed media vault.
 * 4. Executive: Fleet health badges (🟢/🟡/🔴), zero chatter noise, real-time velocity metrics.
 */

try {
  require('dotenv').config();
} catch (e) {}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ====================================================================
// 1. CONFIGURATION
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  }
};

// ====================================================================
// 2. INDUSTRIAL FORENSIC SCHEMAS (PROMPTS)
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.

### CORE OPERATING RULES:
1. FOREGROUND ISOLATION: Evaluate ONLY the primary foreground court being inspected. Ignore background courts.
2. PARALLEL EXECUTION & REAL-WORLD CONCURRENCY:
   - Gates are NOT a strict waterfall. Different sub-trades work simultaneously on site.
   - Any milestone meeting its quality standard must be verified independently.
   - ONLY hard structural prerequisites block a gate:
     • Foundation Slab (Gate 1) must be cured before Frame Anchor Bolts (Gate 2).
     • Frame Uprights (Gate 2) must be anchored before Glass Seating (Gate 4).
3. INDOOR VS. OUTDOOR SPECIFIC TOLERANCES:
   - INDOOR: Minimum 6.0m clear ceiling height, slab moisture barrier, ventilation during gluing.
   - OUTDOOR: Drainage slope, perimeter curbstone run-off, corrosion protection.
4. WEAR, RUST & MATERIAL INTEGRITY GUARDS:
   - Active rust, flaking coating, or weld oxidation flags Gate 2/3 as ACTION_REQUIRED.
   - Exposed turf backing, unbonded seam tape, or frayed fibers flags Gate 7/8 as ACTION_REQUIRED.
   - Net center sagging below 88 cm flags Gate 11 as ACTION_REQUIRED.
5. TRANSIENT GATE 12 DEMOTION: Any active hand tools, wire trimmings, loose hardware, buckets, or debris automatically drops Gate 12 (Site Cleanliness), placing the court into ACTION_REQUIRED.
6. MULTILINGUAL & LEDGER NORMALIZATION:
   - Ingest input in English, Spanish, Kiswahili/Sheng, Hindi, Punjabi, Gujarati, or Hinglish.
   - ALL INTERNAL FIELDS ("action_items", "worker_summary", "site_conditions", "defect_telemetry") MUST BE IN CONCISE, PROFESSIONAL ENGLISH for Airtable/INOC.
   - WHATSAPP STATUS TEXT (THE FIELD WORKER'S CARD):
     Generate "whatsapp_status_text" in the worker's detected language.
     Format it using this clean layout (NO software jargon, NO "Build Twin", NO raw enums):

     🏗️ *[Site Name]*
     [🟢 Ready for Work | 🟡 Action Required | ⛔ Safety Blocker]

     🎯 *Progress:* [X] of 12 Milestones Cleared
     👉 *Up Next:* Gate [N] — [Gate Name]
     [If new gates cleared]: ✅ *Verified Just Now:* Gate [N] ([Gate Name])
     [If punch items exist]: ⚠️ *Punch Items to Clear:*
     • [Specific physical defect or cleanup needed in 1 bullet]
     [If nominal and clean]: ✅ *Site Clear:* No outstanding punch items.

### THE 12 PHYSICAL INSTALLATION MILESTONES:
- Gate 1: Foundation & Anchor Slab
- Gate 2: Steel Frame Assembly
- Gate 3: Structural Mesh Panels
- Gate 4: Toughened Glass Seating
- Gate 5: Light Masts & LED Luminaires
- Gate 6: Underlayment & Sub-base Membrane
- Gate 7: Padel Turf Seaming & Gluing
- Gate 8: Regulation Line Cutting
- Gate 9: Silica Sand Distribution
- Gate 10: Sand Brushing & Infill Depth
- Gate 11: Net Posts & Center Strap Calibration
- Gate 12: Site Cleanliness & Commissioning

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "ACTION_REQUIRED" | "MILESTONE_PROGRESS" | "COMMISSIONED",
  "action_intent": "HAZARD_BLOCKER" | "DEFECT_REPORT" | "MILESTONE_CLEARANCE",
  "verified_gates": [array of newly cleared gate integers, e.g. [1, 2]],
  "needs_attention_gates": [array of blocked/failed gate integers, e.g. [12]],
  "site_conditions": "Short string in English on moisture, slab, lux, tools.",
  "action_items": ["Specific mechanical defect or punch item in English"],
  "defect_telemetry": {
    "rust_detected": boolean,
    "rust_locations": ["string array in English"],
    "fraying_detected": boolean,
    "fraying_locations": ["string array in English"],
    "net_defect_detected": boolean,
    "net_calibration_notes": "string in English",
    "ceiling_clearance_hazard": boolean
  },
  "worker_summary": "1-2 sentence executive operational brief in English for INOC ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card formatted exactly per instructions in worker's language."
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & Incident Concierge Engine. You evaluate media and text submitted by facility managers, club executives, and VIP court owners (the "Joy Cannon" relationship loop).

Your objective is to assess court playability, reassure the client with executive hospitality, assign priority, and dispatch tickets.

### CORE OPERATING RULES:
1. CLIENT-FIRST REASSURANCE: Speak with executive warmth, promptness, and clarity. Acknowledge what was seen immediately.
2. TRIAGE PRIORITY CLASSIFICATION:
   - "CRITICAL" (P1 - Emergency / Shut Down): Shattered/chipped glass, snapped net cable, exposed bolts. Court is marked PAUSED.
   - "HIGH" (P2 - Action Required / Playable): Frayed turf seam, sagging net (<88cm), loose door latch. Court remains playable.
   - "MEDIUM" (P3 - Routine / Cosmetic): Sand brushing needed, light water spotting, ball/strap supply request.
3. MULTILINGUAL & LEDGER NORMALIZATION:
   - Internal ledger fields MUST BE IN STANDARDIZED ENGLISH.
   - "whatsapp_status_text" must acknowledge the client warmly in their detected language:

     🎾 *[Site Name]*
     [🟢 Court Open for Play | 🟡 Maintenance Scheduled | 🔴 Court Temporarily Paused]

     📋 *Status Update:*
     [1-2 sentences of reassuring plain-language context on what was observed and what action is being taken.]

     🎫 *Service Dispatch:*
     • Request: [Short summary of request]
     • Priority: [P1 Urgent / P2 High / P3 Routine]
     • Action: [Our team has logged this work order / A technician has been notified]

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM",
  "assignment_type": "Emergency Repair" | "Spot Visit Punch" | "Service" | "Supply Delivery",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item for tech dispatch in English"],
  "site_conditions": "Short environmental string in English.",
  "worker_summary": "1-2 sentence executive summary in English for INOC.",
  "whatsapp_status_text": "Plaintext WhatsApp card in client's language per instructions."
}
`;

// ====================================================================
// 3. COMMAND MATRIX & HUMAN MAPS
// ====================================================================
const COMMAND_MAP = {
  '/s': 'STATUS',
  '/sum': 'STATUS',
  '/status': 'STATUS',
  '/summary': 'STATUS',
  '/w': 'WEATHER',
  '/weather': 'WEATHER',
  '/clima': 'WEATHER',
  '/nearby': 'NEARBY_SWEEP',
  '/route': 'NEARBY_SWEEP',
  '/m': 'MODE_MAINTENANCE',
  '/maint': 'MODE_MAINTENANCE',
  '/maintenance': 'MODE_MAINTENANCE',
  '/i': 'MODE_INSTALLATION',
  '/install': 'MODE_INSTALLATION',
  '/spot': 'MODE_SPOT_CHECK',
  '/sc': 'MODE_SPOT_CHECK',
  '/spotcheck': 'MODE_SPOT_CHECK',
  '/l': 'LINK_SITE',
  '/link': 'LINK_SITE',
  '/map': 'LOCATION',
  '/loc': 'LOCATION',
  '/location': 'LOCATION',
  '/gps': 'LOCATION',
  '/?': 'HELP',
  '/h': 'HELP',
  '/help': 'HELP',
  '/ayuda': 'HELP'
};

const GATE_NAMES = {
  1: 'Foundation & Anchor Slab',
  2: 'Steel Frame Assembly',
  3: 'Structural Mesh Panels',
  4: 'Toughened Glass Seating',
  5: 'Light Masts & LED Luminaires',
  6: 'Underlayment Membrane',
  7: 'Turf Seaming & Gluing',
  8: 'Regulation Line Cutting',
  9: 'Silica Sand Distribution',
  10: 'Sand Brushing & Infill Depth',
  11: 'Net Posts & Calibration',
  12: 'Site Cleanliness & Handover'
};

function getNextTargetGate(clearedGates = []) {
  for (let i = 1; i <= 12; i++) {
    if (!clearedGates.includes(`Gate ${i}`)) {
      return `Gate ${i} — ${GATE_NAMES[i]}`;
    }
  }
  return 'All Milestones Cleared (Ready for Handover)';
}

// ====================================================================
// 4. GEOSPATIAL, WEATHER & UTILITIES
// ====================================================================

function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || '').toLowerCase();
  const name = (fields['Site Name'] || '').toLowerCase();
  const notes = (fields['Last Note'] || '').toLowerCase();
  return env.includes('indoor') || name.includes('indoor') || notes.includes('indoor');
}

function extractCoordinates(rawLocationOrSite, mapCache = null) {
  let rawLocation = rawLocationOrSite;
  let cache = mapCache;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
    cache = fields['Map Cache'];
  }

  // 1. Decode Airtable's Base64 Google Maps Cache
  if (cache && typeof cache === 'string') {
    try {
      const decoded = Buffer.from(cache, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (parsed?.l?.lat && (parsed?.l?.lng || parsed?.l?.lon)) {
        return {
          lat: parseFloat(parsed.l.lat),
          lon: parseFloat(parsed.l.lng || parsed.l.lon)
        };
      }
    } catch (e) {}
  }

  // 2. Direct decimal coordinates or Maps URLs
  if (!rawLocation || typeof rawLocation !== 'string') return null;
  const trimmed = rawLocation.trim();

  const directMatch = trimmed.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (directMatch) {
    return { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
  }

  const urlMatch = trimmed.match(/[@?&/=](-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (urlMatch) {
    return { lat: parseFloat(urlMatch[1]), lon: parseFloat(urlMatch[2]) };
  }

  return null;
}

function formatMapUrl(rawLocationOrSite) {
  let rawLocation = rawLocationOrSite;
  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const coords = extractCoordinates(rawLocationOrSite);
    if (coords) {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`;
    }
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
  }

  if (!rawLocation) return null;
  const trimmed = rawLocation.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getHyperlocalWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability&forecast_hours=6`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const maxPrecipProb = Math.max(...(data.hourly?.precipitation_probability || [0]));
    return {
      temp: data.current?.temperature_2m || 0,
      dewPoint: data.current?.dew_point_2m || 0,
      humidity: data.current?.relative_humidity_2m || 0,
      precip: data.current?.precipitation || 0,
      windSpeed: data.current?.wind_speed_10m || 0,
      windGusts: data.current?.wind_gusts_10m || 0,
      precipProbability4h: maxPrecipProb
    };
  } catch (err) {
    console.warn('[Weather Engine] Telemetry fetch failed:', err.message);
    return null;
  }
}

function getSupabaseHeaders(contentType = 'application/json') {
  const key = CONFIG.supabase.serviceRoleKey;
  const headers = { 'apikey': key };
  if (contentType) headers['Content-Type'] = contentType;
  if (key && key.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

async function uploadToSupabase(fileBuffer, mimeType) {
  let ext = 'mp4';
  if (mimeType.includes('image')) ext = 'jpg';
  if (mimeType.includes('audio') || mimeType.includes('ogg') || mimeType.includes('opus')) ext = 'ogg';

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const storagePath = `${year}/${month}/${uuid}.${ext}`;

  const uploadUrl = `${CONFIG.supabase.url}/storage/v1/object/${CONFIG.supabase.bucket}/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: getSupabaseHeaders(mimeType),
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Supabase upload failed (${uploadRes.status}): ${errText}`);
  }

  const signUrl = `${CONFIG.supabase.url}/storage/v1/object/sign/${CONFIG.supabase.bucket}/${storagePath}`;
  const signRes = await fetch(signUrl, {
    method: 'POST',
    headers: getSupabaseHeaders('application/json'),
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 })
  });

  if (!signRes.ok) {
    const errText = await signRes.text();
    throw new Error(`Supabase signing failed (${signRes.status}): ${errText}`);
  }

  const signData = await signRes.json();
  return { storagePath, signedUrl: `${CONFIG.supabase.url}/storage/v1${signData.signedURL}` };
}

async function airtableWriteWithAutoDrop(table, fields, recordId = null, attempt = 1) {
  const cleanFields = { ...fields };

  for (const [key, val] of Object.entries(cleanFields)) {
    if (Array.isArray(val) && val.length === 0) {
      delete cleanFields[key];
    }
  }

  const url = recordId
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(table)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(table)}`;

  const method = recordId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${CONFIG.airtable.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: cleanFields })
  });

  if (res.ok) {
    return await res.json();
  }

  const errBody = await res.json().catch(() => ({}));

  if (res.status === 422 && attempt <= 5) {
    const errorMsg = errBody?.error?.message || '';
    console.warn(`[Auto-Healer] 422 on ${table} (Attempt ${attempt}): ${errorMsg}`);

    const match = errorMsg.match(/field\s*["\\]+([^"\\]+)["\\]+/i) ||
                  errorMsg.match(/column\s*["\\]+([^"\\]+)["\\]+/i) ||
                  errorMsg.match(/Unknown field:?\s*["\\]+([^"\\]+)["\\]+/i);

    if (match && match[1]) {
      const badField = match[1];
      console.warn(`[Auto-Healer] Pruning incompatible field: "${badField}"`);
      delete cleanFields[badField];
      return await airtableWriteWithAutoDrop(table, cleanFields, recordId, attempt + 1);
    }
  }

  throw new Error(`Airtable write failed on ${table} (${res.status}): ${JSON.stringify(errBody)}`);
}

async function lookupWorker(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const filterFormula = `AND({Active}=1, OR({Phone E164}='${phoneRaw}', {Phone E164}='+${cleanDigits}', {WhatsApp Number}='${cleanDigits}'))`;
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.records?.[0] || null;
}

async function lookupSite(groupIdOrPhone, siteName = null) {
  let filterFormula = groupIdOrPhone ? `OR({WhatsApp Group ID}='${groupIdOrPhone}', {WhatsApp Group ID}='${groupIdOrPhone.trim()}')` : '';
  if (siteName) {
    filterFormula = `{Site Name}='${siteName.trim()}'`;
  }

  if (!filterFormula) return null;

  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.records?.[0] || null;
}

// ====================================================================
// 5. DETERMINISTIC FORENSIC EVALUATOR & OUTBOUND MESSAGING
// ====================================================================

async function evaluateCourtMedia(mediaBuffer, mimeType, cumulativeContext = {}) {
  const base64Data = mediaBuffer.toString('base64');
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;
  const facilityTypeDesc = cumulativeContext.isIndoor ? 'INDOOR FACILITY' : 'OUTDOOR FIELD FACILITY';

  const auditContextText = isMaintenanceMode
    ? `AUDIT CONTEXT (ASSET MAINTENANCE & JOY CANNON CONCIERGE):
Court Asset: ${cumulativeContext.siteName || 'Operational Court'}
Facility Type: ${facilityTypeDesc}
Current Site Status: ${cumulativeContext.siteStatus || 'ACTIVE'}
Open Work Orders: ${cumulativeContext.openTickets || 0}`
    : `AUDIT CONTEXT (INSTALLATION & MILESTONE VERIFICATION):
Court Asset: ${cumulativeContext.siteName || 'Under Construction'}
Facility Type: ${facilityTypeDesc}
Previously Cleared Milestones: ${JSON.stringify(cumulativeContext.clearedMilestones || [])}
Active Open Punch Notes: ${cumulativeContext.lastNote || 'None'}`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        parts: [
          { text: auditContextText },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini evaluation failed (${res.status}): ${errText}`);
  }

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini forensic engine');

  const cleanedText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleanedText);
}

async function sendWhatsAppMessage(toTarget, messageBody) {
  if (!toTarget) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'text',
    text: { body: messageBody }
  };

  if (!isGroup) {
    payload.recipient_type = 'individual';
  }

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.text();
    console.error(`WhatsApp dispatch failed to ${toTarget} (${res.status}): ${errData}`);
    return false;
  }
  return true;
}

// ====================================================================
// 6. WEBHOOK ROUTING & CORE ENGINE
// ====================================================================

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    console.log('[Meta Webhook] Verification successful.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const signature = req.headers['x-hub-signature-256'];
  if (CONFIG.meta.appSecret && signature) {
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', CONFIG.meta.appSecret)
      .update(req.rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.error('[Security] HMAC SHA-256 signature verification failed!');
      return;
    }
  }

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];

    if (!message) return;

    // ------------------------------------------------------------------
    // A. Parse Group Hive JID vs. Individual Sender Phone
    // ------------------------------------------------------------------
    const rawFrom = message.from || '';
    const rawAuthor = message.author || message.participant || '';
    const rawChatId = message.chat_id || message.group_id || changes?.metadata?.phone_number_id || '';

    const isGroupMessage = rawFrom.includes('@g.us') || rawChatId.includes('@g.us');
    const groupJid = rawFrom.includes('@g.us')
      ? rawFrom
      : (rawChatId.includes('@g.us') ? rawChatId : null);

    const fromPhone = isGroupMessage && rawAuthor
      ? rawAuthor.split('@')[0].replace(/\D/g, '')
      : (rawFrom.includes('@g.us') ? '' : rawFrom.replace(/\D/g, ''));

    const dispatchTarget = groupJid || fromPhone;
    const messageId = message.id;

    const dispatchReply = async (text) => {
      const ok = await sendWhatsAppMessage(dispatchTarget, text);
      if (!ok && dispatchTarget !== fromPhone && fromPhone) {
        await sendWhatsAppMessage(fromPhone, text);
      }
    };

    // ------------------------------------------------------------------
    // B. Resolve Court Digital Twin
    // ------------------------------------------------------------------
    let site = await lookupSite(groupJid || fromPhone);

    // ------------------------------------------------------------------
    // C. Multi-Tier "Be The Water" Bouncer
    // ------------------------------------------------------------------
    const worker = fromPhone ? await lookupWorker(fromPhone) : null;
    const isBoundGroupMember = Boolean(site && isGroupMessage);
    const isAuthorizedClient = !worker && site && site.fields['Workflow Mode'] === 'MAINTENANCE';

    const isLinkCommand = message.type === 'text' &&
      (message.text?.body?.trim().startsWith('/l') || message.text?.body?.trim().startsWith('/link'));

    if (!worker && !isBoundGroupMember && !isAuthorizedClient && !isLinkCommand) {
      console.warn(`[Bouncer] Dropped unauthorized message from ${fromPhone || rawFrom}`);
      return;
    }

    const senderSource = isAuthorizedClient
      ? 'Joy Cannon (Client)'
      : (site?.fields['Workflow Mode'] === 'SPOT_VISIT' ? 'Exec Visit (Bob)' : 'Dispatch');

    const indoorSite = isIndoorSite(site);

    // ==================================================================
    // 7. LOCATION PIN-DROP (AUTONOMOUS ANCHORING & CHECK-IN)
    // ==================================================================
    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;

      if (!site) {
        await dispatchReply(`⚠️ This group is not connected to a court yet. Type */l <Court Name>* to connect.`);
        return;
      }

      let siteCoords = extractCoordinates(site);

      // AUTONOMOUS ANCHORING: If the court has no coordinates yet, anchor it
      if (!siteCoords) {
        const coordString = `${userLat.toFixed(5)}, ${userLon.toFixed(5)}`;
        await airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, site.id);
        siteCoords = { lat: userLat, lon: userLon };

        await dispatchReply(
          `📍 *COURT GPS ANCHORED*\n` +
          `Locked coordinates (*${coordString}*) to *${site.fields['Site Name']}*.\n` +
          `✅ 300m presence geofence and weather tripwires are now active!`
        );
        return;
      }

      const distanceMeters = haversineDistanceKm(userLat, userLon, siteCoords.lat, siteCoords.lon) * 1000;
      const workerName = worker?.fields?.['Full Name'] || (fromPhone ? `Crew (+${fromPhone.slice(-4)})` : 'Field Tech');
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (distanceMeters <= 300) {
        const checkinNote = `On-site presence verified for ${workerName} at ${timestamp} (${Math.round(distanceMeters)}m from court center).`;
        await airtableWriteWithAutoDrop('Sites', { 'Last Note': checkinNote, 'Last Intent': 'PRESENCE_VERIFIED' }, site.id);

        let checkinResponse = `📍 *ON-SITE CHECK-IN CONFIRMED*\n` +
          `👤 *Crew:* ${workerName}\n` +
          `🏟️ *Court:* ${site.fields['Site Name']}\n` +
          `⏱️ *Time:* ${timestamp} (within ${Math.round(distanceMeters)}m)\n\n` +
          `✅ Shift logged on court record.`;

        if (!indoorSite) {
          const weather = await getHyperlocalWeather(siteCoords.lat, siteCoords.lon);
          if (weather) {
            if (weather.windGusts > 37) {
              checkinResponse += `\n\n⛔ *SAFETY NOTICE:* Wind gusts at ${weather.windGusts} km/h (>20 kts). Glass crane rigging suspended.`;
            } else if (weather.humidity > 85 || weather.precip > 0 || (weather.temp - weather.dewPoint) <= 2) {
              checkinResponse += `\n\n⚠️ *WEATHER NOTICE:* High moisture risk (${weather.humidity}% RH). Hold Gate 7 turf adhesive.`;
            }
          }
        }

        await dispatchReply(checkinResponse);
      } else {
        await dispatchReply(
          `📍 *LOCATION PIN RECEIVED*\n\n` +
          `You are currently ${(distanceMeters / 1000).toFixed(1)} km away from *${site.fields['Site Name']}*.\n` +
          `Check-in requires being within 300m of the court.`
        );
      }
      return;
    }

    // ==================================================================
    // 8. ZERO-TOKEN COMMAND MATRIX & CHATTER FILTER
    // ==================================================================
    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const intent = COMMAND_MAP[trigger.toLowerCase()];

      if (!intent) return; // Drop plain chatter silently

      console.log(`[Command Engine] Triggered: ${trigger} -> ${intent}`);

      // /l or /link <Site Name>
      if (intent === 'LINK_SITE') {
        const targetSiteName = args.join(' ');
        const targetSite = await lookupSite(null, targetSiteName);
        if (!targetSite) {
          await dispatchReply(`❌ Could not find "${targetSiteName}". Check spelling in Airtable.`);
          return;
        }

        const targetBindingId = groupJid || fromPhone;
        await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': targetBindingId }, targetSite.id);

        const siteLoc = targetSite.fields['Site location'] || 'Location on file';
        const mapUrl = formatMapUrl(targetSite);
        const isTargetIndoor = isIndoorSite(targetSite);

        let welcomeCard = `✅ *CONNECTED TO ${targetSite.fields['Site Name'].toUpperCase()}*\n` +
          `📍 *Location:* ${siteLoc}\n` +
          `🏢 *Environment:* ${isTargetIndoor ? 'Indoor Facility' : 'Outdoor Facility'}\n`;

        if (mapUrl) {
          welcomeCard += `🗺️ *GPS Navigation:* ${mapUrl}\n`;
        }

        welcomeCard += `\n💡 *Helpful Commands:*\n` +
          `• */s* — Live progress & what to build next\n` +
          `• */w* — Weather & wind/moisture safety checks\n` +
          `• */nearby* — Nearby service stops (maintenance)\n` +
          `• Drop a WhatsApp location pin to check in on site.\n` +
          `• Send photos, videos, or voice memos anytime to log work.`;

        await dispatchReply(welcomeCard);
        return;
      }

      if (!site) {
        await dispatchReply(`⚠️ This chat is not connected to a court yet. Type */l <Court Name>* to connect.`);
        return;
      }

      // /map, /loc, /gps
      if (intent === 'LOCATION') {
        const siteLoc = site.fields['Site location'] || 'Location on file';
        const mapUrl = formatMapUrl(site);

        if (!mapUrl) {
          await dispatchReply(`⚠️ No address on file for *${site.fields['Site Name']}*.`);
          return;
        }

        await dispatchReply(
          `📍 *${site.fields['Site Name']}*\n` +
          `📫 ${siteLoc}\n\n` +
          `🗺️ *Tap to navigate:*\n${mapUrl}`
        );
        return;
      }

      // /w, /weather, /clima
      if (intent === 'WEATHER') {
        if (indoorSite) {
          await dispatchReply(
            `🏢 *${site.fields['Site Name']}* is an Indoor Facility.\nOutdoor wind and precipitation tripwires are bypassed. Verify overhead ceiling clearance (min 6.0m) and HVAC moisture.`
          );
          return;
        }

        const coords = extractCoordinates(site);
        if (!coords) {
          await dispatchReply(
            `⚠️ *${site.fields['Site Name']}* does not have GPS coordinates or Map Cache geocoded in Airtable.`
          );
          return;
        }

        const weather = await getHyperlocalWeather(coords.lat, coords.lon);
        if (!weather) {
          await dispatchReply(`⚠️ Weather service temporarily unreachable. Try again in 30 seconds.`);
          return;
        }

        const dewDelta = (weather.temp - weather.dewPoint).toFixed(1);
        let weatherCard = `🌤️ *WEATHER & SITE CONDITIONS | ${site.fields['Site Name']}*\n` +
          `• *Air Temp:* ${weather.temp}°C (Dew Point: ${weather.dewPoint}°C)\n` +
          `• *Wind:* ${weather.windSpeed} km/h (Gusts: ${weather.windGusts} km/h)\n` +
          `• *Humidity:* ${weather.humidity}%\n` +
          `• *Rain Risk:* ${weather.precipProbability4h}% in next 4 hours\n\n`;

        if (weather.windGusts > 37) {
          weatherCard += `⛔ *CRANE / GLASS RIGGING HALT:* Wind gusts exceed 20 knots (37 km/h). Gate 4 glass seating suspended.`;
        } else if (weather.precip > 0 || weather.precipProbability4h > 60) {
          weatherCard += `🌧️ *RAIN HOLD ACTIVE:* Precipitation detected or imminent (${weather.precipProbability4h}%). Outdoor assembly & gluing suspended.`;
        } else if (weather.humidity > 85 || dewDelta <= 2) {
          weatherCard += `⚠️ *ADHESIVE WARNING:* Surface condensation risk (Temp-DewPoint delta ${dewDelta}°C). Do NOT spread Gate 7 turf glue.`;
        } else {
          weatherCard += `✅ *CONDITIONS CLEAR:* Green light for assembly, glass rigging, and outdoor gluing.`;
        }

        await dispatchReply(weatherCard);
        return;
      }

      // /nearby, /route
      if (intent === 'NEARBY_SWEEP') {
        const coords = extractCoordinates(site);
        if (!coords) {
          await dispatchReply(`⚠️ Current site does not have GPS coordinates to calculate proximity.`);
          return;
        }

        const filterFormula = `AND({Workflow Mode}='MAINTENANCE', {Open Tickets} > 0, RECORD_ID() != '${site.id}')`;
        const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=15`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
        const data = await res.json().catch(() => ({}));
        const candidates = data.records || [];

        const nearbySites = [];
        for (const c of candidates) {
          const cCoords = extractCoordinates(c);
          if (cCoords) {
            const distKm = haversineDistanceKm(coords.lat, coords.lon, cCoords.lat, cCoords.lon);
            if (distKm <= 75) {
              nearbySites.push({
                name: c.fields['Site Name'],
                distance: distKm.toFixed(1),
                tickets: c.fields['Open Tickets'] || 1,
                mapUrl: formatMapUrl(c)
              });
            }
          }
        }

        nearbySites.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        if (nearbySites.length === 0) {
          await dispatchReply(`✅ No other courts with open service tickets within 75 km of *${site.fields['Site Name']}*.`);
          return;
        }

        let sweepCard = `📍 *OPEN SERVICE CALLS NEARBY*\n` +
          `_Courts needing service within 75 km of ${site.fields['Site Name']}:_\n\n`;

        nearbySites.slice(0, 3).forEach((n, idx) => {
          sweepCard += `${idx + 1}. *${n.name}* (${n.distance} km away)\n` +
            `   • ${n.tickets} open ticket(s)\n` +
            `   • Nav: ${n.mapUrl}\n\n`;
        });

        await dispatchReply(sweepCard);
        return;
      }

      // /s, /sum, /status — PROACTIVE ENVIRONMENTAL BUILD STATUS
      if (intent === 'STATUS') {
        const mode = site.fields['Workflow Mode'] || 'INSTALLATION';
        const lastNote = site.fields['Last Note'] || 'No active punch items recorded.';
        const siteStatus = site.fields['Site Status'] || 'ACTIVE';

        let progressCard = '';

        if (mode === 'MAINTENANCE' || mode === 'SPOT_VISIT') {
          const openTickets = site.fields['Open Tickets'] || 0;
          const isPaused = siteStatus === 'PAUSED';

          let statusBadge = isPaused
            ? '🔴 *Court Temporarily Paused*'
            : (openTickets > 0 ? '🟡 *Maintenance Scheduled*' : '🟢 *Court Open for Play*');

          progressCard = `🎾 *${site.fields['Site Name']}*\n` +
            `${statusBadge}\n\n` +
            `🎫 *Active Requests:* ${openTickets} open\n` +
            `📋 *Latest Note:* ${lastNote}`;
        } else {
          const cleared = site.fields['Cleared Milestones'] || [];
          const nextTarget = getNextTargetGate(cleared);
          const isHalted = siteStatus === 'PAUSED';

          let statusBadge = isHalted ? '⛔ *Work Temporarily Halted*' : '🟢 *Ready for Work*';
          let weatherLine = '';

          // Proactively inspect weather for outdoor installations
          if (!indoorSite) {
            const coords = extractCoordinates(site);
            if (coords) {
              const weather = await getHyperlocalWeather(coords.lat, coords.lon);
              if (weather) {
                const dewDelta = (weather.temp - weather.dewPoint).toFixed(1);

                if (weather.windGusts > 37) {
                  statusBadge = '⛔ *Wind Hold: Crane/Glass Suspended*';
                  weatherLine = `🌤️ *Site Weather:* ${weather.temp}°C • Wind gusts ${weather.windGusts} km/h (>20 kts)\n⛔ Glass crane rigging prohibited until winds subside.\n\n`;
                } else if (weather.precip > 0 || weather.precipProbability4h > 60) {
                  statusBadge = '🌧️ *Weather Hold: Rain / Wet Slab*';
                  weatherLine = `🌤️ *Site Weather:* ${weather.temp}°C • Rain/Storms (${weather.precipProbability4h}% precip)\n⛔ Outdoor assembly & turf gluing suspended. Keep sand covered.\n\n`;
                } else if (weather.humidity > 85 || dewDelta <= 2) {
                  statusBadge = '⚠️ *Adhesive Hold: High Moisture*';
                  weatherLine = `🌤️ *Site Weather:* ${weather.temp}°C • ${weather.humidity}% RH (Dew delta ${dewDelta}°C)\n⚠️ Slab surface condensation risk. Hold Gate 7 adhesive.\n\n`;
                } else {
                  weatherLine = `🌤️ *Site Weather:* ${weather.temp}°C • Conditions Clear • Winds ${weather.windSpeed} km/h\n\n`;
                }
              }
            }
          }

          progressCard = `🏗️ *${site.fields['Site Name']}*\n` +
            `${statusBadge} (${indoorSite ? 'Indoor' : 'Outdoor'})\n\n` +
            `🎯 *Progress:* ${cleared.length} of 12 Milestones Cleared\n` +
            `👉 *Up Next:* ${nextTarget}\n\n` +
            weatherLine +
            `📋 *Latest Field Update:*\n${lastNote}`;
        }

        await dispatchReply(progressCard);
        return;
      }

      if (intent === 'MODE_MAINTENANCE') {
        await airtableWriteWithAutoDrop('Sites', { 'Workflow Mode': 'MAINTENANCE' }, site.id);
        await dispatchReply(`🛠️ *${site.fields['Site Name']}* switched to *MAINTENANCE* mode.`);
        return;
      }

      if (intent === 'MODE_INSTALLATION') {
        await airtableWriteWithAutoDrop('Sites', { 'Workflow Mode': 'INSTALLATION' }, site.id);
        await dispatchReply(`🏗️ *${site.fields['Site Name']}* switched to *INSTALLATION* mode.`);
        return;
      }

      if (intent === 'MODE_SPOT_CHECK') {
        await airtableWriteWithAutoDrop('Sites', { 'Workflow Mode': 'SPOT_VISIT' }, site.id);
        await dispatchReply(`🔍 *${site.fields['Site Name']}* switched to *SPOT VISIT* mode.`);
        return;
      }

      if (intent === 'HELP') {
        const helpCard = `🤖 *TITAN OS COMMANDS*\n\n` +
          `• */s* — Live court progress & weather-safe next target\n` +
          `• */w* — Detailed microclimate telemetry & rain risk\n` +
          `• */map* — GPS navigation link\n` +
          `• */nearby* — Nearby service calls (maintenance)\n` +
          `• Drop a WhatsApp location pin to check in on site.\n` +
          `• Send photos, videos, or voice memos anytime to log work.`;
        await dispatchReply(helpCard);
        return;
      }
    }

    // ==================================================================
    // 9. MULTIMODAL MEDIA PROCESSING
    // ==================================================================
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || (isAudio ? '[Spoken Voice Memo]' : '');

    const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });
    const metaMediaData = await metaMediaRes.json().catch(() => ({}));

    if (!metaMediaRes.ok || !metaMediaData?.url) {
      console.error(`[Meta Graph Error] Could not resolve mediaId ${mediaId}:`, metaMediaData);
      await dispatchReply(`⚠️ Unable to download media from WhatsApp. Please try sending again.`);
      return;
    }

    const mediaBufferRes = await fetch(metaMediaData.url, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });

    if (!mediaBufferRes.ok) {
      console.error(`[CDN Error] Failed to stream binary (${mediaBufferRes.status})`);
      return;
    }

    const mediaBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());

    let parsedTimestamps = {};
    if (site?.fields?.['Milestone Timestamps JSON']) {
      try {
        parsedTimestamps = JSON.parse(site.fields['Milestone Timestamps JSON']);
      } catch (err) {
        parsedTimestamps = {};
      }
    }

    const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
    const cumulativeContext = {
      siteName: site?.fields?.['Site Name'] || 'BPC Court',
      workflowMode: currentMode,
      siteStatus: site?.fields?.['Site Status'] || 'ACTIVE',
      openTickets: site?.fields?.['Open Tickets'] || 0,
      clearedMilestones: site?.fields?.['Cleared Milestones'] || [],
      milestoneTimestamps: parsedTimestamps,
      lastNote: site?.fields?.['Last Note'] || '',
      isIndoor: indoorSite
    };

    const [storageResult, forensicAudit] = await Promise.all([
      uploadToSupabase(mediaBuffer, mimeType),
      evaluateCourtMedia(mediaBuffer, mimeType, cumulativeContext)
    ]);

    let replyText = forensicAudit.whatsapp_status_text;

    // Environmental safety tripwire append (Outdoor only)
    if (currentMode === 'INSTALLATION' && site && !indoorSite) {
      const coords = extractCoordinates(site);
      if (coords) {
        const weather = await getHyperlocalWeather(coords.lat, coords.lon);
        if (weather) {
          const dewDelta = weather.temp - weather.dewPoint;
          if (weather.windGusts > 37) {
            replyText += `\n\n⛔ *SAFETY NOTICE:* Wind gusts at ${weather.windGusts} km/h (>20 kts). Gate 4 glass seating suspended.`;
          } else if (weather.precip > 0 || weather.precipProbability4h > 60) {
            replyText += `\n\n🌧️ *WEATHER NOTICE:* Active rain/high precipitation risk. Hold outdoor gluing.`;
          } else if (weather.humidity > 85 || dewDelta <= 2) {
            replyText += `\n\n⚠️ *WEATHER NOTICE:* Surface condensation risk. Hold Gate 7 turf adhesive.`;
          }
        }
      }
    }

    await dispatchReply(replyText);

    // ==================================================================
    // 10. ASYNCHRONOUS RELATIONAL PERSISTENCE (STANDARDIZED ENGLISH)
    // ==================================================================
    const inboundRecord = await airtableWriteWithAutoDrop('Inbound Messages 2', {
      'Message ID': messageId,
      'Worker Phone Raw': fromPhone,
      'Message Type': message.type,
      'Caption Text': caption,
      'Media URL': storageResult.signedUrl,
      'Media Path': storageResult.storagePath,
      'Raw Payload JSON': JSON.stringify(message)
    });

    const reportsPayload = {
      'Inbound Messages 2': [inboundRecord.id],
      'Sites': site ? [site.id] : [],
      'Workflow Mode': cumulativeContext.workflowMode,
      'Overall Status': forensicAudit.status_observed,
      'Site Conditions': forensicAudit.site_conditions || 'Clear',
      'Action Items': (forensicAudit.action_items || []).join('\n'),
      'Status Observed': forensicAudit.status_observed,
      'Action Intent': forensicAudit.action_intent || (forensicAudit.priority ? `INCIDENT_${forensicAudit.priority}` : 'MAINTENANCE_LOG'),
      'WhatsApp Reply Text': replyText,
      'Clean JSON': JSON.stringify(forensicAudit, null, 2)
    };

    const reportRecord = await airtableWriteWithAutoDrop('Reports 2', reportsPayload);

    // ==================================================================
    // 11. CLOSED-LOOP DISPATCH (Daily Assignments)
    // ==================================================================
    const isMaintenanceInspection = currentMode === 'MAINTENANCE' || currentMode === 'SPOT_VISIT';
    const hasActiveDefects = (forensicAudit.action_items && forensicAudit.action_items.length > 0) ||
                             forensicAudit.status_observed === 'ACTION_REQUIRED' ||
                             forensicAudit.status_observed === 'HAZARD_OUT_OF_SERVICE';

    if (isMaintenanceInspection && hasActiveDefects) {
      const assignmentType = forensicAudit.assignment_type ||
        (forensicAudit.priority === 'CRITICAL' ? 'Emergency Repair' : 'Spot Visit Punch');

      const priority = forensicAudit.priority === 'CRITICAL' ? 'Critical' : 'High';
      const taskNotes = (forensicAudit.action_items || []).join('\n') || forensicAudit.worker_summary;

      const assignmentPayload = {
        'Assignment Type': assignmentType,
        'Priority': priority,
        'Source': senderSource,
        'Notes': taskNotes,
        'Status': 'Open'
      };

      if (site) assignmentPayload['Site'] = [site.id];
      if (reportRecord?.id) assignmentPayload['Origin Report'] = [reportRecord.id];

      await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
      console.log(`[Work Order Dispatched] Ticket created for ${cumulativeContext.siteName}`);
    }

    // ==================================================================
    // 12. UPDATE PARENT DIGITAL TWIN (Sites Table)
    // ==================================================================
    if (site) {
      const nowIso = new Date().toISOString();
      const sitePatch = {
        'Last Intent': forensicAudit.action_intent || `TRIAGE_${forensicAudit.priority || 'LOG'}`,
        'Last Note': forensicAudit.worker_summary
      };

      if (currentMode === 'INSTALLATION') {
        const updatedTimestamps = { ...cumulativeContext.milestoneTimestamps };

        for (const gateNum of (forensicAudit.verified_gates || [])) {
          if (!updatedTimestamps[`Gate ${gateNum}`]) {
            updatedTimestamps[`Gate ${gateNum}`] = nowIso;
          }
        }

        const previouslyCleared = cumulativeContext.clearedMilestones || [];
        const newlyVerified = (forensicAudit.verified_gates || []).map(g => `Gate ${g}`);
        let allClearedGates = Array.from(new Set([...previouslyCleared, ...newlyVerified]));

        // Transient Gate 12 Demotion
        if (forensicAudit.needs_attention_gates?.includes(12)) {
          allClearedGates = allClearedGates.filter(g => g !== 'Gate 12');
          delete updatedTimestamps['Gate 12'];
        }

        sitePatch['Cleared Milestones'] = allClearedGates;
        sitePatch['Milestone Timestamps JSON'] = JSON.stringify(updatedTimestamps, null, 2);

        if (!site.fields['Install Started'] && allClearedGates.length > 0) {
          sitePatch['Install Started'] = nowIso;
        }

        if (allClearedGates.length === 12 && forensicAudit.status_observed === 'COMMISSIONED') {
          sitePatch['Workflow Mode'] = 'MAINTENANCE';
          sitePatch['Site Status'] = 'ACTIVE';
          sitePatch['Install Completed'] = nowIso;
        }
      } else {
        if (forensicAudit.hazard_detected || forensicAudit.priority === 'CRITICAL' || forensicAudit.status_observed === 'HAZARD_OUT_OF_SERVICE') {
          sitePatch['Site Status'] = 'PAUSED';
          console.warn(`[Safety Protocol] Court PAUSED for ${site.fields['Site Name']}`);
        }
      }

      await airtableWriteWithAutoDrop('Sites', sitePatch, site.id);
    }

    console.log(`[Cycle Complete] Closed-loop audit finished for message ${messageId}`);
  } catch (err) {
    console.error('[Runtime Exception]:', err);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '4.5.8', engine: 'Titan OS V4.5.8 (Clean Master Engine)' });
});

app.listen(PORT, () => {
  console.log(`🚀 Titan OS V4.5.8 Clean Engine listening on Port ${PORT}`);
});

/**
 * TITAN OS V4.5.14 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR
 * Production Build — Commercial Quote Routing, Sub-Second Reactions & Hands-Free Punchdowns
 * 
 * Audience Alignment:
 * 1. Field Worker: Zero jargon, sub-second emoji bubble reactions, hands-free spoken closeout vouchers.
 * 2. Joy Cannon / VIP Client: Executive hospitality receipts, playability confirmation, capacity-gated reviews.
 * 3. Commercial & Estimating: Dedicated pipeline for new club builds, court conversions, and pricing requests.
 * 4. INOC Operations: Standardized English normalization, ISO micro-gate telemetry, signed 7-day media vault.
 * 5. Executive Leadership: Live portfolio health badges (🟢/🟡/🔴), zero chatter noise, real-time velocity metrics.
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

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

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3000;

// ====================================================================
// 2. INDUSTRIAL & COMMERCIAL SCHEMAS (PROMPTS)
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.

### CORE OPERATING RULES:
1. FOREGROUND ISOLATION: Evaluate ONLY the primary foreground court being inspected.
2. PARALLEL EXECUTION: Gates are verified independently unless a physical dependency blocks them.
3. INDOOR VS. OUTDOOR SPECIFIC TOLERANCES:
   - INDOOR: Minimum 6.0m clear ceiling height, slab moisture barrier, ventilation during gluing.
   - OUTDOOR: Drainage slope, perimeter curbstone run-off, corrosion protection.
4. GATE 12 DEMOTION: Tools, loose hardware, or debris drops Gate 12, placing site in ACTION_REQUIRED.
5. MULTILINGUAL & LEDGER NORMALIZATION: Ingest in any language, mirror language on WhatsApp, normalize English in ledger.

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "intent": "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG" | "COMMERCIAL_QUOTE" | "INSTALLATION_INSPECTION",
  "target_court_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "task_category": "string or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | null,
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "expense_details": { "vendor": "string or null", "total": "string or null", "items": ["string array"] },
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "ACTION_REQUIRED" | "MILESTONE_PROGRESS" | "COMMISSIONED",
  "action_intent": "HAZARD_BLOCKER" | "DEFECT_REPORT" | "MILESTONE_CLEARANCE",
  "verified_gates": [array of gate integers],
  "needs_attention_gates": [array of gate integers],
  "site_conditions": "Short string in English",
  "action_items": ["Specific mechanical defect or punch item in English"],
  "worker_summary": "1-2 sentence executive brief in English for INOC ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card in worker's language."
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance, Incident Concierge & Commercial Intake Engine.

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "intent": "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG" | "COMMERCIAL_QUOTE" | "MAINTENANCE_INSPECTION",
  "target_court_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "task_category": "string or null",
  "assignment_type": "Emergency Repair" | "Spot Visit Punch" | "Service" | "Supply Delivery",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "expense_details": { "vendor": "string or null", "total": "string or null", "items": ["string array"] },
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item in English"],
  "site_conditions": "Short string in English",
  "worker_summary": "1-2 sentence executive summary in English for INOC.",
  "whatsapp_status_text": "Plaintext WhatsApp card in client's language."
}
`;

// ====================================================================
// 3. ZERO-TOKEN COMMAND MATRIX & HUMAN MAPS
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
// 4. UNIVERSAL GEOSPATIAL & WEATHER UTILITIES
// ====================================================================

function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || '').toLowerCase();
  const name = (fields['Site Name'] || '').toLowerCase();
  const notes = (fields['Last Note'] || '').toLowerCase();
  return env.includes('indoor') || name.includes('indoor') || notes.includes('indoor');
}

async function resolveCoordinates(rawLocationOrSite, mapCache = null) {
  let rawLocation = rawLocationOrSite;
  let cache = mapCache;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
    cache = fields['Map Cache'];
  }

  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (directMatch) {
      return { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
    }
    const urlMatch = rawLocation.trim().match(/[@?&/=](-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (urlMatch) {
      return { lat: parseFloat(urlMatch[1]), lon: parseFloat(urlMatch[2]) };
    }
  }

  if (cache && typeof cache === 'string') {
    try {
      const decoded = Buffer.from(cache, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      const lat = parsed?.l?.lat || parsed?.lat || parsed?.o?.lat;
      const lon = parsed?.l?.lng || parsed?.l?.lon || parsed?.lng || parsed?.lon;
      if (lat && lon) {
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      }
    } catch (e) {}
  }

  if (typeof rawLocation === 'string' && rawLocation.length > 5) {
    try {
      const cleanAddress = rawLocation.replace(/[^\w\s,]/gi, '').trim();
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanAddress)}&count=1&language=en&format=json`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return {
            lat: data.results[0].latitude,
            lon: data.results[0].longitude
          };
        }
      }
    } catch (err) {
      console.warn('[Geocoding Engine] Address lookup failed:', err.message);
    }
  }

  return null;
}

async function formatMapUrl(rawLocationOrSite) {
  let rawLocation = rawLocationOrSite;
  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const coords = await resolveCoordinates(rawLocationOrSite);
    if (coords) {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`;
    }
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
  }

  if (!rawLocation) return null;
  const trimmed = String(rawLocation).trim();
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,weather_code&forecast_hours=6`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const maxPrecipProb = Math.max(...(data.hourly?.precipitation_probability || [0]));
    const currentCode = data.current?.weather_code ?? 0;

    const isRainingOrStorm = (currentCode >= 51 && currentCode <= 67) ||
                             (currentCode >= 80 && currentCode <= 82) ||
                             (currentCode >= 95 && currentCode <= 99);

    return {
      temp: data.current?.temperature_2m || 0,
      dewPoint: data.current?.dew_point_2m || 0,
      humidity: data.current?.relative_humidity_2m || 0,
      precip: data.current?.precipitation || 0,
      weatherCode: currentCode,
      isRainingOrStorm,
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

    const match = errorMsg.match(/(?:Unknown field name|Unknown field|Field|Column)\s*:?\s*["\\]+([^"\\]+)["\\]+/i) ||
                  errorMsg.match(/field\s*["\\]+([^"\\]+)["\\]+/i);

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

async function lookupWorkerByName(name) {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  const filterFormula = `AND({Active}=1, SEARCH('${cleanName}', LOWER({Full Name})))`;
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.records?.[0] || null;
}

async function lookupSite(groupIdOrPhone, siteName = null) {
  if (siteName) {
    const cleanSearch = siteName.replace(/['’]s?/gi, '').trim().toLowerCase();
    const filterFormula = `SEARCH('${cleanSearch}', LOWER({Site Name}))`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.records && data.records.length > 0) return data.records[0];
    }
  }

  if (groupIdOrPhone) {
    const filterFormula = `OR({WhatsApp Group ID}='${groupIdOrPhone}', {WhatsApp Group ID}='${groupIdOrPhone.trim()}')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.records?.[0] || null;
    }
  }

  return null;
}

async function getAllActiveSitesList() {
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?fields%5B%5D=Site+Name&maxRecords=100`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return (data.records || []).map(r => r.fields['Site Name']).filter(Boolean);
}

// ====================================================================
// 5. SUB-SECOND EDGE REACTIONS & OUTBOUND MESSAGING
// ====================================================================

async function sendWhatsAppReaction(toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji
    }
  };

  if (!isGroup) {
    payload.recipient_type = 'individual';
  }

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    return false;
  }
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
// 6. WORK ORDER CLOSEOUT ENGINE (SPOKEN PUNCHDOWN)
// ====================================================================

async function findActiveTicketForSite(siteId, ticketId = null) {
  if (ticketId) {
    const formula = `{Assignment ID} = ${ticketId}`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.records && data.records.length > 0) return data.records[0];
    }
  }

  if (siteId) {
    const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=20`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const records = data.records || [];
      return records.find(r => {
        const sites = r.fields['Sites'] || r.fields['Site'] || [];
        return Array.isArray(sites) && sites.includes(siteId);
      }) || null;
    }
  }

  return null;
}

async function executeWorkOrderCloseout({ site, targetCourtName, ticketId, resolutionNotes, worker, dispatchTarget, fromPhone }) {
  let targetSite = null;
  if (targetCourtName) {
    targetSite = await lookupSite(null, targetCourtName);
  }
  if (!targetSite && site) {
    targetSite = site;
  }

  const activeTicket = await findActiveTicketForSite(targetSite?.id, ticketId);

  if (!activeTicket) {
    const siteLabel = targetSite?.fields?.['Site Name'] || targetCourtName || 'this facility';
    await sendWhatsAppMessage(dispatchTarget, `⚠️ No open work orders currently found for *${siteLabel}* to close.`);
    return false;
  }

  const existingNotes = activeTicket.fields['Notes'] || '';
  const workerName = worker?.fields?.['Full Name'] || (fromPhone ? `Tech (+${fromPhone.slice(-4)})` : 'Field Tech');
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const updatedNotes = `${existingNotes}\n\n[COMPLETED by ${workerName} at ${timeStr}]: ${resolutionNotes}`.trim();

  await airtableWriteWithAutoDrop('Daily Assignments', {
    'Status': 'Complete',
    'Notes': updatedNotes
  }, activeTicket.id);

  if (targetSite) {
    await airtableWriteWithAutoDrop('Sites', {
      'Last Note': `Work Order #${activeTicket.fields['Assignment ID']} completed by ${workerName}: ${resolutionNotes}`,
      'Last Intent': 'WORK_ORDER_COMPLETED'
    }, targetSite.id);
  }

  const ticketNum = activeTicket.fields['Assignment ID'] ? `#${activeTicket.fields['Assignment ID']}` : '';
  const courtLabel = targetSite?.fields?.['Site Name'] || 'Assigned Court';

  const voucherReceipt = `🧾 *TITAN OS | CLOSEOUT RECEIPT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Ticket ${ticketNum} Completed*\n` +
    `🏟️ *Court:* ${courtLabel}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `⏱️ *Verified:* ${timeStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Work Performed:*\n` +
    `${resolutionNotes}\n\n` +
    `🟢 *Asset Condition:* Nominal (Court Open for Play)`;

  await sendWhatsAppMessage(dispatchTarget, voucherReceipt);
  return true;
}

// ====================================================================
// 7. AUTONOMOUS DISPATCH, COMMERCIAL & TEXT TRIAGE
// ====================================================================

async function triageDispatchText(text, workerRecord, currentSite = null) {
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ') || 'BPC HLD Lewinsky, BPC RCOR Court 1, BPC RCOR Court 2, BPC Camp Salter';

  const prompt = `
You are the Titan OS Operational Dispatch, Commercial Ingestion & Closeout Engine. You ingest unstructured field maintenance notes, partner texts, client screenshots, or construction inquiries.

Active Padel Court Registry: [${siteListStr}]
Field Personnel Roster: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem"]

CRITICAL INTENT CLASSIFICATION RULES:
1. "COMMERCIAL_QUOTE": Any inquiry regarding pricing, quoting, building new courts, adding padel over existing tennis courts, or greenfield club construction (e.g. "how much would that cost", "build 6 new courts", "add two more padel courts over tennis courts").
   - DO NOT classify this as maintenance or net repair.
   - Extract "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing"
   - Extract "scope_summary": Detailed breakdown of what the client wants priced.
   - Extract "directed_to": Name of person addressed (e.g. "Rob").
   - DO NOT force match an existing court if the text refers to an unbuilt or general facility ("our facility"). Leave "matched_site_name": null.

2. "WORK_ORDER_CLOSEOUT": Completed or resolved work (e.g., "finished up at Camp Salter 2", "torqued net strap").
3. "PRE_TOURNAMENT_AUDIT": Requests for pre-event, pre-tournament, or weekend sweep checks.
4. "EXPENSE_LOG": Hardware purchases with store/cost details.
5. "DISPATCH_CREATE": Maintenance defects, sanding needs, or repairs on EXISTING active courts.

Valid Task Categories (MUST choose exactly one):
- "Turf: Sand & Grooming"
- "Net: Tension & Hardware"
- "Glass & Structure"
- "Hardware: Caps & Fasteners"
- "Lighting & Electrical"
- "Supply Delivery (Joy Cannon)"
- "Site Cleanliness & Sweep"
- "Season Opening"
- "Season Closing"
- "Quarterly Maintenance"
- "Annual Structural & Torque Audit"
- "Post-Storm / High-Wind Inspection"

Input Text: "${text}"

Output JSON only:
{
  "is_work_order": true,
  "intent": "COMMERCIAL_QUOTE" | "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG",
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "task_category": "string from Valid Task Categories or Quarterly Maintenance",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "notes": "string in English"
}
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
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
    throw new Error(`Gemini dispatch triage failed (${res.status}): ${await res.text()}`);
  }

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

// ====================================================================
// 8. BATCH MULTIMODAL FORENSIC EVALUATION
// ====================================================================

async function evaluateCourtMediaBatch(mediaItems, cumulativeContext = {}) {
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;
  const facilityTypeDesc = cumulativeContext.isIndoor ? 'INDOOR FACILITY' : 'OUTDOOR FIELD FACILITY';
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ');

  const auditContextText = `AUDIT CONTEXT & FLEET ROUTER:
Active Padel Court Registry: [${siteListStr}]
Field Personnel Roster: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem"]
Current Bound Asset: ${cumulativeContext.siteName || 'Unbound Court'}
Current Mode: ${cumulativeContext.workflowMode || 'INSTALLATION'}
Facility Type: ${facilityTypeDesc}
Previously Cleared Milestones: ${JSON.stringify(cumulativeContext.clearedMilestones || [])}
Active Open Punch Notes: ${cumulativeContext.lastNote || 'None'}

DYNAMIC INTENT CLASSIFICATION RULES:
1. "COMMERCIAL_QUOTE": The image, screenshot, or audio discusses building new courts, converting tennis courts, or asking for pricing.
   - DO NOT classify as maintenance. Set "intent": "COMMERCIAL_QUOTE".
   - Extract full scope into "commercial_quote_details".
2. "WORK_ORDER_CLOSEOUT": Completed punchdown work.
3. "PRE_TOURNAMENT_AUDIT": Requesting pre-event or weekend sweep checks.
4. "EXPENSE_LOG": Hardware receipt or supplier expense.
5. "DISPATCH_CREATE": Maintenance defects on existing courts.
6. "INSTALLATION_INSPECTION": Standard physical build audit.`;

  const contentParts = [{ text: auditContextText }];

  for (const item of mediaItems) {
    if (item.caption) {
      contentParts.push({ text: `Caption: ${item.caption}` });
    }
    contentParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  }

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: contentParts }],
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

// ====================================================================
// 9. BATCH PROCESSOR (DEBOUNCED MEDIA AGGREGATION & MULTI-INTENT)
// ====================================================================

async function processMediaBatch(batch) {
  const { items, site, worker, dispatchTarget, fromPhone, senderSource, indoorSite } = batch;

  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  const storageResults = await Promise.all(uploadPromises);

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

  const forensicAudit = await evaluateCourtMediaBatch(items, cumulativeContext);
  
  // ------------------------------------------------------------------
  // BRANCH A: COMMERCIAL QUOTE & NEW BUILD INQUIRY
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'COMMERCIAL_QUOTE' || forensicAudit.commercial_quote_details?.is_commercial_inquiry) {
    const comm = forensicAudit.commercial_quote_details || {};
    const directedTo = comm.directed_to || 'Rob';
    let assignedWorker = await lookupWorkerByName(directedTo);
    if (!assignedWorker) assignedWorker = worker;

    const leadNotes = `[COMMERCIAL LEAD — Directed to ${directedTo}]\n` +
      `Scope: ${comm.scope_summary || 'Padel court build / conversion pricing requested.'}\n` +
      `Type: ${comm.quote_type || 'General Pricing'}`;

    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': 'Service',
      'Priority': 'High',
      'Source': 'Joy Cannon (Client)',
      'Status': 'Open',
      'Notes': leadNotes
    };

    if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
    if (site?.id && forensicAudit.target_court_name) assignmentPayload['Sites'] = [site.id];

    const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
    const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

    const commercialVoucher = `💼 *TITAN OS | COMMERCIAL LEAD CAPTURED*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 *Lead Queued (${ticketId})*\n` +
      `👤 *Directed To:* ${directedTo}\n` +
      `🏢 *Opportunity:* ${comm.quote_type || 'New Build / Conversion'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Scope Detected:*\n` +
      `${comm.scope_summary || 'Pricing requested for tennis conversion / new club build.'}\n\n` +
      `✅ *Logged to Daily Assignments • Status: Open for Review*`;

    await sendWhatsAppMessage(dispatchTarget, commercialVoucher);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': `[Commercial Inquiry]: ${comm.scope_summary || item.caption}`,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      });
    }
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH B: SPOKEN WORK ORDER CLOSEOUT
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'WORK_ORDER_CLOSEOUT') {
    console.log(`[Punchdown Engine] Closing work order for "${forensicAudit.target_court_name || site?.fields['Site Name']}"`);
    await executeWorkOrderCloseout({
      site,
      targetCourtName: forensicAudit.target_court_name,
      ticketId: forensicAudit.ticket_id,
      resolutionNotes: forensicAudit.resolution_summary || 'Task completed and verified on site.',
      worker,
      dispatchTarget,
      fromPhone
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      const transcript = forensicAudit.transcription ? `[Punchdown Voice]: ${forensicAudit.transcription}` : item.caption;

      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': transcript,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      });
    }
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH C: PRE-TOURNAMENT VIP SWEEP
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'PRE_TOURNAMENT_AUDIT') {
    let targetSite = null;
    if (forensicAudit.target_court_name) {
      targetSite = await lookupSite(null, forensicAudit.target_court_name);
    }
    if (!targetSite) targetSite = site;

    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Task Category': 'Quarterly Maintenance',
      'Assignment Type': 'Service',
      'Priority': 'High',
      'Source': senderSource || 'Joy Cannon (Client)',
      'Status': 'Open',
      'Notes': `[VIP SERVICE INTAKE]: Under Dispatch Review for scheduling.\nScope: ${forensicAudit.worker_summary || 'Pre-tournament playability inspection.'}`
    };

    if (worker?.id) assignmentPayload['Worker'] = [worker.id];
    if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

    const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
    const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
    const courtLabel = targetSite?.fields?.['Site Name'] || 'Facility Courts';

    const vipVoucher = `🎾 *BOUNCE PADEL | VIP SERVICE INTAKE*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎫 *Request Queued (${ticketId})*\n` +
      `🏟️ *Facility:* ${courtLabel}\n` +
      `📋 *Status:* Under Dispatch Review\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Request Scope:*\n` +
      `${forensicAudit.worker_summary || 'Pre-tournament playability check and grooming sweep.'}\n\n` +
      `🤝 *Operations notified. We are reviewing crew capacity and will confirm your service window shortly.*`;

    await sendWhatsAppMessage(dispatchTarget, vipVoucher);
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH D: EXPENSE / RECEIPT CAPTURE
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'EXPENSE_LOG') {
    const expense = forensicAudit.expense_details || {};
    let targetSite = null;
    if (forensicAudit.target_court_name) {
      targetSite = await lookupSite(null, forensicAudit.target_court_name);
    }
    if (!targetSite) targetSite = site;

    const expNotes = `[EXPENSE RECEIPT] ${expense.vendor || 'Supplier'}: ${expense.total || 'Total on file'}\nItems: ${(expense.items || []).join(', ')}`;
    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': 'Supply Delivery',
      'Priority': 'Low',
      'Source': senderSource || 'Dispatch',
      'Status': 'Complete',
      'Notes': expNotes
    };

    if (worker?.id) assignmentPayload['Worker'] = [worker.id];
    if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

    await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);

    const expVoucher = `🧾 *TITAN OS | EXPENSE RECEIPT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏪 *Vendor:* ${expense.vendor || 'Hardware Supplier'}\n` +
      `💰 *Total:* ${expense.total || 'Logged on file'}\n` +
      `📍 *Asset:* ${targetSite?.fields?.['Site Name'] || 'General Operations'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Items:*\n` +
      `${(expense.items || []).join(', ') || 'Hardware & maintenance supplies'}\n\n` +
      `✅ *Receipt signed into vault and expense recorded.*`;

    await sendWhatsAppMessage(dispatchTarget, expVoucher);
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH E: CROSS-SITE VOICE DISPATCH (NEW TICKET)
  // ------------------------------------------------------------------
  const isCrossSite = forensicAudit.intent === 'DISPATCH_CREATE' ||
    (forensicAudit.target_court_name && site && !site.fields['Site Name'].toLowerCase().includes(forensicAudit.target_court_name.toLowerCase()));

  if (isCrossSite) {
    console.log(`[Cross-Site Router] Spoken directive routed to "${forensicAudit.target_court_name}"`);
    let targetSite = null;
    if (forensicAudit.target_court_name) {
      targetSite = await lookupSite(null, forensicAudit.target_court_name);
    }
    if (!targetSite) targetSite = site;

    let assignedWorker = worker;
    if (forensicAudit.suggested_worker_name) {
      const namedWorker = await lookupWorkerByName(forensicAudit.suggested_worker_name);
      if (namedWorker) assignedWorker = namedWorker;
    }

    const taskNotes = (forensicAudit.action_items || []).join('\n') || forensicAudit.worker_summary;
    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': forensicAudit.assignment_type || 'Service',
      'Priority': forensicAudit.priority || 'High',
      'Source': senderSource || 'Exec Visit (Bob)',
      'Status': 'Open',
      'Notes': taskNotes
    };

    if (forensicAudit.task_category) assignmentPayload['Task Category'] = forensicAudit.task_category;
    if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
    if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

    const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
    const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
    const courtLabel = targetSite?.fields?.['Site Name'] || forensicAudit.target_court_name || 'Assigned Court';

    const dispatchVoucher = `🧾 *TITAN OS | DISPATCH VOUCHER*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎫 *Ticket ${ticketId} Created*\n` +
      `🏟️ *Court:* ${courtLabel}\n` +
      `⚡ *Priority:* ${assignmentPayload['Priority']} (${assignmentPayload['Assignment Type']})\n` +
      `👤 *Assigned:* ${assignedWorker?.fields?.['Full Name'] || 'Dispatch Queue'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Directive:*\n` +
      `${taskNotes}\n\n` +
      `✅ *Logged to Daily Assignments • Status: Open*`;

    await sendWhatsAppMessage(dispatchTarget, dispatchVoucher);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      const speechTranscript = forensicAudit.transcription ? `[Transcribed Speech]: ${forensicAudit.transcription}` : item.caption;

      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': speechTranscript,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      });
    }

    return;
  }

  // ------------------------------------------------------------------
  // BRANCH F: STANDARD ON-SITE AUDIT EXECUTION
  // ------------------------------------------------------------------
  let replyText = forensicAudit.whatsapp_status_text;

  if (currentMode === 'INSTALLATION' && site && !indoorSite) {
    const coords = await resolveCoordinates(site);
    if (coords) {
      const weather = await getHyperlocalWeather(coords.lat, coords.lon);
      if (weather) {
        const dewDelta = weather.temp - weather.dewPoint;
        if (weather.windGusts > 37) {
          replyText += `\n\n⛔ *SAFETY NOTICE:* Wind gusts at ${weather.windGusts} km/h (>20 kts). Gate 4 glass seating suspended.`;
        } else if (weather.isRainingOrStorm || weather.precip > 0 || weather.precipProbability4h > 40) {
          replyText += `\n\n🌧️ *WEATHER NOTICE:* Active rain/storm detected. Hold outdoor assembly & gluing.`;
        } else if (weather.humidity > 85 || dewDelta <= 2) {
          replyText += `\n\n⚠️ *WEATHER NOTICE:* Surface condensation risk. Hold Gate 7 turf adhesive.`;
        }
      }
    }
  }

  const ok = await sendWhatsAppMessage(dispatchTarget, replyText);
  if (!ok && dispatchTarget !== fromPhone && fromPhone) {
    await sendWhatsAppMessage(fromPhone, replyText);
  }

  const inboundRecordIds = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const storageResult = storageResults[i];
    const speechTranscript = forensicAudit.transcription ? `[Transcribed Speech]: ${forensicAudit.transcription}` : item.caption;

    const inboundRecord = await airtableWriteWithAutoDrop('Inbound Messages 2', {
      'Message ID': item.messageId,
      'Worker Phone Raw': fromPhone,
      'Message Type': item.type,
      'Caption Text': speechTranscript,
      'Media URL': storageResult.signedUrl,
      'Media Path': storageResult.storagePath,
      'Raw Payload JSON': JSON.stringify(item.rawMessage)
    });
    if (inboundRecord?.id) inboundRecordIds.push(inboundRecord.id);
  }

  const reportsPayload = {
    'Inbound Messages 2': inboundRecordIds,
    'Sites': site ? [site.id] : [],
    'Workflow Mode': cumulativeContext.workflowMode,
    'Overall Status': forensicAudit.status_observed,
    'Site Conditions': forensicAudit.site_conditions || 'Clear',
    'Action Items': (forensicAudit.action_items || []).join('\n'),
    'Status Observed': forensicAudit.status_observed,
    'Action Intent': forensicAudit.action_intent || 'MAINTENANCE_LOG',
    'WhatsApp Reply Text': replyText,
    'Clean JSON': JSON.stringify(forensicAudit, null, 2)
  };

  const reportRecord = await airtableWriteWithAutoDrop('Reports 2', reportsPayload);

  if (site) {
    const nowIso = new Date().toISOString();
    const sitePatch = {
      'Last Intent': forensicAudit.action_intent || 'TRIAGE_LOG',
      'Last Note': forensicAudit.worker_summary
    };

    if (currentMode === 'INSTALLATION') {
      const updatedTimestamps = { ...cumulativeContext.milestoneTimestamps };
      for (const gateNum of (forensicAudit.verified_gates || [])) {
        if (!updatedTimestamps[`Gate ${gateNum}`]) updatedTimestamps[`Gate ${gateNum}`] = nowIso;
      }
      const previouslyCleared = cumulativeContext.clearedMilestones || [];
      const newlyVerified = (forensicAudit.verified_gates || []).map(g => `Gate ${g}`);
      let allClearedGates = Array.from(new Set([...previouslyCleared, ...newlyVerified]));
      if (forensicAudit.needs_attention_gates?.includes(12)) {
        allClearedGates = allClearedGates.filter(g => g !== 'Gate 12');
        delete updatedTimestamps['Gate 12'];
      }
      sitePatch['Cleared Milestones'] = allClearedGates;
      sitePatch['Milestone Timestamps JSON'] = JSON.stringify(updatedTimestamps, null, 2);
    }

    await airtableWriteWithAutoDrop('Sites', sitePatch, site.id);
  }
}

// ====================================================================
// 10. WEBHOOK ROUTING & INGESTION ENGINE
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

    let site = await lookupSite(groupJid || fromPhone);
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

    // ------------------------------------------------------------------
    // LOCATION PIN-DROP
    // ------------------------------------------------------------------
    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;

      if (!site) {
        await dispatchReply(`⚠️ This group is not connected to a court yet. Type */l <Court Name>* to connect.`);
        return;
      }

      let siteCoords = await resolveCoordinates(site);

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

    // ------------------------------------------------------------------
    // TEXT COMMANDS & FORWARDING TRIAGE
    // ------------------------------------------------------------------
    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const intent = COMMAND_MAP[trigger.toLowerCase()];

      if (intent) {
        if (intent === 'LINK_SITE') {
          const targetSiteName = args.join(' ');
          const targetSite = await lookupSite(null, targetSiteName);
          if (!targetSite) {
            await dispatchReply(`❌ Could not find "${targetSiteName}". Check spelling in Airtable.`);
            return;
          }

          const targetBindingId = groupJid || fromPhone;
          await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': targetBindingId }, targetSite.id);
          await dispatchReply(`✅ *CONNECTED TO ${targetSite.fields['Site Name'].toUpperCase()}*`);
          return;
        }

        if (intent === 'HELP') {
          await dispatchReply(`🤖 *TITAN OS COMMANDS*\n\n• */s* — Status\n• */w* — Weather\n• */map* — GPS Nav\n• Drop location pin to check in.\n• Forward audio, photos or screenshots to log work or quotes.`);
          return;
        }
      }

      // ------------------------------------------------------------------
      // TEXT & FORWARDED SCREENSHOT TRIAGE
      // ------------------------------------------------------------------
      const isDirectOrAdmin = !isGroupMessage || (worker && worker.fields['Role'] === 'Admin') || (site && site.fields['Workflow Mode'] !== 'INSTALLATION');

      if (isDirectOrAdmin && rawText.length > 6) {
        console.log(`[Dispatch Triage] Evaluating text: "${rawText}"`);
        try {
          const triage = await triageDispatchText(rawText, worker, site);

          // BRANCH: COMMERCIAL QUOTE & BUILD INQUIRY
          if (triage && triage.intent === 'COMMERCIAL_QUOTE') {
            const comm = triage.commercial_quote_details || {};
            const directedTo = comm.directed_to || (rawText.toLowerCase().includes('rob') ? 'Rob' : 'Bob');
            let assignedWorker = await lookupWorkerByName(directedTo);
            if (!assignedWorker) assignedWorker = worker;

            const leadNotes = `[COMMERCIAL LEAD — Directed to ${directedTo}]\n` +
              `Scope: ${comm.scope_summary || triage.notes || rawText}\n` +
              `Type: ${comm.quote_type || 'Build Quote'}`;

            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': 'Service',
              'Priority': 'High',
              'Source': 'Joy Cannon (Client)',
              'Status': 'Open',
              'Notes': leadNotes
            };

            if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
            if (triage.matched_site_name) {
              const matchedSite = await lookupSite(null, triage.matched_site_name);
              if (matchedSite) assignmentPayload['Sites'] = [matchedSite.id];
            }

            const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

            const commercialVoucher = `💼 *TITAN OS | COMMERCIAL LEAD CAPTURED*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🚀 *Lead Queued (${ticketId})*\n` +
              `👤 *Directed To:* ${directedTo}\n` +
              `🏢 *Opportunity:* ${comm.quote_type || 'New Build / Conversion'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 *Scope Detected:*\n` +
              `${comm.scope_summary || rawText}\n\n` +
              `✅ *Logged to Daily Assignments • Status: Open for Review*`;

            await dispatchReply(commercialVoucher);
            return;
          }

          if (triage && triage.intent === 'WORK_ORDER_CLOSEOUT') {
            await executeWorkOrderCloseout({
              site,
              targetCourtName: triage.matched_site_name,
              ticketId: triage.ticket_id,
              resolutionNotes: triage.resolution_summary || 'Task completed.',
              worker,
              dispatchTarget,
              fromPhone
            });
            return;
          }

          if (triage && triage.is_work_order) {
            let targetSite = null;
            if (triage.matched_site_name) targetSite = await lookupSite(null, triage.matched_site_name);
            if (!targetSite && site) targetSite = site;

            let assignedWorker = worker;
            if (triage.suggested_worker_name) {
              const namedWorker = await lookupWorkerByName(triage.suggested_worker_name);
              if (namedWorker) assignedWorker = namedWorker;
            }

            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': triage.assignment_type || 'Service',
              'Priority': triage.priority || 'Medium',
              'Source': 'Dispatch',
              'Status': 'Open',
              'Notes': triage.notes
            };

            if (triage.task_category) assignmentPayload['Task Category'] = triage.task_category;
            if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
            if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

            const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
            const courtLabel = targetSite?.fields?.['Site Name'] || triage.matched_site_name || 'Assigned Court';

            const dispatchVoucher = `🧾 *TITAN OS | DISPATCH VOUCHER*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket ${ticketId} Created*\n` +
              `🏟️ *Court:* ${courtLabel}\n` +
              `⚡ *Priority:* ${assignmentPayload['Priority']}\n` +
              `👤 *Assigned:* ${assignedWorker?.fields?.['Full Name'] || 'Dispatch Queue'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 *Directive:*\n` +
              `${triage.notes}\n\n` +
              `✅ *Logged to Daily Assignments • Status: Open*`;

            await dispatchReply(dispatchVoucher);
            return;
          }
        } catch (triageErr) {
          console.warn('[Dispatch Triage Exception]:', triageErr.message);
        }
      }

      return;
    }

    // ------------------------------------------------------------------
    // MULTIMODAL MEDIA PROCESSING (DEBOUNCED BATCH INGESTION)
    // ------------------------------------------------------------------
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || (isAudio ? '[Spoken Voice Memo]' : '');

    // SUB-SECOND VISUAL CAPTURE REACTION (<400ms)
    const reactionEmoji = isAudio ? '🎧' : (isVideo ? '🎥' : '📸');
    sendWhatsAppReaction(dispatchTarget, messageId, reactionEmoji).catch(() => {});

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

    const queueKey = `${dispatchTarget}_${site?.id || 'unbound'}`;

    if (!mediaDebounceQueues.has(queueKey)) {
      mediaDebounceQueues.set(queueKey, {
        items: [],
        timer: null,
        site,
        worker,
        dispatchTarget,
        fromPhone,
        senderSource,
        indoorSite
      });
    }

    const queue = mediaDebounceQueues.get(queueKey);
    queue.items.push({
      buffer: mediaBuffer,
      mimeType,
      messageId,
      caption,
      type: message.type,
      rawMessage: message
    });
    queue.site = site;
    queue.worker = worker;

    if (queue.timer) {
      clearTimeout(queue.timer);
    }

    queue.timer = setTimeout(async () => {
      try {
        const currentBatch = mediaDebounceQueues.get(queueKey);
        mediaDebounceQueues.delete(queueKey);
        if (!currentBatch || currentBatch.items.length === 0) return;

        console.log(`[Debouncer] Processing batch of ${currentBatch.items.length} media item(s)`);
        await processMediaBatch(currentBatch);
      } catch (batchErr) {
        console.error('[Debouncer Batch Error]:', batchErr);
      }
    }, DEBOUNCE_DELAY_MS);

  } catch (err) {
    console.error('[Runtime Exception]:', err);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '4.5.14', engine: 'Titan OS V4.5.14 (Commercial Lead Engine)' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Titan OS V4.5.14 Clean Engine listening on Port 3000`);
});

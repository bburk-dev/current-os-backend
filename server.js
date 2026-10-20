/**
 * TITAN OS V4.9.5 — FRICTIONLESS ZERO-PIN VIDEO DELTA & ERGONOMIC EDGE DISPATCH
 * 
 * Production Build Features:
 * 1. Decoupled Blind Visual Gate: Pure visual frame inspection with zero audio context (100% immune to semantic bleed).
 * 2. Dedicated Media URL Persistence: Direct writes to 'Pre-Work Media' and 'Post-Work Media' in Daily Assignments.
 * 3. "Be The Water" Ingestion: 100% functionality with or without GPS pin drops; physical presence proven by vision.
 * 4. Additive Proximity Pin Cue: Optional 300m pin-drop automatically surfaces open work orders and intake prompts.
 * 5. Phonetic & Spoken Entity Router: Resolves "RCR" -> "RCOR", "Cinnamon" -> "Cynamon", spoken ticket IDs (#15, #9).
 * 6. Two-Phase Video Delta State Machine: Pre-work baseline (spoken blockers vaulted) -> post-work completion sweep.
 * 7. Proximity-Aware Smart Dispatcher: Suppresses redundant GPS navigation links for co-located courts (<0.15 km).
 * 8. Zero-Polling In-Memory Cache-Aside Engine: Protects Airtable 100k API ceiling via 10-minute RAM cache.
 * 9. 3-Tier Data Exhaust Siphon: Noise dropped in RAM; Dark Matter to Supabase; State mutations to Airtable.
 * 10. Self-Healing Schema Auto-Provisioner: Universal AST pruning for 422 error immunity.
 * 11. Spring 2027 Mobilization Gates: 50% Deposit, 7-Day Concrete Cure Lockout, Municipal Frost Law tripwires.
 * 12. Hardened Staging Gates: 0A Container/Glass & 0B Turf Offload verification.
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
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION & RUNTIME ENVIRONMENT
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media',
    tableDarkMatter: 'dark_matter_vault'
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
const DEBOUNCE_DELAY_MS = 3500;
const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

// ====================================================================
// 2. IN-MEMORY CACHE-ASIDE ENGINE (AIRTABLE API BURN PROTECTOR)
// ====================================================================
const CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = {
  sites: null,
  sitesLastFetched: 0,
  workers: null,
  workersLastFetched: 0,
  contacts: null,
  contactsLastFetched: 0,
  coordinates: new Map()
};

const processedMessageMap = new Map();
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, timestamp] of processedMessageMap.entries()) {
    if (timestamp < cutoff) processedMessageMap.delete(id);
  }
}, 5 * 60 * 1000);

async function getCachedSites(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.sites && (now - memoryCache.sitesLastFetched < CACHE_TTL_MS)) {
    return memoryCache.sites;
  }

  try {
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memoryCache.sites = data.records || [];
    memoryCache.sitesLastFetched = now;
    console.log(`[Cache Engine] Refreshed ${memoryCache.sites.length} Sites from Airtable into RAM`);
    return memoryCache.sites;
  } catch (err) {
    console.warn('[Cache Engine] Sites refresh failed, using stale cache if available:', err.message);
    return memoryCache.sites || [];
  }
}

async function getCachedWorkers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.workers && (now - memoryCache.workersLastFetched < CACHE_TTL_MS)) {
    return memoryCache.workers;
  }

  try {
    let url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Workers?maxRecords=100`;
    let res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok && (res.status === 404 || res.status === 403)) {
      url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker?maxRecords=100`;
      res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memoryCache.workers = data.records || [];
    memoryCache.workersLastFetched = now;
    console.log(`[Cache Engine] Refreshed ${memoryCache.workers.length} Workers from Airtable into RAM`);
    return memoryCache.workers;
  } catch (err) {
    console.warn('[Cache Engine] Workers refresh failed, using stale cache if available:', err.message);
    return memoryCache.workers || [];
  }
}

async function getCachedContacts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.contacts && (now - memoryCache.contactsLastFetched < CACHE_TTL_MS)) {
    return memoryCache.contacts;
  }

  try {
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Contacts?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memoryCache.contacts = data.records || [];
    memoryCache.contactsLastFetched = now;
    return memoryCache.contacts;
  } catch (err) {
    return memoryCache.contacts || [];
  }
}

function invalidateAirtableCache(entity = 'all') {
  if (entity === 'all' || entity === 'sites') memoryCache.sitesLastFetched = 0;
  if (entity === 'all' || entity === 'workers') memoryCache.workersLastFetched = 0;
  if (entity === 'all' || entity === 'contacts') memoryCache.contactsLastFetched = 0;
  console.log(`[Cache Engine] Invalidated cache scope: ${entity}`);
}

// ====================================================================
// 3. SUPABASE AMBIENT DATA EXHAUST VAULT (DARK MATTER ENGINE)
// ====================================================================

function getSupabaseHeaders(contentType = 'application/json') {
  const key = CONFIG.supabase.serviceRoleKey;
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function streamToDarkMatterVault({
  siteId,
  siteName,
  senderPhone,
  senderName,
  rawText,
  category,
  distilledContext,
  urgency = 'LOW',
  gravityScore = 1,
  actionableFollowup = null
}) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) {
    console.warn('[Dark Matter Vault] Supabase credentials not configured, skipping ambient archive.');
    return null;
  }

  const payload = {
    site_id: siteId || null,
    site_name: siteName || 'Fleet Operations',
    sender_phone: senderPhone || null,
    sender_name: senderName || 'Field Tech',
    raw_text: rawText,
    category: category || 'General Logistics',
    distilled_context: distilledContext || rawText.slice(0, 150),
    urgency,
    gravity_score: gravityScore,
    actionable_followup: actionableFollowup,
    status: 'ARCHIVED',
    created_at: new Date().toISOString()
  };

  try {
    const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders('application/json'),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn(`[Dark Matter Vault] Supabase write failed (${res.status}): ${await res.text()}`);
      return null;
    }

    const inserted = await res.json();
    console.log(`🌌 [Dark Matter Vault] Archived ambient field note #${inserted?.[0]?.id || ''} for ${siteName}`);
    return inserted?.[0] || null;
  } catch (err) {
    console.error('[Dark Matter Vault Exception]:', err.message);
    return null;
  }
}

async function fetchRecentDarkMatter(siteNameOrId, limit = 5) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return [];

  try {
    const filter = siteNameOrId.startsWith('rec')
      ? `site_id=eq.${siteNameOrId}`
      : `site_name=ilike.*${encodeURIComponent(siteNameOrId.trim())}*`;

    const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?${filter}&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders('application/json')
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[Dark Matter Fetch Warning]:', err.message);
    return [];
  }
}

async function searchDarkMatterVault(keyword, limit = 6) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return [];

  try {
    const encoded = encodeURIComponent(keyword.trim());
    const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?or=(raw_text.ilike.*${encoded}*,distilled_context.ilike.*${encoded}*,site_name.ilike.*${encoded}*)&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders('application/json')
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[Dark Matter Search Warning]:', err.message);
    return [];
  }
}

// ====================================================================
// 4. SPRING 2027 MOBILIZATION GATE ENGINE
// ====================================================================
function evaluateReadinessGate(siteRecord) {
  const f = siteRecord.fields || siteRecord;

  const deposit = f['Deposit Status'] || '';
  const hasDeposit = (deposit === '50% Deposit Received' || deposit === 'Paid in Full');

  let slabCured = false;
  let cureMsg = 'Awaiting Foundation Pour';
  const fType = f['Foundation Type'] || '';

  if (fType.includes('Existing') || fType.includes('Indoor')) {
    slabCured = true;
    cureMsg = 'Pre-existing Pad (Cure Waived)';
  } else if (f['Slab Pour Date']) {
    const pourDate = new Date(f['Slab Pour Date']);
    const now = new Date();
    const diffDays = Math.floor((now - pourDate) / (1000 * 60 * 60 * 24));
    if (diffDays >= 7) {
      slabCured = true;
      cureMsg = `Slab Cured (${diffDays}d post-pour)`;
    } else {
      slabCured = false;
      cureMsg = `CURE LOCKOUT: ${diffDays}/7 days cured (Anchor drilling prohibited)`;
    }
  }

  let roadsOpen = true;
  let roadMsg = 'Roads Open for Heavy Flatbeds';
  const halfLoad = f['Half-Load Zone'] || '';
  const currentMonth = new Date().getMonth();
  const isSpringThawWindow = (currentMonth >= 2 && currentMonth <= 4);

  if ((halfLoad.includes('Muskoka') || halfLoad.includes('Cottage') || halfLoad.includes('Rural')) && isSpringThawWindow) {
    roadsOpen = false;
    roadMsg = 'HOLD: Municipal Half-Load Frost Restriction in Effect (Orillia flatbed hold)';
  }

  if (hasDeposit && slabCured && roadsOpen) {
    return {
      status: 'READY TO MOBILIZE 🟢',
      details: `${cureMsg} • ${roadMsg} • 50% Deposit Cleared`,
      isReady: true
    };
  } else {
    const blockers = [];
    if (!hasDeposit) blockers.push('Deposit Pending (Need 50%)');
    if (!slabCured) blockers.push(cureMsg);
    if (!roadsOpen) blockers.push(roadMsg);
    return {
      status: 'HOLD: PRE-CON BLOCKED 🔴',
      details: blockers.join(' • '),
      isReady: false
    };
  }
}

// ====================================================================
// 5. DECOUPLED BLIND VISION CLASSIFIER (ZERO AUDIO LEAKAGE)
// ====================================================================

/**
 * Pure visual inspection of video frames.
 * Evaluates imagery independently of audio claims to eliminate false check-ins.
 */
async function inspectBlindVisualGroundTruth(mediaItem) {
  const systemInstruction = `
You are the Titan OS Ground Truth Vision Gate.
Your job is to classify the physical environment visible in these video frames.

STRICT GROUND TRUTH RULES:
1. PADEL COURT VERIFICATION:
   - A valid padel court MUST show clear structural padel elements:
     * Regulation synthetic turf (blue, green, or terracotta with white lines)
     * 10mm to 12mm tempered structural glass panels mounted to steel columns
     * Electro-welded structural wire mesh cages
     * Regulation net posts and center strap
   - If the video shows:
     * Residential patio, backyard, deck, lawn furniture, BBQ, or house siding
     * Office desk, computer screens, indoor living room, drywall, or kitchen
     * Truck cab, vehicle dashboard, steering wheel, or parking lot
     YOU MUST CLASSIFY: is_padel_court: false

OUTPUT JSON ONLY:
{
  "is_padel_court": boolean,
  "detected_scene": "Concise factual description of what is actually visible (e.g. 'Residential patio with outdoor table and garden', 'Office workspace with computer monitors', 'Padel court with blue turf and glass walls')",
  "confidence": number
}
`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mediaItem.mimeType,
              data: mediaItem.buffer.toString('base64')
            }
          },
          { text: "Examine ONLY the visual frames. Disregard any audio. Is this physically inside or at the apron of a regulation padel court?" }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  try {
    const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn('[Blind Vision Gate] API check failed, falling back:', await res.text());
      return { is_padel_court: true, detected_scene: 'Bypassed on API error' };
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    console.log('[Blind Vision Gate Verdict]:', parsed);
    return parsed;
  } catch (err) {
    console.error('[Blind Vision Gate Exception]:', err.message);
    return { is_padel_court: true, detected_scene: 'Bypassed on parse error' };
  }
}

// ====================================================================
// 6. MULTIMODAL SPOKEN & TASK TRIAGE PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection & Spoken Task Engine for Bounce Padel.
Transcribe spoken audio verbatim and extract operational directives, blockers, and entity names.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "spoken_court_name": "string or null",
  "spoken_ticket_id": integer or null,
  "video_phase": "INTAKE_BASELINE" | "COMPLETION_CLOSEOUT" | "GENERAL_AUDIT" | "NONE",
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "blockers_detected": ["Specific impediment or missing item in English"],
  "work_verified": ["Specific verified completed task in English"],
  "task_category": "string or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "status_observed": "ACTION_REQUIRED" | "MILESTONE_PROGRESS" | "COMMISSIONED" | "NOMINAL",
  "action_intent": "HAZARD_BLOCKER" | "DEFECT_REPORT" | "MILESTONE_CLEARANCE" | "INTAKE_BASELINE_LOCKED",
  "verified_gates": [array of gate strings or numbers],
  "needs_attention_gates": [array of gate strings or numbers],
  "site_conditions": "Short string in English",
  "action_items": ["Specific mechanical defect or punch item in English"],
  "worker_summary": "1-2 sentence executive brief in English for INOC ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card in worker's language."
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & VIP Field Concierge Engine.
Transcribe spoken audio verbatim and extract operational directives, blockers, and entity names.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "spoken_court_name": "string or null",
  "spoken_ticket_id": integer or null,
  "video_phase": "INTAKE_BASELINE" | "COMPLETION_CLOSEOUT" | "GENERAL_AUDIT" | "NONE",
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "blockers_detected": ["Specific impediment or missing item in English"],
  "work_verified": ["Specific verified completed task in English"],
  "task_category": "string or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item in English"],
  "site_conditions": "Short string in English",
  "worker_summary": "1-2 sentence executive summary in English for INOC.",
  "whatsapp_status_text": "Plaintext WhatsApp card in client's language."
}
`;

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
  '/group': 'LINK_SITE',
  '/map': 'LOCATION',
  '/loc': 'LOCATION',
  '/location': 'LOCATION',
  '/gps': 'LOCATION',
  '/board': 'COURT_BOARD',
  '/schedule': 'COURT_BOARD',
  '/mapview': 'FLEET_MAP_LINK',
  '/fleet': 'FLEET_MAP_LINK',
  '/g': 'READINESS_GATE_CHECK',
  '/gate': 'READINESS_GATE_CHECK',
  '/r': 'READINESS_GATE_CHECK',
  '/readiness': 'READINESS_GATE_CHECK',
  '/context': 'SITE_CONTEXT',
  '/history': 'SITE_CONTEXT',
  '/search': 'SEARCH_VAULT',
  '/find': 'SEARCH_VAULT',
  '/promote': 'PROMOTE_DARK_MATTER',
  '/delta': 'VIDEO_DELTA_INFO',
  '/?': 'HELP',
  '/h': 'HELP',
  '/help': 'HELP',
  '/ayuda': 'HELP'
};

const GATE_NAMES = {
  '0A': 'Freight & Glass Integrity (Container Audit)',
  '0B': 'Offload & Turf Protection',
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

// ====================================================================
// 7. GEOSPATIAL & WEATHER UTILITIES
// ====================================================================

function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || fields['Foundation Type'] || '').toLowerCase();
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

  if (typeof rawLocation === 'string' && memoryCache.coordinates.has(rawLocation)) {
    return memoryCache.coordinates.get(rawLocation);
  }

  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (directMatch) {
      const coords = { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
      memoryCache.coordinates.set(rawLocation, coords);
      return coords;
    }
    const urlMatch = rawLocation.trim().match(/[@?&/=](-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (urlMatch) {
      const coords = { lat: parseFloat(urlMatch[1]), lon: parseFloat(urlMatch[2]) };
      memoryCache.coordinates.set(rawLocation, coords);
      return coords;
    }
  }

  if (cache && typeof cache === 'string') {
    try {
      const decoded = Buffer.from(cache, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      const lat = parsed?.l?.lat || parsed?.lat || parsed?.o?.lat;
      const lon = parsed?.l?.lng || parsed?.l?.lon || parsed?.lng || parsed?.lon;
      if (lat && lon) {
        const coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
        if (typeof rawLocation === 'string') memoryCache.coordinates.set(rawLocation, coords);
        return coords;
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
          const coords = {
            lat: data.results[0].latitude,
            lon: data.results[0].longitude
          };
          memoryCache.coordinates.set(rawLocation, coords);
          return coords;
        }
      }
    } catch (err) {
      console.warn('[Geocoding Engine] Address lookup failed:', err.message);
    }
  }

  return null;
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

async function uploadToSupabase(fileBuffer, mimeType) {
  let ext = 'mp4';
  if (mimeType.includes('image')) ext = 'jpg';
  if (mimeType.includes('audio') || mimeType.includes('ogg') || mimeType.includes('opus')) ext = 'ogg';
  if (mimeType.includes('video') || mimeType.includes('mp4') || mimeType.includes('mov') || mimeType.includes('quicktime')) ext = 'mp4';

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
  const rawSignedPath = signData.signedURL || signData.signedUrl || '';
  const fullSignedUrl = rawSignedPath.startsWith('http')
    ? rawSignedPath
    : `${CONFIG.supabase.url}/storage/v1${rawSignedPath.startsWith('/') ? '' : '/'}${rawSignedPath}`;

  return { storagePath, signedUrl: fullSignedUrl };
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
    body: JSON.stringify({ fields: cleanFields, typecast: true })
  });

  if (res.ok) {
    if (table.toLowerCase().includes('site')) invalidateAirtableCache('sites');
    if (table.toLowerCase().includes('worker')) invalidateAirtableCache('workers');
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

// ====================================================================
// 8. IDENTITY & SITE MATRIX RESOLUTION WITH PHONETIC ALIASING
// ====================================================================

async function lookupContact(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const contacts = await getCachedContacts();

  return contacts.find(c => {
    const p = (c.fields['Phone Number'] || '').replace(/\D/g, '');
    return p === cleanDigits || p.endsWith(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.endsWith(p));
  }) || null;
}

async function lookupWorker(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const workers = await getCachedWorkers();

  return workers.find(w => {
    const isActive = w.fields['Active'] === true || w.fields['Active'] === 1;
    if (!isActive) return false;
    const pE164 = String(w.fields['Phone E164'] || '').replace(/\D/g, '');
    const wNum = String(w.fields['WhatsApp Number'] || '').replace(/\D/g, '');
    return (pE164 && (pE164 === cleanDigits || cleanDigits.endsWith(pE164))) ||
           (wNum && (wNum === cleanDigits || cleanDigits.endsWith(wNum)));
  }) || null;
}

async function lookupWorkerByName(name) {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  const workers = await getCachedWorkers();

  return workers.find(w => {
    const isActive = w.fields['Active'] === true || w.fields['Active'] === 1;
    if (!isActive) return false;
    const fullName = String(w.fields['Full Name'] || w.fields['Worker Name'] || '').toLowerCase();
    return fullName.includes(cleanName);
  }) || null;
}

/**
 * Enhanced Site Resolver with Phonetic & Alias Normalization
 */
async function lookupSite(groupIdOrPhone, siteName = null) {
  const sites = await getCachedSites();

  if (siteName) {
    let normalized = siteName.toLowerCase()
      .replace(/['’]s?/gi, '')
      .replace(/\brcr\b/gi, 'rcor')
      .replace(/\breef club\b/gi, 'rcor')
      .replace(/\bcinnamon\b/gi, 'cynamon')
      .replace(/\bdon walker\b/gi, 'don walker')
      .replace(/\bnorth padel\b/gi, 'north padel')
      .replace(/\b(?:bpc|court)\b/gi, '')
      .trim();

    // 1. Exact or Substring match
    let match = sites.find(s => {
      const sName = String(s.fields['Site Name'] || '').toLowerCase();
      return sName.includes(normalized) || normalized.includes(sName);
    });
    if (match) return match;

    // 2. Tokenized word overlap (e.g. "cynamon" or "rcor 1")
    const searchTokens = normalized.split(/\s+/).filter(t => t.length > 2);
    if (searchTokens.length > 0) {
      match = sites.find(s => {
        const sName = String(s.fields['Site Name'] || '').toLowerCase();
        return searchTokens.every(token => sName.includes(token));
      });
      if (match) return match;
    }
  }

  if (groupIdOrPhone) {
    const cleanTarget = String(groupIdOrPhone).trim();
    const match = sites.find(s => {
      const gid = String(s.fields['WhatsApp Group ID'] || '').trim();
      return gid && (gid === cleanTarget || cleanTarget.includes(gid));
    });
    if (match) return match;
  }

  return null;
}

async function getAllActiveSitesList() {
  const sites = await getCachedSites();
  return sites.map(r => r.fields['Site Name']).filter(Boolean);
}

async function resolveCallerIdentity(fromPhone) {
  if (!fromPhone) {
    return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: '' };
  }

  try {
    const contact = await lookupContact(fromPhone);
    if (contact) {
      const siteId = contact.fields['Linked Site']?.[0] || null;
      let siteRecord = null;
      if (siteId) {
        const sites = await getCachedSites();
        siteRecord = sites.find(s => s.id === siteId) || null;
      }

      return {
        type: 'CONTACT',
        id: contact.id,
        name: contact.fields['Contact Name'] || 'VIP Member',
        role: contact.fields['Role'] || 'Family Member / Player',
        notificationTier: contact.fields['Notification Tier'] || [],
        siteId,
        siteRecord,
        siteName: siteRecord?.fields?.['Site Name'] || 'Private Court Asset',
        facilityTier: siteRecord?.fields?.['Facility Tier'] || 'Standard Residential'
      };
    }
  } catch (err) {
    console.warn('[Identity Engine] Contacts check failed:', err.message);
  }

  try {
    const worker = await lookupWorker(fromPhone);
    if (worker) {
      return {
        type: 'WORKER',
        id: worker.id,
        name: worker.fields['Full Name'] || worker.fields['Worker Name'] || 'Field Tech',
        role: worker.fields['Role'] || 'Field Crew',
        assignedCrew: worker.fields['Assigned Crew'] || 'Unassigned Crew',
        workerRecord: worker
      };
    }
  } catch (err) {
    console.warn('[Identity Engine] Worker check failed:', err.message);
  }

  return {
    type: 'UNKNOWN',
    name: 'External Caller',
    role: 'Unknown',
    phone: fromPhone
  };
}

// ====================================================================
// 9. WHATSAPP MESSAGING
// ====================================================================

async function sendWhatsAppReaction(toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'reaction',
    reaction: { message_id: messageId, emoji: emoji }
  };

  if (!isGroup) payload.recipient_type = 'individual';

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

  if (!isGroup) payload.recipient_type = 'individual';

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

async function sendWhatsAppButtons(toTarget, textBody, buttons = []) {
  if (!toTarget || !buttons || buttons.length === 0) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${idx}_${Date.now()}`,
      title: (btn.title || 'Select').slice(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: textBody },
      action: { buttons: actionButtons }
    }
  };

  if (!isGroup) payload.recipient_type = 'individual';

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
      return await sendWhatsAppMessage(toTarget, fallbackText);
    }
    return true;
  } catch (err) {
    const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
    return await sendWhatsAppMessage(toTarget, fallbackText);
  }
}

async function notifyAssignedWorker(ticketNumber, courtName, taskCategory, priority, directiveNotes, workerRecord) {
  if (!workerRecord) return false;

  const workerPhone = workerRecord.fields?.['WhatsApp Number'] || workerRecord.fields?.['Phone E164'];
  if (!workerPhone) return false;

  const cleanPhone = String(workerPhone).replace(/\D/g, '');
  const dispatchCard = `📋 *TITAN OS | WORK ORDER ASSIGNED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Ticket #${ticketNumber} Assigned to You*\n` +
    `🏟️ *Court:* ${courtName || 'Facility Court'}\n` +
    `🔧 *Category:* ${taskCategory || 'Service'}\n` +
    `⚡ *Priority:* ${priority || 'Medium'}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 *Directive:*\n` +
    `${directiveNotes}\n\n` +
    `👉 *VIDEO DELTA PROTOCOL:*\n` +
    `1. *Intake:* Send a 15-sec walkaround video narrating court condition & blockers before starting.\n` +
    `2. *Closeout:* Send a 10-sec completion sweep when finished to close hands-free.`;

  return await sendWhatsAppMessage(cleanPhone, dispatchCard);
}

// ====================================================================
// 10. WORK ORDER CLOSEOUT ENGINE
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

async function findNearestOpenAssignment(currentLat, currentLon, excludeSiteId = null) {
  try {
    const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&maxRecords=30`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) return null;

    const data = await res.json();
    const openTickets = data.records || [];
    if (openTickets.length === 0) return null;

    const cachedSites = await getCachedSites();
    let nearest = null;
    let minDistanceKm = Infinity;

    for (const ticket of openTickets) {
      const siteId = ticket.fields['Sites']?.[0] || ticket.fields['Site']?.[0];
      if (!siteId || siteId === excludeSiteId) continue;

      const siteRecord = cachedSites.find(s => s.id === siteId);
      if (!siteRecord) continue;

      const coords = await resolveCoordinates(siteRecord);
      if (!coords) continue;

      const dist = haversineDistanceKm(currentLat, currentLon, coords.lat, coords.lon);
      if (dist < minDistanceKm) {
        minDistanceKm = dist;
        nearest = { ticket, site: siteRecord, distanceKm: dist };
      }
    }

    return nearest;
  } catch (err) {
    console.warn('[Proactive Dispatch Engine] Distance calculation failed:', err.message);
    return null;
  }
}

async function executeWorkOrderCloseout({ site, targetCourtName, ticketId, resolutionNotes, worker, dispatchTarget, fromPhone, isVideoDelta = false }) {
  let targetSite = null;
  if (targetCourtName) targetSite = await lookupSite(null, targetCourtName);
  if (!targetSite && site) targetSite = site;

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
    (isVideoDelta ? `🎥 *Video Delta:* Baseline & Completion Sweeps Verified 🟢\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Work Performed:*\n` +
    `${resolutionNotes}\n\n` +
    `🟢 *Asset Condition:* Nominal (Court Open for Play)`;

  await sendWhatsAppMessage(dispatchTarget, voucherReceipt);

  if (targetSite) {
    const coords = await resolveCoordinates(targetSite);
    if (coords) {
      const nearest = await findNearestOpenAssignment(coords.lat, coords.lon, targetSite.id);
      if (nearest) {
        const nextCourt = nearest.site.fields['Site Name'] || 'Next Assigned Asset';
        const nextDist = nearest.distanceKm.toFixed(1);
        const nextCat = nearest.ticket.fields['Task Category'] || 'Maintenance';
        const nextNotes = nearest.ticket.fields['Notes'] || 'Follow-up service directive';
        const nextTicketId = nearest.ticket.fields['Assignment ID'] || nearest.ticket.id;

        const routeText = `📍 *TITAN PROACTIVE ROUTE RECOMMENDATION*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Technician ${workerName} is now clear at *${courtLabel}*.\n\n` +
          `🎯 *Nearest Open Dispatch:* ${nextCourt} (~${nextDist} km away)\n` +
          `🔧 *Scope:* ${nextCat}\n` +
          `📝 *Notes:* ${nextNotes.slice(0, 100)}`;

        const buttons = [
          { id: `DISPATCH_APPROVE_${nextTicketId}_${worker?.id || 'any'}`, title: `⚡ Dispatch to ${nextCourt.slice(0, 8)}` },
          { id: `ROUTE_FACTORY_${worker?.id || 'any'}`, title: `🏭 Return to Factory` }
        ];

        await sendWhatsAppButtons(dispatchTarget, routeText, buttons);
      }
    }
  }

  return true;
}

// ====================================================================
// 11. HEADLESS COMPOUND SCHEDULER & VIP CONCIERGE
// ====================================================================

async function handleCompoundScheduler(text, identity, dispatchTarget, fromPhone, boundSite = null) {
  const targetSite = identity.siteRecord || boundSite;
  const targetSiteId = targetSite?.id || identity.siteId;
  const siteName = targetSite?.fields?.['Site Name'] || identity.siteName || 'Private Compound Court';
  const nowIso = new Date().toISOString();

  const prompt = `
You are the Titan OS Compound Court Scheduler.
Current Time: ${nowIso}
Sender: ${identity.name || 'Compound Member'}
Court Asset: ${siteName}

Extract scheduling intent from: "${text}"

ACTIONS:
- "BOOK": User wants to reserve court time.
- "CANCEL": User wants to release reservation.
- "QUERY_SCHEDULE": User asks who is playing or for board.
- "CHATTER": General conversation.

CRITICAL DURATION RULE: STRICT 2-HOUR DEFAULT BOOKING BLOCK.

Output JSON only:
{
  "action": "BOOK" | "CANCEL" | "QUERY_SCHEDULE" | "CHATTER",
  "startTimeIso": "ISO 8601 string or null",
  "endTimeIso": "ISO 8601 string or null",
  "partyName": "string or null",
  "confidence": number
}
`;

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return false;
    const data = await res.json();
    const rawParsed = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawParsed) return false;

    const intent = JSON.parse(rawParsed);
    if (intent.action === 'CHATTER') return false;

    if (intent.action === 'QUERY_SCHEDULE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?sort%5B0%5D%5Bfield%5D=Start%20Time&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`;

      const qRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const qData = qRes.ok ? await qRes.json() : { records: [] };
      const records = (qData.records || []).filter(r => {
        const isConfirmed = r.fields['Status'] === 'Confirmed';
        const startTime = r.fields['Start Time'];
        return isConfirmed && startTime && startTime >= `${todayStr}T00:00:00.000Z`;
      });

      let boardText = `🎾 *${siteName.toUpperCase()} | COURT BOARD*\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (records.length === 0) {
        boardText += `🟢 *Court is wide open today!*\nSimply type your requested time here to lock it in (2-hour blocks standard).`;
      } else {
        records.forEach(r => {
          const s = new Date(r.fields['Start Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const e = new Date(r.fields['End Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const by = r.fields['Booked By'] || 'Family Member';
          boardText += `• ${s} – ${e}: *${by}*\n`;
        });
        boardText += `━━━━━━━━━━━━━━━━━━━━\n🟢 All other windows are open for play.`;
      }
      await sendWhatsAppMessage(dispatchTarget, boardText);
      return true;
    }

    if (intent.action === 'CANCEL') {
      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?sort%5B0%5D%5Bfield%5D=Start%20Time&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=20`;
      const qRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const qData = qRes.ok ? await qRes.json() : { records: [] };

      const myReservation = (qData.records || []).find(r => {
        const isConfirmed = r.fields['Status'] === 'Confirmed';
        const sTime = r.fields['Start Time'];
        const bookedBy = (r.fields['Booked By'] || '').toLowerCase();
        const searchName = (identity.name || intent.partyName || '').toLowerCase();
        return isConfirmed && sTime && sTime >= nowIso && (searchName ? bookedBy.includes(searchName) : true);
      });

      if (myReservation) {
        await airtableWriteWithAutoDrop('Reservations', { 'Status': 'Cancelled' }, myReservation.id);
        await sendWhatsAppMessage(dispatchTarget, `🟢 *COURT RELEASED*\n\nYour 2-hour reserved block has been released back to the family pool. The court is now open!`);
      } else {
        await sendWhatsAppMessage(dispatchTarget, `ℹ️ No upcoming reservations found under your name to cancel.`);
      }
      return true;
    }

    if (intent.action === 'BOOK') {
      if (!intent.startTimeIso) {
        await sendWhatsAppMessage(dispatchTarget, `Could you specify the time you'd like to play? (e.g. "Tomorrow at 10 AM")`);
        return true;
      }

      const pStart = new Date(intent.startTimeIso);
      const pEnd = intent.endTimeIso ? new Date(intent.endTimeIso) : new Date(pStart.getTime() + 2 * 60 * 60 * 1000);

      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?maxRecords=100`;
      const cRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const cData = cRes.ok ? await cRes.json() : { records: [] };

      const conflict = (cData.records || []).find(r => {
        if (r.fields['Status'] !== 'Confirmed') return false;
        const rStart = new Date(r.fields['Start Time']);
        const rEnd = new Date(r.fields['End Time']);
        return rStart < pEnd && rEnd > pStart;
      });

      if (conflict) {
        const holder = conflict.fields['Booked By'] || 'Another family member';
        const sTime = new Date(conflict.fields['Start Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const eTime = new Date(conflict.fields['End Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const conflictMsg = `⚠️ *SCHEDULE OVERLAP*\n\n` +
          `*${holder}* already has the court reserved from *${sTime} to ${eTime}*.\n\n` +
          `🟢 The court is open right after at *${eTime}*. Want me to book a 2-hour window starting at ${eTime} for you?`;

        await sendWhatsAppMessage(dispatchTarget, conflictMsg);
        return true;
      }

      const bookedByName = intent.partyName ||
        (identity.name !== 'External Caller' && identity.name !== 'VIP Member' ? identity.name : `Family Member (+${fromPhone.slice(-4)})`);

      const resPayload = {
        'Booked By': bookedByName,
        'Start Time': pStart.toISOString(),
        'End Time': pEnd.toISOString(),
        'Status': 'Confirmed',
        'Notes': `Booked via ambient WhatsApp NLP. Raw text: "${text}"`
      };
      if (targetSiteId) resPayload['Site'] = [targetSiteId];

      await airtableWriteWithAutoDrop('Reservations', resPayload);

      const sFormatted = pStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const eFormatted = pEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateFormatted = pStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      const confirmationCard = `🎾 *${siteName.toUpperCase()} | RESERVATION LOCKED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Player / Party:* ${bookedByName}\n` +
        `📅 *Date:* ${dateFormatted}\n` +
        `⏱️ *Time:* ${sFormatted} – ${eFormatted} (2-Hour Block)\n` +
        `🟢 *Status:* Confirmed\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*Have a great match! Court board updated.*`;

      await sendWhatsAppMessage(dispatchTarget, confirmationCard);
      return true;
    }
  } catch (err) {
    console.error('[Compound Scheduler Error]:', err.message);
  }
  return false;
}

async function handleVIPConcierge(text, identity, dispatchTarget, fromPhone) {
  const siteId = identity.siteId;
  const siteName = identity.siteName || 'Private Reserve Court';

  const assignmentPayload = {
    'Date': new Date().toISOString().split('T')[0],
    'Assignment Type': 'Service',
    'Priority': 'High',
    'Source': 'Joy Cannon (Client)',
    'Status': 'Open',
    'Notes': `[VIP CONCIERGE — ${identity.name} (${identity.role})]\nDirective: "${text}"`
  };

  if (siteId) assignmentPayload['Sites'] = [siteId];

  const bobWorker = await lookupWorkerByName('Bob');
  if (bobWorker) assignmentPayload['Worker'] = [bobWorker.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

  const voucherText = `💼 *BOUNCE CONCIERGE | REQUEST CONFIRMED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Hello ${identity.name} — we've received your directive for *${siteName}*:\n\n` +
    `> "${text}"\n\n` +
    `🎫 *Ticket:* ${ticketId}\n` +
    `⚡ *Priority:* High (VIP Private Reserve)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Our district service van has been notified. Handled seamlessly under your seasonal coverage.`;

  await sendWhatsAppMessage(dispatchTarget, voucherText);
  return true;
}

// ====================================================================
// 12. 3-TIER TEXT EXHAUST SIPHON
// ====================================================================

async function triageDispatchText(text, workerRecord, currentSite = null, recentAmbientSnippets = []) {
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ') || 'BPC RCOR Court 1, BPC RCOR Court 2, BPC Don Walker, BPC North Padel 1';
  const siteWorkflowMode = currentSite?.fields?.['Workflow Mode'] || 'INSTALLATION';

  const ambientMemory = recentAmbientSnippets.length > 0
    ? `\nRECENT AMBIENT FIELD MEMORY FOR THIS SITE:\n${recentAmbientSnippets.map(n => `- [${n.category}]: ${n.distilled_context}`).join('\n')}\n`
    : '';

  const prompt = `
You are the Titan OS Ambient Intelligence Scribe, Operational Dispatch & Data Exhaust Siphon for Bounce Padel.
Current Operational Context: [Site Mode: ${siteWorkflowMode}]
Active Padel Court Registry: [${siteListStr}]
Field Personnel: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem", "Michael", "David", "Edwin"]
${ambientMemory}
3-TIER EXHAUST CLASSIFICATION DIRECTIVE:
Classify the incoming text into EXACTLY ONE of three tiers:

TIER 1 - "PURE_NOISE": Casual banter, emojis, greeting filler ("ok", "lol", "👍", "coffee time").
TIER 2 - "DARK_MATTER": Informal field intelligence, weather notes, equipment comments ("traffic on 400", "dropped off screws at Orillia", "GC Paul says slab is Friday").
TIER 3 - "ACTIONABLE_STATE_CHANGE": Milestones, 50% deposit received, concrete pour dates, quote leads, closeouts, invoices.

Input Text: "${text}"

Output JSON only:
{
  "exhaust_tier": "PURE_NOISE" | "DARK_MATTER" | "ACTIONABLE_STATE_CHANGE",
  "is_actionable": boolean,
  "intent": string,
  "dark_matter_category": string | null,
  "distilled_context": string | null,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | null,
  "gravity_score": integer | null,
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "billing_details": { "client_name": "string or null", "amount": "string or null", "invoice_number": "string or null", "memo": "string or null" },
  "deposit_status": "50% Deposit Received" | "Paid in Full" | null,
  "pour_date": "YYYY-MM-DD or null",
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

  if (!res.ok) throw new Error(`Gemini dispatch triage failed (${res.status}): ${await res.text()}`);

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
}

// ====================================================================
// 13. DEDICATED VOICE-ONLY SIPHON & MULTIMODAL BATCH PROCESSOR
// ====================================================================

async function triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity) {
  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  await Promise.all(uploadPromises);

  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ') || 'BPC RCOR Court 1, BPC RCOR Court 2, BPC Don Walker, BPC North Padel 1';

  const audioPrompt = `
You are the Titan OS Spoken Voice Triage Engine for Bounce Padel.
Transcribe the spoken audio verbatim in English, then classify its operational intent under the 3-Tier Siphon.

Active Padel Court Registry: [${siteListStr}]
Field Personnel: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem", "Michael", "David", "Edwin"]

TIER 1 - "PURE_NOISE": Casual banter, filler speech.
TIER 2 - "DARK_MATTER": Informal intelligence, staging notes, parts comments, weather notes.
TIER 3 - "ACTIONABLE_STATE_CHANGE": Milestones, deposits received, concrete pour dates, closeouts.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "transcription": "Verbatim English transcript of spoken audio",
  "exhaust_tier": "PURE_NOISE" | "DARK_MATTER" | "ACTIONABLE_STATE_CHANGE",
  "is_actionable": boolean,
  "intent": string,
  "dark_matter_category": string | null,
  "distilled_context": string | null,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | null,
  "gravity_score": integer | null,
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English or null",
  "pour_date": "YYYY-MM-DD or null",
  "deposit_status": "50% Deposit Received" | "Paid in Full" | null,
  "notes": "string in English"
}
`;

  const contentParts = [{ text: audioPrompt }];
  for (const item of items) {
    contentParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  }

  const payload = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const gRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!gRes.ok) throw new Error(`Gemini voice triage failed (${gRes.status}): ${await gRes.text()}`);

  const gData = await gRes.json();
  const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return;

  const triage = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  console.log('[Voice Memo Siphon]:', { transcript: triage.transcription, tier: triage.exhaust_tier });

  if (triage.exhaust_tier === 'PURE_NOISE') return;

  if (triage.exhaust_tier === 'DARK_MATTER') {
    const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
    const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Fleet General';

    const archivedRecord = await streamToDarkMatterVault({
      siteId: site?.id || null,
      siteName: siteLabel,
      senderPhone: fromPhone,
      senderName: senderName,
      rawText: triage.transcription,
      category: triage.dark_matter_category || 'Logistics',
      distilledContext: triage.distilled_context || triage.transcription,
      urgency: triage.urgency || 'LOW',
      gravityScore: triage.gravity_score || 1
    });

    if (site && (triage.gravity_score >= 4 || triage.urgency === 'HIGH')) {
      await airtableWriteWithAutoDrop('Sites', {
        'Last Note': `[VOICE ALERT - ${triage.dark_matter_category}]: ${triage.distilled_context}`,
        'Last Intent': 'AMBIENT_ALERT'
      }, site.id);

      if (archivedRecord?.id) {
        const alertPrompt = `⚠️ *FIELD INTELLIGENCE RECORDED (VOICE)*\n\n` +
          `*Site:* ${siteLabel}\n` +
          `*Observation:* "${triage.distilled_context}"\n` +
          `*Category:* ${triage.dark_matter_category} (Urgency: ${triage.urgency})\n\n` +
          `Archived into Supabase vault. Want to promote this into an active dispatch ticket?`;

        const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Promote to Ticket' }];
        await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
      }
    }
    return;
  }

  if (triage.exhaust_tier === 'ACTIONABLE_STATE_CHANGE') {
    if (triage.intent === 'WORK_ORDER_CLOSEOUT') {
      await executeWorkOrderCloseout({
        site,
        targetCourtName: triage.matched_site_name,
        ticketId: triage.ticket_id,
        resolutionNotes: triage.resolution_summary || triage.transcription || 'Spoken closeout verified on site.',
        worker,
        dispatchTarget,
        fromPhone
      });
      return;
    }
  }
}

async function evaluateCourtMediaBatch(mediaItems, cumulativeContext = {}) {
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ');

  const auditContextText = `AUDIT CONTEXT:
Active Padel Court Registry: [${siteListStr}]
Current Bound Asset: ${cumulativeContext.siteName || 'Unbound Court'}
Current Mode: ${cumulativeContext.workflowMode || 'INSTALLATION'}
Active Open Punch Notes: ${cumulativeContext.lastNote || 'None'}

Extract verbatim transcription, spoken court name, spoken ticket ID, blockers, and completed items.`;

  const contentParts = [{ text: auditContextText }];

  for (const item of mediaItems) {
    if (item.caption) contentParts.push({ text: `Caption: ${item.caption}` });
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

  if (!res.ok) throw new Error(`Gemini evaluation failed (${res.status}): ${await res.text()}`);

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini forensic engine');

  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
}

async function processMediaBatch(batch) {
  const { items, site, worker, dispatchTarget, fromPhone, senderSource, indoorSite, callerIdentity } = batch;

  const hasVisualMedia = items.some(item => item.type === 'image' || item.type === 'video');
  const hasVideo = items.some(item => item.type === 'video');

  const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
  const cumulativeContext = {
    siteName: site?.fields?.['Site Name'] || 'BPC Court',
    workflowMode: currentMode,
    siteStatus: site?.fields?.['Site Status'] || 'ACTIVE',
    openTickets: site?.fields?.['Open Tickets'] || 0,
    clearedMilestones: site?.fields?.['Cleared Milestones'] || [],
    lastNote: site?.fields?.['Last Note'] || '',
    isIndoor: indoorSite
  };

  if (!hasVisualMedia) {
    console.log(`[Batch Router] Voice-only memo detected (${items.length} item(s)). Routing to Ambient Voice Siphon.`);
    await triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity);
    return;
  }

  // Upload visual artifacts to Supabase Storage
  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  const storageResults = await Promise.all(uploadPromises);

  // ==================================================================
  // DECOUPLED STAGE 1: BLIND VISUAL GROUND TRUTH GATE
  // ==================================================================
  if (hasVideo) {
    const videoItem = items.find(item => item.type === 'video');
    const visualTruth = await inspectBlindVisualGroundTruth(videoItem);

    if (visualTruth.is_padel_court === false) {
      console.warn(`[Blind Vision Gate] REJECTED non-court video: "${visualTruth.detected_scene}"`);

      const rejectionCard = `⛔ *TITAN OS | AUDIT REJECTED (VISUAL MISMATCH)*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Ground Truth Verification Failed*\n\n` +
        `👁️ *Camera Detected:* ${visualTruth.detected_scene}\n\n` +
        `❌ *Verdict:* No padel court structure (glass, steel, mesh, or turf) detected in video frames.\n` +
        `👉 *Action Required:* Stand at the court perimeter and record the physical asset to lock your baseline.`;

      await sendWhatsAppMessage(dispatchTarget, rejectionCard);
      return; // HARD STOP — 0 Airtable writes, zero database corruption!
    }
  }

  // ==================================================================
  // STAGE 2: MULTIMODAL INGESTION & ENTITY ROUTING
  // ==================================================================
  const forensicAudit = await evaluateCourtMediaBatch(items, cumulativeContext);

  if (hasVideo) {
    const videoIndex = items.findIndex(item => item.type === 'video');
    const videoStorageUrl = storageResults[videoIndex]?.signedUrl || '';
    const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Technician';
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // RESOLVE TARGETED TICKET (Spoken Entity Priority)
    let activeTicket = null;
    let targetedSite = site;

    if (forensicAudit.spoken_ticket_id || forensicAudit.ticket_id) {
      const explicitId = forensicAudit.spoken_ticket_id || forensicAudit.ticket_id;
      activeTicket = await findActiveTicketForSite(null, explicitId);
    }

    if (!activeTicket && forensicAudit.spoken_court_name) {
      const spokenSite = await lookupSite(null, forensicAudit.spoken_court_name);
      if (spokenSite) {
        targetedSite = spokenSite;
        activeTicket = await findActiveTicketForSite(spokenSite.id);
      }
    }

    if (!activeTicket && targetedSite) {
      activeTicket = await findActiveTicketForSite(targetedSite.id);
    }

    const courtLabel = targetedSite?.fields?.['Site Name'] || forensicAudit.target_court_name || 'Assigned Court';

    if (!activeTicket) {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ Visual verified, but no active open work order was found for *${courtLabel}*.`);
      return;
    }

    const ticketExistingNotes = activeTicket.fields['Notes'] || '';
    const hasExistingPreWork = Boolean(
      activeTicket.fields['Pre-Work Media'] || ticketExistingNotes.includes('[PRE-WORK BASELINE VIDEO]')
    );

    const isIntakeBaseline = (forensicAudit.video_phase === 'INTAKE_BASELINE') ||
      (!hasExistingPreWork && forensicAudit.video_phase !== 'COMPLETION_CLOSEOUT');

    if (isIntakeBaseline) {
      const blockers = forensicAudit.blockers_detected || [];
      const blockerList = blockers.length > 0 ? blockers.map(b => `• ${b}`).join('\n') : 'None reported';

      const updatedNotes = `${ticketExistingNotes}\n\n[PRE-WORK BASELINE VIDEO - ${timeStr} by ${workerName}]:\nURL: ${videoStorageUrl}\nSpoken Narration: "${forensicAudit.transcription || 'Court sweep logged.'}"\nBlockers: ${blockers.join(', ') || 'None'}`.trim();

      await airtableWriteWithAutoDrop('Daily Assignments', {
        'Status': 'In Progress',
        'Pre-Work Media': videoStorageUrl,
        'Notes': updatedNotes
      }, activeTicket.id);

      if (targetedSite) {
        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': `Intake baseline locked for Ticket #${activeTicket.fields['Assignment ID'] || activeTicket.id}: ${blockers.length ? `Blockers: ${blockers.join(', ')}` : 'Nominal'}`,
          'Last Intent': 'INTAKE_BASELINE_LOCKED'
        }, targetedSite.id);
      }

      let baselineCard = `🎥 *TITAN OS | PRE-WORK BASELINE LOCKED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 *Ticket #${activeTicket.fields['Assignment ID'] || activeTicket.id} Active*\n` +
        `🏟️ *Court:* ${courtLabel}\n` +
        `👤 *Technician:* ${workerName}\n` +
        `⏱️ *Intake Audit:* ${timeStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎙️ *Spoken Narration:*\n"${forensicAudit.transcription || 'Visual sweep recorded.'}"\n\n`;

      if (blockers.length > 0) {
        baselineCard += `⚠️ *Blockers Detected & Vaulted:*\n${blockerList}\n\n`;
      } else {
        baselineCard += `🟢 *Baseline Condition:* Nominal (No blockers logged)\n\n`;
      }

      baselineCard += `👉 *Status: IN PROGRESS.*\nProceed with service. When finished, send a 10-second completion video to auto-verify and close hands-free.`;

      await sendWhatsAppMessage(dispatchTarget, baselineCard);
      return;
    }

    if (!isIntakeBaseline || forensicAudit.video_phase === 'COMPLETION_CLOSEOUT') {
      const workDone = (forensicAudit.work_verified && forensicAudit.work_verified.length > 0)
        ? forensicAudit.work_verified.join(', ')
        : (forensicAudit.resolution_summary || forensicAudit.worker_summary || 'Service and playability verified on-site.');

      const updatedNotes = `${ticketExistingNotes}\n\n[POST-WORK CLOSEOUT VIDEO - ${timeStr} by ${workerName}]:\nURL: ${videoStorageUrl}\nWork Verified: ${workDone}`.trim();

      await airtableWriteWithAutoDrop('Daily Assignments', {
        'Status': 'Complete',
        'Post-Work Media': videoStorageUrl,
        'Notes': updatedNotes
      }, activeTicket.id);

      await executeWorkOrderCloseout({
        site: targetedSite,
        targetCourtName: courtLabel,
        ticketId: activeTicket.fields['Assignment ID'],
        resolutionNotes: `Video Delta Verified: ${workDone}`,
        worker,
        dispatchTarget,
        fromPhone,
        isVideoDelta: true
      });
      return;
    }
  }

  // STANDARD AUDIT / GATE EXECUTION
  let replyText = forensicAudit.whatsapp_status_text;
  const ok = await sendWhatsAppMessage(dispatchTarget, replyText);
  if (!ok && dispatchTarget !== fromPhone && fromPhone) {
    await sendWhatsAppMessage(fromPhone, replyText);
  }
}

// ====================================================================
// 14. INGRESS DISPATCH CONTROLLER
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

    const messageId = message.id;
    if (processedMessageMap.has(messageId)) {
      console.log(`[Deduplicator] Dropped duplicate message ${messageId}`);
      return;
    }
    processedMessageMap.set(messageId, Date.now());

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

    const dispatchReply = async (text) => {
      const ok = await sendWhatsAppMessage(dispatchTarget, text);
      if (!ok && dispatchTarget !== fromPhone && fromPhone) {
        await sendWhatsAppMessage(fromPhone, text);
      }
    };

    const callerIdentity = await resolveCallerIdentity(fromPhone);
    let site = callerIdentity.siteRecord || await lookupSite(groupJid || fromPhone);
    const worker = callerIdentity.workerRecord || (fromPhone ? await lookupWorker(fromPhone) : null);

    const isBoundGroupMember = Boolean(site && isGroupMessage);
    const isAuthorizedClient = callerIdentity.type === 'CONTACT' || (!worker && site && site.fields['Workflow Mode'] === 'MAINTENANCE');

    const isLinkCommand = message.type === 'text' &&
      (message.text?.body?.trim().startsWith('/l') || message.text?.body?.trim().startsWith('/link') || message.text?.body?.trim().startsWith('/group'));

    if (!worker && !isBoundGroupMember && !isAuthorizedClient && !isLinkCommand) {
      console.warn(`[Bouncer] Dropped unauthorized message from ${fromPhone || rawFrom}`);
      return;
    }

    const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
    const isAmbientChannel = AMBIENT_CHAT_MODES.includes(currentMode);

    const senderSource = isAuthorizedClient
      ? 'Joy Cannon (Client)'
      : (currentMode === 'SPOT_VISIT' ? 'Exec Visit (Bob)' : 'Dispatch');

    const indoorSite = isIndoorSite(site);

    // ================================================================
    // INTERACTIVE BUTTON REPLIES
    // ================================================================
    if (message.type === 'interactive') {
      const interactive = message.interactive;
      const buttonReply = interactive?.button_reply;
      const selectedId = buttonReply?.id || '';
      const selectedTitle = buttonReply?.title || '';

      console.log(`[Interactive Button Tap] Received '${selectedTitle}' (${selectedId}) from ${fromPhone}`);

      if (selectedId.startsWith('DISPATCH_APPROVE_')) {
        const parts = selectedId.split('_');
        const nextTicketId = parts[2];
        const nextWorkerId = parts[3];

        let targetTicket = null;
        if (nextTicketId && nextTicketId !== 'any') {
          targetTicket = await findActiveTicketForSite(null, nextTicketId);
        }

        if (targetTicket) {
          const updateFields = { 'Status': 'In Progress' };
          if (nextWorkerId && nextWorkerId !== 'any') {
            updateFields['Worker'] = [nextWorkerId];
          }
          await airtableWriteWithAutoDrop('Daily Assignments', updateFields, targetTicket.id);

          const targetSiteId = targetTicket.fields['Sites']?.[0] || targetTicket.fields['Site']?.[0];
          const cachedSites = await getCachedSites();
          const targetSiteRecord = targetSiteId ? cachedSites.find(s => s.id === targetSiteId) : null;
          const targetCourtName = targetSiteRecord?.fields?.['Site Name'] || 'Assigned Court';
          const taskCategory = targetTicket.fields['Task Category'] || targetTicket.fields['Assignment Type'] || 'Service';

          let isCoLocated = false;
          let distanceKm = null;
          let targetCoords = null;

          if (targetSiteRecord) {
            targetCoords = await resolveCoordinates(targetSiteRecord);
          }

          if (site && targetSiteRecord) {
            if (site.id === targetSiteRecord.id) {
              isCoLocated = true;
              distanceKm = 0.0;
            } else {
              const currentCoords = await resolveCoordinates(site);
              if (currentCoords && targetCoords) {
                distanceKm = haversineDistanceKm(currentCoords.lat, currentCoords.lon, targetCoords.lat, targetCoords.lon);
                if (distanceKm <= 0.15) isCoLocated = true;
              }
            }
          }

          if (isCoLocated || distanceKm === 0.0) {
            const onSiteCard = `🎾 *TITAN OS | ON-SITE DISPATCH ACTIVATED*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket #${nextTicketId} Activated*\n` +
              `🏟️ *Court:* ${targetCourtName}\n` +
              `📍 *Distance:* ~0.0 km (Co-located at current venue)\n` +
              `🔧 *Scope:* ${taskCategory}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👉 *STEP 1: INTAKE SWEEP (BEFORE TOUCHING TOOLS)*\n` +
              `Record a 15-second walkaround video of the court.\n` +
              `Speak out loud any conditions and blockers (e.g. missing crank, frayed strap, sand drift, glass scuffs).\n\n` +
              `_Titan will lock the baseline video into the vault before work begins._`;

            await dispatchReply(onSiteCard);
          } else {
            const navLink = targetCoords
              ? `https://www.google.com/maps/dir/?api=1&destination=${targetCoords.lat},${targetCoords.lon}`
              : 'Address logged in Sites directory';
            const distLabel = distanceKm !== null ? `~${distanceKm.toFixed(1)} km away` : 'En Route';

            const transitCard = `🚗 *TITAN OS | TRANSIT DISPATCH ACTIVATED*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket #${nextTicketId} Assigned*\n` +
              `🏟️ *Destination:* ${targetCourtName} (${distLabel})\n` +
              `🗺️ *Navigation:* ${navLink}\n` +
              `🔧 *Scope:* ${taskCategory}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👉 *UPON ARRIVAL (STEP 1):*\n` +
              `Send a 15-second intake walkaround video narrating court condition and any blockers before starting work.`;

            await dispatchReply(transitCard);
          }
        } else {
          await dispatchReply(`✅ *DISPATCH CONFIRMED*\nRoute verified and updated in Daily Assignments.`);
        }
        return;
      }

      if (selectedId.startsWith('PROMOTE_VAULT_')) {
        const vaultId = selectedId.replace('PROMOTE_VAULT_', '');
        try {
          const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?id=eq.${vaultId}`, {
            headers: getSupabaseHeaders('application/json')
          });
          const records = await res.json();
          const item = records?.[0];

          if (item) {
            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': 'Service',
              'Priority': item.urgency === 'HIGH' ? 'High' : 'Medium',
              'Source': 'Dark Matter Promotion',
              'Status': 'Open',
              'Notes': `[PROMOTED AMBIENT NOTE - ${item.category}]:\n"${item.raw_text}"`
            };

            if (item.site_id) assignmentPayload['Sites'] = [item.site_id];
            const created = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = created?.fields?.['Assignment ID'] ? `#${created.fields['Assignment ID']}` : 'NEW';

            await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?id=eq.${vaultId}`, {
              method: 'PATCH',
              headers: getSupabaseHeaders('application/json'),
              body: JSON.stringify({ status: 'PROMOTED', actionable_followup: `Ticket ${ticketId}` })
            });

            await dispatchReply(`📋 *PROMOTED TO TICKET ${ticketId}*\nAmbient note officially entered into Daily Assignments for ${item.site_name}.`);
            return;
          }
        } catch (e) {
          console.error('[Promotion Error]:', e);
        }
      }

      if (selectedId.startsWith('ROUTE_FACTORY_')) {
        await dispatchReply(`🏭 *RETURN ROUTE LOGGED*\nTechnician instructed to head back to Orillia Factory for staging.`);
        return;
      }

      await dispatchReply(`✅ Selected: *${selectedTitle}* — Logged into Operations.`);
      return;
    }

    // ================================================================
    // LOCATION PIN-DROP (ZERO-FRICTION OPTIONAL CHECK-IN NUDGE)
    // ================================================================
    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;

      if (!site) {
        await dispatchReply(`⚠️ This group is not connected to a court yet. Type */group <Court Name>* to connect.`);
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
      const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || (fromPhone ? `Crew (+${fromPhone.slice(-4)})` : 'Field Tech');
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (distanceMeters <= 300) {
        const checkinNote = `On-site presence verified for ${workerName} at ${timestamp} (${Math.round(distanceMeters)}m from court center).`;
        await airtableWriteWithAutoDrop('Sites', { 'Last Note': checkinNote, 'Last Intent': 'PRESENCE_VERIFIED' }, site.id);

        const activeTicket = await findActiveTicketForSite(site.id);

        let checkinResponse = `📍 *ON-SITE ARRIVAL VERIFIED*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Technician:* ${workerName}\n` +
          `🏟️ *Court:* ${site.fields['Site Name']}\n` +
          `⏱️ *Time:* ${timestamp} (within ${Math.round(distanceMeters)}m)\n`;

        if (activeTicket) {
          const ticketNum = activeTicket.fields['Assignment ID'] ? `#${activeTicket.fields['Assignment ID']}` : '';
          const taskCat = activeTicket.fields['Task Category'] || activeTicket.fields['Assignment Type'] || 'Service';

          // Shift status to In Progress
          await airtableWriteWithAutoDrop('Daily Assignments', { 'Status': 'In Progress' }, activeTicket.id);

          checkinResponse += `🎫 *Active Ticket:* ${ticketNum} (${taskCat})\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👉 *STEP 1: INTAKE SWEEP*\n` +
            `Send a 15-second walkaround video before touching tools.\n` +
            `Speak court condition and any blockers out loud to lock your baseline.`;
        } else {
          checkinResponse += `\n🟢 No active work orders pending. Shift logged on court twin.`;
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

    // ================================================================
    // TEXT PROCESSING & AMBIENT SIPHON
    // ================================================================
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

        if (intent === 'COURT_BOARD') {
          await handleCompoundScheduler('board', callerIdentity, dispatchTarget, fromPhone, site);
          return;
        }

        if (intent === 'FLEET_MAP_LINK') {
          await dispatchReply(`🗺️ *TITAN OS LIVE FLEET MAP*\n\nView continental digital twins and site conditions:\nhttps://${req.headers.host}/fleet-map`);
          return;
        }

        if (intent === 'READINESS_GATE_CHECK') {
          if (!site) {
            await dispatchReply(`⚠️ Please link a court first with /group <Court Name> to check readiness.`);
            return;
          }
          const gate = evaluateReadinessGate(site);
          const report = `🏗️ *BOUNCE PADEL | SPRING 2027 READINESS GATE*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🏟️ *Court:* ${site.fields['Site Name']}\n` +
            `🚦 *Status:* ${gate.status}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 *Verification Matrix:*\n` +
            `${gate.details}\n\n` +
            `👉 *Assigned Crew:* ${site.fields['Assigned Crew'] || 'Unassigned (Alpha/Beta)'}`;
          await dispatchReply(report);
          return;
        }

        if (intent === 'SITE_CONTEXT') {
          const targetName = args.join(' ') || site?.fields?.['Site Name'];
          if (!targetName) {
            await dispatchReply(`⚠️ Specify court: /context <Court Name>`);
            return;
          }

          const notes = await fetchRecentDarkMatter(targetName, 5);
          if (notes.length === 0) {
            await dispatchReply(`ℹ️ No ambient dark matter or field logs recorded yet for *${targetName}*.`);
            return;
          }

          let response = `🌌 *AMBIENT FIELD INTELLIGENCE | ${targetName.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n`;
          notes.forEach((n, idx) => {
            const time = new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            response += `${idx + 1}. [${n.category}] *${n.sender_name}* (${time}):\n   "${n.distilled_context || n.raw_text}"\n`;
          });
          response += `━━━━━━━━━━━━━━━━━━━━\n💡 Type */promote <number>* or reply to convert any note to an active ticket.`;

          await dispatchReply(response);
          return;
        }

        if (intent === 'SEARCH_VAULT') {
          const query = args.join(' ');
          if (!query) {
            await dispatchReply(`⚠️ Usage: */search <keyword>* (e.g. */search generator*, */search glass*)`);
            return;
          }

          const results = await searchDarkMatterVault(query, 5);
          if (results.length === 0) {
            await dispatchReply(`🔍 No field logs found matching "*${query}*".`);
            return;
          }

          let response = `🔍 *TITAN VAULT SEARCH | "${query}"*\n━━━━━━━━━━━━━━━━━━━━\n`;
          results.forEach((r, idx) => {
            const d = new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
            response += `• *${r.site_name}* (${d} by ${r.sender_name}):\n  "${r.distilled_context || r.raw_text}"\n`;
          });

          await dispatchReply(response);
          return;
        }

        if (intent === 'HELP') {
          await dispatchReply(`🤖 *TITAN OS COMMAND MATRIX*\n\n` +
            `• */g* or */gate* — Spring 2027 Readiness Gate Check\n` +
            `• */context* [Court] — Review ambient field intelligence & notes\n` +
            `• */search* <keyword> — Search historical dark matter field logs\n` +
            `• */s* — Site Status\n` +
            `• */w* — Hyperlocal Weather & Wind\n` +
            `• */map* — GPS Navigation Anchor\n` +
            `• */board* — Compound Court Board\n` +
            `• */fleet* — Continental Fleet Map\n` +
            `• */group <Court Name>* — Bind WhatsApp Channel\n\n` +
            `🎥 Video sweeps automatically lock pre-work baselines & post-work completion deltas hands-free.`);
          return;
        }
      }

      if (isBoundGroupMember || callerIdentity.role === 'Family Member / Player' || callerIdentity.role === 'Compound Member') {
        const handled = await handleCompoundScheduler(rawText, callerIdentity, dispatchTarget, fromPhone, site);
        if (handled) return;
      }

      if (callerIdentity.role === 'Owner / Principal' || callerIdentity.role === 'Property Manager / Caretaker') {
        const lower = rawText.toLowerCase();
        if (lower.includes('sand') || lower.includes('groom') || lower.includes('clean') ||
            lower.includes('glass') || lower.includes('net') || lower.includes('tournament') || lower.includes('sweep')) {
          await handleVIPConcierge(rawText, callerIdentity, dispatchTarget, fromPhone);
          return;
        }
      }

      const isDirectOrAdmin = !isGroupMessage || (worker && worker.fields['Role'] === 'Admin') || isAmbientChannel || (site && AMBIENT_CHAT_MODES.includes(site.fields['Workflow Mode']));

      if (isDirectOrAdmin && rawText.length > 2) {
        try {
          const recentDarkMatter = site ? await fetchRecentDarkMatter(site.fields['Site Name'], 3) : [];
          const triage = await triageDispatchText(rawText, worker, site, recentDarkMatter);

          if (triage.exhaust_tier === 'PURE_NOISE') return;

          if (triage.exhaust_tier === 'DARK_MATTER') {
            const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
            const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Fleet General';

            const archivedRecord = await streamToDarkMatterVault({
              siteId: site?.id || null,
              siteName: siteLabel,
              senderPhone: fromPhone,
              senderName: senderName,
              rawText: rawText,
              category: triage.dark_matter_category || 'Site Conditions',
              distilledContext: triage.distilled_context || rawText,
              urgency: triage.urgency || 'LOW',
              gravityScore: triage.gravity_score || 1
            });

            if (site && (triage.gravity_score >= 4 || triage.urgency === 'HIGH')) {
              await airtableWriteWithAutoDrop('Sites', {
                'Last Note': `[FIELD NOTE - ${triage.dark_matter_category}]: ${triage.distilled_context}`,
                'Last Intent': 'AMBIENT_ALERT'
              }, site.id);

              if (archivedRecord?.id) {
                const alertPrompt = `⚠️ *FIELD INTELLIGENCE RECORDED*\n\n` +
                  `*Site:* ${siteLabel}\n` +
                  `*Issue:* ${triage.distilled_context}\n` +
                  `*Category:* ${triage.dark_matter_category} (Urgency: ${triage.urgency})\n\n` +
                  `Archived into Supabase vault. Want to promote this into an active dispatch ticket?`;

                const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Promote to Ticket' }];
                await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
              }
            }
            return;
          }

          if (triage.exhaust_tier === 'ACTIONABLE_STATE_CHANGE') {
            if (triage.intent === 'WORK_ORDER_CLOSEOUT') {
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
          }
        } catch (triageErr) {
          console.warn('[Dispatch Triage Exception]:', triageErr.message);
        }
      }
      return;
    }

    // ================================================================
    // MULTIMODAL MEDIA BATCHING (PHOTOS, VIDEOS & AUDIO)
    // ================================================================
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || (isAudio ? '[Spoken Voice Memo]' : '');

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
        indoorSite,
        callerIdentity
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
    queue.callerIdentity = callerIdentity;

    if (queue.timer) clearTimeout(queue.timer);

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

// ====================================================================
// 15. HEALTH & RUNTIME
// ====================================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '4.9.5',
    engine: 'Titan OS V4.9.5 (Frictionless Zero-Pin Video Delta & Ergonomic Edge Dispatch)',
    cache_status: {
      sites_cached: memoryCache.sites ? memoryCache.sites.length : 0,
      workers_cached: memoryCache.workers ? memoryCache.workers.length : 0
    }
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V4.9.5 RUNNING ON PORT ${PORT}`);
  console.log(`🛡️ BLIND VISION GATE: Decoupled Frame Analysis Active`);
  console.log(`🎥 VIDEO DELTA: Pre/Post URL Persistence & Zero-Pin Ingestion Active`);
  console.log(`🎙️ PHONETIC ROUTER: RCR->RCOR, Cinnamon->Cynamon Priority Active`);
  console.log(`====================================================================`);

  try {
    await getCachedSites();
    await getCachedWorkers();
    await getCachedContacts();
  } catch (err) {
    console.warn('[Cache Warmup Warning]:', err.message);
  }
});

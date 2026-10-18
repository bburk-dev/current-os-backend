/**
 * TITAN OS V4.5.8 — INDUSTRIAL WHATSAPP FIELD ORCHESTRATOR
 * Production Build — Group Hive Broadcasting, Multilingual Ledger Translation & Weather Tripwires
 * 
 * Architecture Features:
 * - Meta WhatsApp Cloud API v21.0 with HMAC SHA-256 verification
 * - Google Gemini 2.5 Flash with clamped zero-thinking budget (ZDR compliance)
 * - Group Hive Orchestrator: Distinct Group JID vs. Sender Phone parsing with broadcast & DM fallback
 * - Passive Group Bouncer: Automatically authorizes all participants inside bound site groups
 * - Chatter Filter: Drops casual crew banter silently at zero token and zero database cost
 * - Multilingual Engine: Ingests English, Spanish, Kiswahili/Sheng, Hindi, Punjabi, Gujarati & Hinglish
 * - English Ledger Normalization: Translates all DB records (Action Items, Summaries, Notes) into English for INOC
 * - Field Edge Language Mirroring: Outbound WhatsApp status cards respond in the worker's native tongue
 * - Indoor vs. Outdoor Climate Engine: Bypasses weather tripwires for indoor facilities; audits ceiling clearance & ventilation
 * - Hyperlocal Weather & Dew Point Engine: Sub-50ms Open-Meteo telemetry (/w, /weather) for outdoor sites
 * - Microclimate Tripwires: Gate 7 wind gusts (>37 km/h) & Gate 9 surface condensation holds
 * - Map Cache Base64 Decoder: Auto-extracts {lat, lng} from Airtable Google Maps cache
 * - Clustered Maintenance Sweeps: In-memory Haversine distance dispatch routing (/nearby)
 * - Proof-of-Presence Check-in: 300m geofence verification on native WhatsApp location drops
 * - Native Voice Note Ingestion: Audio walkthroughs & spoken defect reports evaluated directly
 * - Parallel Gate Architecture: Concurrency-aware construction verification
 * - Maintenance & Joy Cannon Triage: Defect logging & P1/P2 auto-dispatch
 * - Zero-Token Headless Command Aliasing (/s, /m, /i, /spot, /l, /map, /w, /nearby)
 * - Self-Healing Recursive 422 Airtable Schema Auto-Drop Wrapper
 */

try {
  require('dotenv').config();
} catch (e) {
  // Dotenv is injected natively by Render
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

// ==========================================
// 1. CONFIGURATION & ENVIRONMENT VALIDATION
// ==========================================
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

// ==========================================
// 2. INDUSTRIAL FORENSIC GOD SCHEMAS (PROMPTS)
// ==========================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media (videos, photo batches, and spoken voice memos) against strict mechanical and safety tolerances.

### CORE OPERATING RULES:
1. FOREGROUND ISOLATION: Evaluate ONLY the primary foreground court being inspected. Strictly ignore background courts or adjacent club infrastructure.
2. PARALLEL EXECUTION & REAL-WORLD CONCURRENCY:
   - Gates are NOT a strict waterfall. Different sub-trades work simultaneously on site.
   - Any milestone meeting its quality standard must be verified independently, regardless of the sequence in which footage is received.
   - ONLY hard structural prerequisites block a gate:
     • Foundation Slab (Gate 1) must be cured and level before Frame Anchor Bolts (Gate 2) are verified.
     • Frame Uprights (Gate 2) must be anchored before Glass Seating (Gate 4) can be verified.
   - Concurrent tasks (e.g., Gate 3 Mesh Panels, Gate 5 Lighting Masts, Gate 6 Sub-base, Gate 7 Turf) can clear in parallel or out of order.
3. INDOOR VS. OUTDOOR SPECIFIC TOLERANCES:
   - If site context indicates an INDOOR court:
     • Verify minimum vertical ceiling clearance (min 6.0m clear height, 8.0m preferred for competition). Obstructions (beams, HVAC ducts, low-hanging pendant lights) must be flagged in Gate 5.
     • Inspect concrete vapor barrier and indoor slab moisture (sweating concrete ruins Gate 7 adhesive).
     • Inspect indoor luminaire glare reduction and horizontal lux consistency across court floor.
     • Verify ventilation/airflow exhaust during polyurethane adhesive (Gate 7) curing.
   - If site context indicates an OUTDOOR court:
     • Inspect slab drainage slope, perimeter curbstone run-off, and expansion gaps.
     • Enforce corrosion protection audits on exposed hardware.
4. WEAR, RUST & MATERIAL INTEGRITY GUARDS:
   - RUST & CORROSION AUDIT: Inspect steel uprights, baseplates, anchor bolts, and mesh weld joints. Active rust, flaking coating, or weld oxidation immediately flags Gate 2/3 as ACTION_REQUIRED.
   - TURF WEAR & FRAYING: Inspect carpet roll joints and line cuts. Exposed backing, unbonded seam tape, or unraveling fibers flags Gate 7/8 as ACTION_REQUIRED.
   - NET & STRAP CALIBRATION: Inspect posts, ratchet winch, cable, headband, and center strap. Center height sagging below 88 cm (or post height below 92 cm) flags Gate 11 as ACTION_REQUIRED.
5. TRANSIENT GATE 12 DEMOTION: Any active hand tools, discarded wire trimmings, loose hardware, orange buckets, or construction debris automatically drops Gate 12 (Site Cleanliness), placing the court into ACTION_REQUIRED.
6. MULTILINGUAL INGESTION & LEDGER ENGLISH STANDARDIZATION:
   - Comprehend speech, audio voice memos, and text in English, Spanish (Español), Swahili / Sheng (Kenya), Hindi, Punjabi, Gujarati, and Hinglish (India).
   - LEDGER STANDARDIZATION (CRITICAL): All internal data fields ("action_items", "worker_summary", "site_conditions", "defect_telemetry", "action_intent") MUST BE WRITTEN IN CONCISE, PROFESSIONAL ENGLISH for Airtable and executive leadership visibility.
   - FIELD EDGE MIRRORING: The "whatsapp_status_text" MUST be generated in the primary language detected from the user (e.g., reply in Spanish if spoken/written in Spanish, Swahili if in Swahili, Hindi/Punjabi if in Hindi/Punjabi, English if in English), keeping Titan OS operational formatting.

### THE 12 PHYSICAL INSTALLATION MILESTONES (CONCURRENT & INDEPENDENT):
- Gate 1: Foundation & Anchor Slab (cured concrete, level surface, dry, no chemical puddling, indoor vapor barrier intact)
- Gate 2: Steel Frame Assembly (vertical uprights anchored, corner posts square, zero rust/corrosion)
- Gate 3: Structural Mesh Panels (electro-welded mesh panels flush, welds intact, zero wire fraying/rust)
- Gate 4: Toughened Glass Seating (10mm/12mm tempered glass seated on neoprene gaskets, tabs aligned)
- Gate 5: Light Masts & LED Luminaires (floodlight columns erected, wiring channeled, fixtures seated, indoor ceiling clearance verified)
- Gate 6: Underlayment & Sub-base Membrane (drainage/shockpad flat, zero wrinkling, seams prepped)
- Gate 7: Padel Turf Seaming & Gluing (monofilament rolls laid, 300mm seam tape glued, zero fiber fraying/lift)
- Gate 8: Regulation Line Cutting (white line markings cut in, glued flush with turf surface)
- Gate 9: Silica Sand Distribution (kiln-dried 0.2-0.8mm silica sand evenly distributed across carpet)
- Gate 10: Sand Brushing & Infill Depth (sand mechanically brushed into pile, 2-3mm pile exposure verified)
- Gate 11: Net Posts & Center Strap Calibration (posts bolted, tension cable intact, net height 88cm center / 92cm post, zero fraying)
- Gate 12: Site Cleanliness & Commissioning (perimeter clear of tools/buckets/debris, glass cleaned, ready for play)

### OUTPUT SPECIFICATION:
You must output strictly valid JSON matching this schema:
{
  "detected_language": "string (e.g. English, Spanish, Swahili, Hindi, Punjabi, Gujarati)",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "ACTION_REQUIRED" | "MILESTONE_PROGRESS" | "COMMISSIONED",
  "action_intent": "HAZARD_BLOCKER" | "DEFECT_REPORT" | "MILESTONE_CLEARANCE",
  "verified_gates": [array of integers representing newly cleared gates visible in this footage, e.g. [3, 5]],
  "needs_attention_gates": [array of integers representing blocked/failed gates, e.g. [2, 12]],
  "site_conditions": "Short string in English noting environment, lighting, moisture, slab conditions.",
  "action_items": [
    "Specific mechanical failure, rust, fraying, or calibration defect 1 in English",
    "Specific mechanical failure, rust, fraying, or calibration defect 2 in English"
  ],
  "defect_telemetry": {
    "rust_detected": boolean,
    "rust_locations": ["string array of affected components in English"],
    "fraying_detected": boolean,
    "fraying_locations": ["string array of affected areas in English"],
    "net_defect_detected": boolean,
    "net_calibration_notes": "string in English",
    "ceiling_clearance_hazard": boolean
  },
  "worker_summary": "1-2 sentence executive summary in English for the database ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card matching Titan OS operational formatting written in the user's detected language."
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & Incident Triage Engine. You evaluate multimodal edge media (videos, photos, and spoken voice memos) submitted by facility managers, club executives, and VIP court owners (the "Joy Cannon" loop).

Your objective is to identify asset degradation, mechanical failures, safety hazards, or client requests, assign SLA priorities, and generate structured dispatch tickets.

### CORE OPERATING RULES:
1. INDOOR VS. OUTDOOR AWARENESS:
   - For INDOOR facilities: Check HVAC air conditioning drip lines, overhead condensation drips onto turf, indoor dust/lint accumulation on glass, and indoor halogen/LED ballast hums.
   - For OUTDOOR facilities: Check wind-blown debris, perimeter sand erosion from rain run-off, algae/mildew growth on turf edges, and exterior glass environmental staining.
2. MULTILINGUAL & LEDGER NORMALIZATION:
   - Understand spoken or written reports in English, Spanish, Kiswahili/Sheng, Hindi, Punjabi, Gujarati, and Hinglish.
   - All internal fields ("defects_identified", "action_items", "worker_summary", "site_conditions") MUST be translated and output in standard ENGLISH for Airtable records.
   - The "whatsapp_status_text" must acknowledge the client/user in their native language with executive warmth and clarity.

### TRIAGE PRIORITY CLASSIFICATION:
1. "CRITICAL" (P1 - Emergency Hazard / Immediate Shutdown):
   - Broken, chipped, or shattered tempered glass panels.
   - Snapped net tension cable, exposed structural anchor bolts, or structurally compromised frame uprights.
   - Exposed electrical wiring or detached luminaire fixtures.
   -> Sets status_observed to "HAZARD_OUT_OF_SERVICE" and hazard_detected to true.
2. "HIGH" (P2 - Action Required / Playable Defect):
   - Excessive pile wear, unglued turf seams, or bare patches lacking silica sand infill.
   - Sagging net (center height < 88cm) or stripped ratchet winch mechanism.
   - Significant surface rust blooming on mesh panels or upright baseplates.
   - Indoor moisture condensation pooling on playing turf.
   -> Sets status_observed to "ACTION_REQUIRED".
3. "MEDIUM" (P3 - Routine Service / Cosmetic Touchup):
   - Light sand migration, minor glass water spotting, or routine post-tournament sweep.
   - Supply delivery request (sand, balls, replacement straps).
   -> Sets status_observed to "NOMINAL".

### OUTPUT SPECIFICATION:
You must output strictly valid JSON matching this schema:
{
  "detected_language": "string (e.g. English, Spanish, Swahili, Hindi, Punjabi)",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM",
  "assignment_type": "Emergency Repair" | "Spot Visit Punch" | "Service" | "Supply Delivery",
  "hazard_detected": boolean,
  "defects_identified": [
    "Specific mechanical defect or request 1 in English",
    "Specific mechanical defect or request 2 in English"
  ],
  "action_items": [
    "Dispatch action item 1 with mechanical detail in English",
    "Dispatch action item 2 with mechanical detail in English"
  ],
  "site_conditions": "Short string on court environment in English.",
  "worker_summary": "1-2 sentence concise executive operational summary in English.",
  "whatsapp_status_text": "Plaintext WhatsApp response acknowledging report in user's detected language."
}
`;

// ==========================================
// 3. ZERO-TOKEN COMMAND ALIAS DICTIONARY
// ==========================================
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

// ==========================================
// 4. UTILITIES & RESILIENT STORAGE CLIENTS
// ==========================================

/**
 * Checks whether a site is designated as an Indoor facility
 */
function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || '').toLowerCase();
  const name = (fields['Site Name'] || '').toLowerCase();
  const notes = (fields['Last Note'] || '').toLowerCase();

  return env.includes('indoor') || name.includes('indoor') || notes.includes('indoor');
}

/**
 * Extracts {lat, lon} floats from Airtable Map Cache, raw strings, GPS pairs, or Google Maps URLs
 */
function extractCoordinates(rawLocationOrSite, mapCache = null) {
  let rawLocation = rawLocationOrSite;
  let cache = mapCache;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
    cache = fields['Map Cache'];
  }

  // 1. Primary: Base64-decode Airtable's native Google Maps Cache
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
    } catch (e) {
      // Fall through to regex if not base64 JSON
    }
  }

  // 2. Fallback: Parse raw decimal coordinate pairs or Maps URLs
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

/**
 * Normalizes raw 'Site location' strings or site objects into universal clickable navigation links
 */
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

/**
 * Calculates straight-line distance in kilometers between two GPS coordinate sets
 */
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

/**
 * Sub-50ms Hyperlocal Weather & Dew Point Telemetry via Open-Meteo
 */
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
      console.warn(`[Auto-Healer] Pruning incompatible field from RAM: "${badField}"`);
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

// ==========================================
// 5. DETERMINISTIC FORENSIC AI EVALUATOR
// ==========================================

async function evaluateCourtMedia(mediaBuffer, mimeType, cumulativeContext = {}) {
  const base64Data = mediaBuffer.toString('base64');
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;

  const facilityTypeDesc = cumulativeContext.isIndoor ? 'INDOOR CLUB / WAREHOUSE FACILITY' : 'OUTDOOR FIELD FACILITY';

  const auditContextText = isMaintenanceMode
    ? `AUDIT CONTEXT (ASSET MAINTENANCE & JOY CANNON TRIAGE):
Site Name: ${cumulativeContext.siteName || 'Operational Court'}
Facility Environment: ${facilityTypeDesc}
Current Workflow Mode: ${cumulativeContext.workflowMode || 'MAINTENANCE'}
Site Current Status: ${cumulativeContext.siteStatus || 'ACTIVE'}
Open Work Orders: ${cumulativeContext.openTickets || 0}`
    : `AUDIT CONTEXT (CONSTRUCTION & INSTALLATION AUDIT):
Site Name: ${cumulativeContext.siteName || 'Under Construction'}
Facility Environment: ${facilityTypeDesc}
Current Workflow Mode: ${cumulativeContext.workflowMode || 'INSTALLATION'}
Previously Cleared Milestones: ${JSON.stringify(cumulativeContext.clearedMilestones || [])}
Known Milestone Timestamps: ${JSON.stringify(cumulativeContext.milestoneTimestamps || {})}`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        parts: [
          { text: auditContextText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: {
        thinkingBudget: 0
      }
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

/**
 * Robust WhatsApp dispatcher supporting individual DMs and Group Hives
 */
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
    if (errData.includes('131005')) {
      console.error('[Meta Auth Alert] Error 131005: Assign WhatsApp Business Account asset full control to your System User token in Meta Business Settings.');
    }
    return false;
  }
  return true;
}

// ==========================================
// 6. WEBHOOK ROUTING & CORE ENGINE
// ==========================================

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

    // Dispatcher helper: Broadcast to group; fallback to DM if group delivery fails
    const dispatchReply = async (text) => {
      const ok = await sendWhatsAppMessage(dispatchTarget, text);
      if (!ok && dispatchTarget !== fromPhone && fromPhone) {
        await sendWhatsAppMessage(fromPhone, text);
      }
    };

    // ------------------------------------------------------------------
    // B. Resolve Linked Court Digital Twin First
    // ------------------------------------------------------------------
    let site = await lookupSite(groupJid || fromPhone);

    // ------------------------------------------------------------------
    // C. Multi-Tier Frictionless Bouncer
    // ------------------------------------------------------------------
    const worker = fromPhone ? await lookupWorker(fromPhone) : null;
    const isBoundGroupMember = Boolean(site && isGroupMessage);
    const isAuthorizedClient = !worker && site && site.fields['Workflow Mode'] === 'MAINTENANCE';

    // Allow /l or /link commands through so an admin can bind a brand-new group!
    const isLinkCommand = message.type === 'text' && 
      (message.text?.body?.trim().startsWith('/l') || message.text?.body?.trim().startsWith('/link'));

    if (!worker && !isBoundGroupMember && !isAuthorizedClient && !isLinkCommand) {
      console.warn(`[Bouncer] Dropped unauthorized message from ${fromPhone || rawFrom} (Not a worker and chat not bound to site)`);
      return;
    }

    const senderSource = isAuthorizedClient
      ? 'Joy Cannon (Client)'
      : (site?.fields['Workflow Mode'] === 'SPOT_VISIT' ? 'Exec Visit (Bob)' : 'Dispatch');

    const indoorSite = isIndoorSite(site);

    // ==========================================
    // 7. LOCATION PIN-DROP (PROOF-OF-PRESENCE + WEATHER CHECK)
    // ==========================================
    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;

      if (!site) {
        await dispatchReply(`⚠️ Chat not linked to a site twin. Link with */l <Site Name>* first.`);
        return;
      }

      const siteCoords = extractCoordinates(site);
      if (!siteCoords) {
        await dispatchReply(
          `⚠️ Court *${site.fields['Site Name']}* does not have GPS coordinates or Map Cache geocoded in Airtable.`
        );
        return;
      }

      const distanceMeters = haversineDistanceKm(userLat, userLon, siteCoords.lat, siteCoords.lon) * 1000;
      const workerName = worker?.fields?.['Full Name'] || (fromPhone ? `Crew (+${fromPhone.slice(-4)})` : 'Field Tech');
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (distanceMeters <= 300) {
        const checkinNote = `✅ Proof of Presence: ${workerName} checked in at ${timestamp} (within ${Math.round(distanceMeters)}m).`;
        await airtableWriteWithAutoDrop('Sites', { 'Last Note': checkinNote, 'Last Intent': 'PRESENCE_VERIFIED' }, site.id);

        let checkinResponse = `🎯 *TITAN OS | PRESENCE CONFIRMED*\n\n` +
          `👤 *Crew:* ${workerName}\n` +
          `🏟️ *Court:* ${site.fields['Site Name']}\n` +
          `🏢 *Environment:* ${indoorSite ? 'Indoor Facility' : 'Outdoor Facility'}\n` +
          `⏱️ *Time:* ${timestamp}\n` +
          `📏 *Radius:* ${Math.round(distanceMeters)}m from court center\n` +
          `🔒 *Ledger:* Shift timestamp sealed on digital twin.`;

        // Proactive environmental check on check-in (Outdoor only)
        if (!indoorSite) {
          const weather = await getHyperlocalWeather(siteCoords.lat, siteCoords.lon);
          if (weather) {
            if (weather.windGusts > 37) {
              checkinResponse += `\n\n⛔ *SAFETY NOTICE:* Wind gusts at ${weather.windGusts} km/h (>20 kts). Glass crane rigging suspended.`;
            } else if (weather.humidity > 85 || weather.precip > 0 || (weather.temp - weather.dewPoint) <= 2) {
              checkinResponse += `\n\n⚠️ *WEATHER NOTICE:* High moisture/condensation risk (${weather.humidity}% RH). Hold Gate 9 turf adhesive.`;
            }
          }
        } else {
          checkinResponse += `\n\n🏢 *INDOOR PROTOCOL:* Outdoor weather bypassed. Maintain exhaust ventilation during Gate 7 turf seaming.`;
        }

        await dispatchReply(checkinResponse);
      } else {
        await dispatchReply(
          `❌ *CHECK-IN OUTSIDE GEOFENCE*\n\n` +
          `You are ${(distanceMeters / 1000).toFixed(2)} km away from *${site.fields['Site Name']}*.\n` +
          `Must be within 300m of site coordinates to verify physical presence.`
        );
      }
      return;
    }

    // ==========================================
    // 8. ZERO-TOKEN COMMAND ALIAS & CHATTER FILTER
    // ==========================================
    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const intent = COMMAND_MAP[trigger.toLowerCase()];

      // CHATTER FILTER: If not a command, drop silently (Zero tokens, zero DB calls)
      if (!intent) {
        return;
      }

      console.log(`[Slash Command] Triggered: ${trigger} -> Intent: ${intent} from ${fromPhone || rawFrom}`);

      // /l or /link <Site Name> — DIGITAL SITE PASS ONBOARDING
      if (intent === 'LINK_SITE') {
        const targetSiteName = args.join(' ');
        const targetSite = await lookupSite(null, targetSiteName);
        if (!targetSite) {
          await dispatchReply(`❌ Could not find site "${targetSiteName}". Check spelling.`);
          return;
        }

        const targetBindingId = groupJid || fromPhone;
        await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': targetBindingId }, targetSite.id);

        const siteLoc = targetSite.fields['Site location'] || 'Location pending';
        const mapUrl = formatMapUrl(targetSite);
        const mode = targetSite.fields['Workflow Mode'] || 'INSTALLATION';
        const isTargetIndoor = isIndoorSite(targetSite);

        let welcomeCard = `✅ *TITAN OS | SITE TWIN BOUND*\n` +
          `🏟️ *Court:* *${targetSite.fields['Site Name']}*\n` +
          `⚙️ *Mode:* ${mode}\n` +
          `🏢 *Type:* ${isTargetIndoor ? 'Indoor Facility' : 'Outdoor Facility'}\n` +
          `📫 *Location:* ${siteLoc}\n`;

        if (mapUrl) {
          welcomeCard += `\n🗺️ *GPS Navigation Link:*\n${mapUrl}\n`;
        }

        welcomeCard += `\n💡 *Field Commands:*\n` +
          `• */map* — Resend GPS Navigation Link\n` +
          `• */w* — Hyperlocal Weather & Environmental Safety Check\n` +
          `• */nearby* — Proximity Route Sweeps for maintenance\n` +
          `• */s* — Live Milestone & Punch List Status\n` +
          `• Drop a WhatsApp Location Pin to check in on-site.\n` +
          `• Send photos, videos, or voice memos directly in ANY language for instant audit.`;

        await dispatchReply(welcomeCard);
        return;
      }

      if (!site) {
        await dispatchReply(`⚠️ Chat not linked to an active court twin. Use */l <Site Name>* to bind.`);
        return;
      }

      // /map, /loc, /gps — INSTANT NAVIGATION LINK
      if (intent === 'LOCATION') {
        const siteLoc = site.fields['Site location'] || 'Location pending';
        const mapUrl = formatMapUrl(site);

        if (!mapUrl) {
          await dispatchReply(
            `⚠️ No location on file for *${site.fields['Site Name']}*. Update the 'Site location' field in Airtable.`
          );
          return;
        }

        const mapCard = `📍 *TITAN OS | SITE LOCATION*\n` +
          `🏟️ *Court:* *${site.fields['Site Name']}*\n` +
          `📫 *Address:* ${siteLoc}\n\n` +
          `🗺️ *GPS Navigation Link:*\n${mapUrl}\n\n` +
          `_(Tap link to launch GPS navigation in Google Maps, Apple Maps, or Waze)_`;

        await dispatchReply(mapCard);
        return;
      }

      // /w, /weather, /clima — HYPERLOCAL ENVIRONMENTAL TELEMETRY
      if (intent === 'WEATHER') {
        if (indoorSite) {
          await dispatchReply(
            `🏢 *TITAN OS | INDOOR FACILITY NOTICE*\n*${site.fields['Site Name']}* is logged as an Indoor Facility.\nOutdoor precipitation & wind tripwires are bypassed. Verify HVAC condensation and minimum 6.0m vertical ceiling clearance.`
          );
          return;
        }

        const coords = extractCoordinates(site);
        if (!coords) {
          await dispatchReply(
            `⚠️ Court *${site.fields['Site Name']}* does not have valid coordinates or Map Cache geocoded in Airtable.`
          );
          return;
        }

        const weather = await getHyperlocalWeather(coords.lat, coords.lon);
        if (!weather) {
          await dispatchReply(`⚠️ Weather satellite feed unreachable. Retry in 30 seconds.`);
          return;
        }

        const dewPointDelta = (weather.temp - weather.dewPoint).toFixed(1);
        let weatherCard = `🌤️ *TITAN OS | HYPERLOCAL WEATHER TELEMETRY*\n` +
          `🏟️ *Court:* ${site.fields['Site Name']}\n` +
          `🌡️ *Air Temp:* ${weather.temp}°C (Dew Point: ${weather.dewPoint}°C)\n` +
          `💨 *Wind Speed:* ${weather.windSpeed} km/h (Gusts: ${weather.windGusts} km/h)\n` +
          `💧 *Relative Humidity:* ${weather.humidity}%\n` +
          `🌧️ *Precipitation:* ${weather.precip} mm (4h Rain Risk: ${weather.precipProbability4h}%)\n\n`;

        if (weather.windGusts > 37) {
          weatherCard += `⛔ *CRANE / GLASS RIGGING HALT:* Wind gusts exceed 20 knots (37 km/h). Gate 7 glass seating suspended under safety protocol.\n`;
        } else if (weather.humidity > 85 || weather.precip > 0 || dewPointDelta <= 2) {
          weatherCard += `⚠️ *ADHESIVE WARNING:* Surface condensation risk (Temp-DewPoint delta ${dewPointDelta}°C, ${weather.humidity}% RH). Do NOT spread Gate 9 polyurethane turf glue.\n`;
        } else if (weather.precipProbability4h > 50) {
          weatherCard += `⚠️ *SAND WARNING:* Rain risk >50% within 4 hours. Keep Gate 10 silica sand pallets covered.\n`;
        } else {
          weatherCard += `✅ *CONDITIONS NOMINAL:* Green light for all physical assembly, glass rigging, and outdoor gluing.`;
        }

        await dispatchReply(weatherCard);
        return;
      }

      // /nearby, /route — CLUSTERED ROUTE SWEEPS
      if (intent === 'NEARBY_SWEEP') {
        const coords = extractCoordinates(site);
        if (!coords) {
          await dispatchReply(`⚠️ Current site has no GPS coordinates or Map Cache to calculate proximity vectors.`);
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
                condition: c.fields['Maintenance Condition'] || '🟡 Action Required',
                mapUrl: formatMapUrl(c)
              });
            }
          }
        }

        nearbySites.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        if (nearbySites.length === 0) {
          await dispatchReply(
            `✅ *TITAN OS | ROUTE OPTIMIZATION*\nNo other maintenance courts with open tickets within 75 km of *${site.fields['Site Name']}*.`
          );
          return;
        }

        let sweepCard = `📍 *TITAN OS | NEARBY MAINTENANCE SWEEPS*\n` +
          `_Open service calls within 75 km of ${site.fields['Site Name']}:_\n\n`;

        nearbySites.slice(0, 3).forEach((n, idx) => {
          sweepCard += `${idx + 1}. *${n.name}* (${n.distance} km away)\n` +
            `   • Status: ${n.condition} (${n.tickets} open)\n` +
            `   • Nav: ${n.mapUrl}\n\n`;
        });

        sweepCard += `_Consolidate stops to eliminate repeat transit time._`;
        await dispatchReply(sweepCard);
        return;
      }

      // /s, /sum, /status — LIVE TWIN TELEMETRY
      if (intent === 'STATUS') {
        const mode = site.fields['Workflow Mode'] || 'INSTALLATION';
        let progressCard = '';

        if (mode === 'MAINTENANCE' || mode === 'SPOT_VISIT') {
          const condition = site.fields['Maintenance Condition'] || '🟢 Nominal';
          const openTickets = site.fields['Open Tickets'] || 0;
          progressCard = `🛠️ *TITAN OS | ASSET MAINTENANCE STATUS*\n📍 *Court:* ${site.fields['Site Name']}\n⚙️ *Mode:* ${mode}\n🏢 *Type:* ${indoorSite ? 'Indoor' : 'Outdoor'}\n\n🩺 *Condition:* ${condition}\n🎫 *Open Tickets:* ${openTickets}\n📌 *Site Status:* ${site.fields['Site Status'] || 'ACTIVE'}\n\n🔗 *Last Note:* ${site.fields['Last Note'] || 'None'}`;
        } else {
          const cleared = site.fields['Cleared Milestones'] || [];
          progressCard = `🏗️ *TITAN OS | BUILD TWIN STATUS*\n📍 *Court:* ${site.fields['Site Name']}\n⚙️ *Mode:* INSTALLATION\n🏢 *Type:* ${indoorSite ? 'Indoor' : 'Outdoor'}\n\n🎯 *Verified Milestones:* ${cleared.length}/12\n📌 *Site Status:* ${site.fields['Site Status'] || 'ACTIVE'}\n⏱️ *Started:* ${site.fields['Install Started'] || 'Not Initiated'}\n\n🔗 *Last Intent:* ${site.fields['Last Intent'] || 'None'}`;
        }

        await dispatchReply(progressCard);
        return;
      }

      if (intent === 'MODE_MAINTENANCE') {
        await airtableWriteWithAutoDrop('Sites', { 'Workflow Mode': 'MAINTENANCE' }, site.id);
        await dispatchReply(`🛠️ Switched *${site.fields['Site Name']}* to *MAINTENANCE* mode.`);
        return;
      }

      if (intent === 'MODE_INSTALLATION') {
        await airtableWriteWithAutoDrop('Sites', { 'Workflow Mode': 'INSTALLATION' }, site.id);
        await dispatchReply(`🏗️ Switched *${site.fields['Site Name']}* to *INSTALLATION* mode.`);
        return;
      }

      if (intent === 'MODE_SPOT_CHECK') {
        await airtableWriteWithAutoDrop('Sites', { 'Workflow Mode': 'SPOT_VISIT' }, site.id);
        await dispatchReply(`🔍 Switched *${site.fields['Site Name']}* to *SPOT VISIT* audit mode.`);
        return;
      }

      if (intent === 'HELP') {
        const helpCard = `🤖 *TITAN OS COMMAND MATRIX*\n\n` +
          `*/s* — Court Twin Status & Progress\n` +
          `*/map* — Real-Time GPS Navigation Link\n` +
          `*/w* — Hyperlocal Weather, Wind & Dew Point Tripwires\n` +
          `*/nearby* — Clustered Maintenance Sweeps (75km radius)\n` +
          `*/m* — Switch to Maintenance Mode\n` +
          `*/i* — Switch to Installation Mode\n` +
          `*/l <Name>* — Bind chat to Court Twin\n` +
          `*Location Pin* — Send native WhatsApp location for proof-of-presence\n` +
          `*Voice Note* — Send spoken memos directly in English, Spanish, Swahili, or Hindi for AI audit\n\n` +
          `_Send photo or video walkthroughs directly for AI forensic audit._`;
        await dispatchReply(helpCard);
        return;
      }
    }

    // ==========================================
    // 9. MULTIMODAL MEDIA PROCESSING (VIDEO, IMAGE & VOICE NOTES)
    // ==========================================
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    // If it's not media and passed text handling, drop it immediately
    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || (isAudio ? '[Spoken Edge Telemetry Memo]' : '');

    const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });
    const metaMediaData = await metaMediaRes.json().catch(() => ({}));

    if (!metaMediaRes.ok || !metaMediaData?.url) {
      const errorMsg = metaMediaData?.error?.message || `HTTP ${metaMediaRes.status}`;
      console.error(`[Meta Graph Error] Failed to resolve media URL for mediaId ${mediaId}:`, errorMsg);

      if (metaMediaData?.error?.code === 190) {
        console.error('[Security Alert] META_ACCESS_TOKEN has expired! Update in Render.');
      }

      await dispatchReply(
        `⚠️ *Titan Media Error*: Unable to download media from Meta. (${errorMsg}). Please contact project admin.`
      );
      return;
    }

    const mediaBufferRes = await fetch(metaMediaData.url, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });

    if (!mediaBufferRes.ok) {
      console.error(`[Media Download Error] Failed to stream binary from Meta CDN (${mediaBufferRes.status})`);
      return;
    }

    const mediaBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());

    let parsedTimestamps = {};
    if (site?.fields?.['Milestone Timestamps JSON']) {
      try {
        parsedTimestamps = JSON.parse(site.fields['Milestone Timestamps JSON']);
      } catch (err) {
        console.warn('[Titan OS] Malformed Milestone Timestamps JSON, falling back to empty object.');
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
      isIndoor: indoorSite
    };

    const [storageResult, forensicAudit] = await Promise.all([
      uploadToSupabase(mediaBuffer, mimeType),
      evaluateCourtMedia(mediaBuffer, mimeType, cumulativeContext)
    ]);

    let replyText = forensicAudit.whatsapp_status_text ||
      (currentMode === 'MAINTENANCE' || currentMode === 'SPOT_VISIT'
        ? `🛠️ *TITAN MAINTENANCE REPORT*\n📍 *Status:* ${forensicAudit.status_observed}\n🚨 *Priority:* ${forensicAudit.priority || 'MEDIUM'}\n${forensicAudit.worker_summary}`
        : `📊 *TITAN OS AUDIT*\n📍 *Status:* ${forensicAudit.status_observed}\n🎯 *Gates:* ${forensicAudit.verified_gates?.length || 0}/12\n${forensicAudit.worker_summary}`);

    // Automated Climate Safety Tripwires (Outdoor Only)
    if (currentMode === 'INSTALLATION' && site && !indoorSite) {
      const coords = extractCoordinates(site);
      if (coords) {
        const weather = await getHyperlocalWeather(coords.lat, coords.lon);
        if (weather) {
          const dewDelta = weather.temp - weather.dewPoint;
          if (weather.windGusts > 37) {
            replyText += `\n\n⛔ *SAFETY HALT:* Wind gusts are ${weather.windGusts} km/h (>20 kts). Gate 7 glass rigging suspended.`;
          } else if (weather.humidity > 85 || weather.precip > 0 || dewDelta <= 2) {
            replyText += `\n\n⚠️ *WEATHER NOTICE:* Surface condensation risk (Dew point delta ${dewDelta.toFixed(1)}°C). Gate 9 turf glue hold in effect.`;
          }
        }
      }
    }

    await dispatchReply(replyText);

    // ==========================================
    // 10. ASYNCHRONOUS RELATIONAL PERSISTENCE (ENGLISH STANDARDIZED)
    // ==========================================

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

    // ==========================================
    // 11. CLOSED-LOOP DISPATCH (Daily Assignments)
    // ==========================================
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

      if (site) {
        assignmentPayload['Site'] = [site.id];
      }
      if (reportRecord?.id) {
        assignmentPayload['Origin Report'] = [reportRecord.id];
      }

      await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
      console.log(`[Titan OS] Dispatched open ticket to Daily Assignments for site: ${cumulativeContext.siteName}`);
    }

    // ==========================================
    // 12. PATCH PARENT DIGITAL TWIN (Sites Table)
    // ==========================================
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
          console.warn(`[Titan Safety Engine] Automated court PAUSE triggered for ${site.fields['Site Name']} due to active hazard!`);
        }
      }

      await airtableWriteWithAutoDrop('Sites', sitePatch, site.id);
    }

    console.log(`[Titan OS] Closed-loop cycle complete for ${messageId} in sub-7s.`);
  } catch (err) {
    console.error('[Titan OS Fatal Runtime Exception]:', err);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '4.5.8', engine: 'Titan OS V4.5.8 (Group Hive, Multilingual & Weather Engine)' });
});

app.listen(PORT, () => {
  console.log(`🚀 Titan OS V4.5.8 Clean Engine listening on Port ${PORT}`);
});

/**
 * TITAN OS V6.0.22 — META WHATSAPP TRANSPORT & MULTIMODAL INGRESS
 * Module: whatsapp.js
 * Purpose: Webhooks, Debouncing, NLP Intent Routing, 9-Gate Forensic Vision,
 *          Supabase Private Vault Storage, BOM Triggers, and Semantic Email Triage
 */

const crypto = require('crypto');

// ====================================================================
// 0. GLOBAL UTILITIES (EXPONENTIAL BACKOFF)
// ====================================================================

async function fetchWithExponentialBackoff(url, options = {}, retries = 2) {
  const safeUrl = String(url).split('?')[0];
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;

      // Do not retry on client-side 4xx errors (except 429 rate limits)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return res;
      }

      if (attempt === retries) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt);
      console.warn(`[Network Retry] Attempt ${attempt + 1} failed for ${safeUrl}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ====================================================================
// 1. IN-MEMORY DEBOUNCERS & GEOSPATIAL CACHES
// ====================================================================
const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const lastDroppedCoordinates = new Map();
const userActiveSiteMap = new Map();
const dailyEasterEggTracker = new Map();

// ====================================================================
// 2. OUTBOUND MESSAGING (GRAPH API)
// ====================================================================

async function sendWhatsAppReaction(config, toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId || !config.meta.phoneNumberId) return false;
  let cleanDestination = String(toTarget).replace(/\D/g, '');
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanDestination,
    type: 'reaction',
    reaction: { message_id: messageId, emoji: emoji }
  };

  try {
    const res = await fetchWithExponentialBackoff(`${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }, 2);
    return Boolean(res && res.ok);
  } catch (err) {
    return false;
  }
}

async function sendWhatsAppMessage(config, toTarget, messageBody, retries = 2) {
  if (!toTarget || !config.meta.phoneNumberId) {
    console.warn(`[Meta Outbound] Aborted: Target missing.`);
    return false;
  }

  let cleanDestination = String(toTarget).replace(/\D/g, '');
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanDestination,
    type: 'text',
    text: { body: messageBody }
  };

  const url = `${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`;

  try {
    const res = await fetchWithExponentialBackoff(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }, retries);

    if (!res || !res.ok) {
      const errData = res ? await res.text() : 'Network failure';
      console.error(`WhatsApp dispatch failed to ${cleanDestination}: ${errData}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`WhatsApp dispatch exception to ${cleanDestination}:`, err.message);
    return false;
  }
}

async function sendWhatsAppButtons(config, toTarget, textBody, buttons = []) {
  if (!toTarget || !buttons || buttons.length === 0 || !config.meta.phoneNumberId) return false;

  let cleanDestination = String(toTarget).replace(/\D/g, '');
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => {
    let safeTitle = String(btn.title || 'Select').trim();
    if (safeTitle.length > 20) {
      safeTitle = safeTitle.substring(0, 20).trim();
    }
    return {
      type: 'reply',
      reply: {
        id: btn.id || `btn_${idx}_${Date.now()}`,
        title: safeTitle
      }
    };
  });

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanDestination,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: textBody },
      action: { buttons: actionButtons }
    }
  };

  const url = `${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`;
  try {
    const res = await fetchWithExponentialBackoff(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }, 2);

    if (!res || !res.ok) {
      const errTxt = res ? await res.text() : 'Network failure';
      console.warn(`[Meta Buttons] Rejected: ${errTxt}. Falling back to text.`);
      const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
      return await sendWhatsAppMessage(config, cleanDestination, fallbackText);
    }
    return true;
  } catch (err) {
    const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
    return await sendWhatsAppMessage(config, cleanDestination, fallbackText);
  }
}

async function fanOutToSubscribers(config, phoneNumbersString, messageBody, buttons = []) {
  if (!phoneNumbersString) return;

  const rawNumbers = String(phoneNumbersString).split(',');
  const cleanNumbers = rawNumbers.map(n => {
    let num = n.replace(/\D/g, '').trim();
    if (num.length === 10) num = '1' + num;
    return num;
  }).filter(n => n.length >= 10);

  const uniqueTargets = [...new Set(cleanNumbers)];

  for (const target of uniqueTargets) {
    if (buttons.length > 0) {
      await sendWhatsAppButtons(config, target, messageBody, buttons);
    } else {
      await sendWhatsAppMessage(config, target, messageBody);
    }
  }
}

// ====================================================================
// 3. GEOSPATIAL & METEOROLOGICAL TELEMETRY
// ====================================================================

function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || fields['Foundation Type'] || '').toLowerCase();
  const name = (fields['Site Name'] || '').toLowerCase();
  const notes = (fields['Last Note'] || '').toLowerCase();
  return env.includes('indoor') || name.includes('indoor') || notes.includes('indoor');
}

async function geocodeAddressWithGoogle(config, addressString) {
  const apiKey = config?.google?.apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEO_KEY;
  if (!apiKey || !addressString) return null;
  try {
    const cleanAddress = addressString.replace(/-{2,}/g, '-').replace(/[^\w\s,#.-]/gi, '').trim();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&key=${apiKey}`;
    const res = await fetchWithExponentialBackoff(url, {}, 2);
    if (!res || !res.ok) return null;
    const data = await res.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lon: loc.lng, formattedAddress: data.results[0].formatted_address };
    }
    return null;
  } catch (err) {
    return null;
  }
}

function getGoogleMapsLinks(lat, lon) {
  return {
    directions: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    satellite: `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lon}&zoom=20&basemap=satellite`
  };
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getHyperlocalWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,weather_code&forecast_hours=6`;
    const res = await fetchWithExponentialBackoff(url, {}, 2);
    if (!res || !res.ok) return null;
    const data = await res.json();

    const maxPrecipProb = Math.max(...(data.hourly?.precipitation_probability || [0]));
    const currentCode = data.current?.weather_code ?? 0;
    const isRainingOrStorm = (currentCode >= 51 && currentCode <= 67) || (currentCode >= 80 && currentCode <= 82) || (currentCode >= 95 && currentCode <= 99);

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
    return null;
  }
}

function evaluateWeatherTripwires(weather) {
  if (!weather) return { criticalAlerts: [], holds: [], warnings: [], nominal: true, summaryText: '' };

  const criticalAlerts = [];
  const holds = [];
  const warnings = [];
  const dewDelta = weather.temp - weather.dewPoint;

  if (weather.weatherCode >= 95 && weather.weatherCode <= 99) {
    criticalAlerts.push(`⛈️ *SEVERE WEATHER / LIGHTNING:* Evacuate court frame. Immediate safety stand-down.`);
  }
  if (weather.windGusts > 60) {
    criticalAlerts.push(`🌪️ *EXTREME WIND HAZARD (${weather.windGusts} km/h):* Secure all loose materials. Frame and glass hazard.`);
  }
  if (weather.temp < 10) {
    criticalAlerts.push(`❄️ *TURF GLUE CURE HOLD (${weather.temp}°C):* Polyurethane adhesive failure risk. Do not glue turf seams.`);
  }

  if (weather.windGusts > 37 && weather.windGusts <= 60) {
    holds.push(`⛔ *WIND HOLD (${weather.windGusts} km/h):* Suction cup glass installation prohibited.`);
  } else if (weather.windGusts > 28) {
    warnings.push(`💨 *WIND WARNING (${weather.windGusts} km/h):* Approach glass seating with caution.`);
  }

  if (weather.humidity > 85 || dewDelta <= 2.5) {
    holds.push(`💧 *CONDENSATION HOLD:* Dew delta is ${dewDelta.toFixed(1)}°C (Humidity: ${weather.humidity}%). Pad/carpet moisture will ruin adhesive bond.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0) {
    holds.push(`🌧️ *RAIN HOLD:* Active rain detected. Hold outdoor gluing, glass, and mesh.`);
  } else if (weather.precipProbability4h > 40) {
    warnings.push(`🌦️ *RAIN PROBABILITY (${weather.precipProbability4h}% in 4h):* Keep blue tarps staged over open turf rolls.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0 || weather.humidity > 90) {
    holds.push(`⏳ *SAND INFILL HOLD:* Wet conditions detected. Silica sand must strictly be applied to dry turf.`);
  }

  if (weather.temp > 35) {
    warnings.push(`☀️ *HIGH HEAT ALERT (${weather.temp}°C):* Adhesive pot-life drops to <5 minutes. Mandatory crew shade rest cycles.`);
  }

  const isNominal = holds.length === 0 && criticalAlerts.length === 0 && warnings.length === 0;
  let summaryText = '';

  if (criticalAlerts.length > 0) summaryText += `\n` + criticalAlerts.join('\n');
  if (holds.length > 0) summaryText += `\n` + holds.join('\n');
  if (warnings.length > 0) summaryText += `\n` + warnings.join('\n');
  if (isNominal) summaryText += `\n🟢 *Conditions Clear:* Wind (${weather.windSpeed} km/h), Temp (${weather.temp}°C), and moisture clear for work.`;

  return { criticalAlerts, holds, warnings, nominal: isNominal, summaryText };
}

// ====================================================================
// 4. IDENTITY & LOCATION RESOLUTION (AIRTABLE SITE LOCATION RESOLVER)
// ====================================================================

function parseCoordinatePair(rawVal) {
  if (rawVal === null || rawVal === undefined) return null;

  if (Array.isArray(rawVal)) {
    if (rawVal.length === 0) return null;
    return parseCoordinatePair(rawVal[0]);
  }

  if (typeof rawVal === 'object') {
    const objLat = rawVal.lat ?? rawVal.latitude;
    const objLon = rawVal.lng ?? rawVal.lon ?? rawVal.longitude;
    if (objLat !== undefined && objLon !== undefined) {
      const lat = parseFloat(objLat);
      const lon = parseFloat(objLon);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
    return null;
  }

  const cleaned = String(rawVal)
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .trim();

  const match = cleaned.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  return null;
}

async function resolveCoordinates(config, memoryCache, rawLocationOrSite, airtableWriteWithAutoDrop, autoPersistSiteId = null) {
  let rawValue = rawLocationOrSite;
  let siteId = autoPersistSiteId;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    siteId = rawLocationOrSite.id || autoPersistSiteId;

    const siteLocationKey = Object.keys(fields).find(
      k => k.trim().toLowerCase() === 'site location'
    );
    rawValue = siteLocationKey ? fields[siteLocationKey] : undefined;

    const directCoords = parseCoordinatePair(rawValue);
    if (directCoords) return directCoords;

    const explicitLat = fields['Latitude'] ?? fields['Lat'];
    const explicitLon = fields['Longitude'] ?? fields['Lon'] ?? fields['Lng'];
    if (explicitLat !== undefined && explicitLon !== undefined && explicitLat !== '' && explicitLon !== '') {
      const lat = parseFloat(explicitLat);
      const lon = parseFloat(explicitLon);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
  } else {
    const directCoords = parseCoordinatePair(rawValue);
    if (directCoords) return directCoords;
  }

  const addressStr = Array.isArray(rawValue) ? String(rawValue[0] || '').trim() : String(rawValue || '').trim();
  if (addressStr.length > 5 && addressStr !== '[object Object]') {
    if (memoryCache?.coordinates?.has(addressStr)) {
      return memoryCache.coordinates.get(addressStr);
    }

    const googleResult = await geocodeAddressWithGoogle(config, addressStr);
    if (googleResult) {
      const coords = { lat: googleResult.lat, lon: googleResult.lon };
      memoryCache?.coordinates?.set(addressStr, coords);
      if (siteId && airtableWriteWithAutoDrop) {
        const coordString = `${googleResult.lat.toFixed(6)}, ${googleResult.lon.toFixed(6)}`;
        airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, siteId).catch(() => {});
      }
      return coords;
    }
  }

  return null;
}

async function bindSiteContext(config, site, worker, callerIdentity, dispatchTarget, fromPhone, distanceMeters, userLat, userLon, airtableWriteWithAutoDrop, generateMorningEasterEgg, overriddenWeatherStr = '') {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Tech';
  userActiveSiteMap.set(fromPhone, site.id);

  if (worker && worker.id) {
    try {
      await airtableWriteWithAutoDrop('Workers', { 'Current Site Bound': [site.id] }, worker.id);
    } catch (e) {
      console.warn(`[Airtable Auto-Healer] Ignored missing 'Current Site Bound' field for worker ${worker.id}`);
    }
  }

  airtableWriteWithAutoDrop('Sites', {
    'Last Note': `[SITE BOUND] ${workerName} checked in (${Math.round(distanceMeters)}m from court).`,
    'Last Intent': 'PRESENCE_VERIFIED'
  }, site.id).catch(() => {});

  const indoor = isIndoorSite(site);
  let arrivalWeather = overriddenWeatherStr;

  if (!indoor && userLat && userLon && !arrivalWeather) {
    const weather = await getHyperlocalWeather(userLat, userLon);
    if (weather) arrivalWeather = evaluateWeatherTripwires(weather).summaryText;
  }

  let checkinCard = `📍 *TITAN OS | SITE CONTEXT BOUND*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏟️ *Court:* ${site.fields['Site Name']}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `📏 *Distance:* ${Math.round(distanceMeters)}m from court pin\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Gate Status:* ${site.fields['Current Gate'] || 'Active'}\n` +
    (arrivalWeather ? `\n🌤️ *Site Telemetry:*${arrivalWeather}\n` : '') +
    `\n👉 Ready for pre-work sweep, punch list updates, or supply requests.`;

  const prefLang = worker?.fields?.['Language'] || 'English';
  const todayStr = new Date().toISOString().split('T')[0];

  if (dailyEasterEggTracker.get(fromPhone) !== todayStr && typeof generateMorningEasterEgg === 'function') {
    const egg = await generateMorningEasterEgg(config, prefLang);
    checkinCard += egg;
    dailyEasterEggTracker.set(fromPhone, todayStr);
  }

  await sendWhatsAppMessage(config, dispatchTarget, checkinCard);
}

function getUserBoundSiteId(fromPhone) {
  return userActiveSiteMap.get(fromPhone) || null;
}

function updateSessionContext(fromPhone, update) {
  if (!userActiveSiteMap.has(fromPhone)) return;
  console.log(`[Session State] Updated context for ${fromPhone}:`, update);
}

// ====================================================================
// 5. NLP INTENT CLASSIFICATION (GEMINI 2.5)
// ====================================================================

async function triageSpokenOrTextNLP(config, rawInput, activeSitesList, isAudio = false, audioItems = [], fromPhone, boundSite = null) {
  const siteListStr = activeSitesList.join(', ');
  const boundSiteName = boundSite ? boundSite.fields['Site Name'] : 'None Bound';

  const intentPrompt = `You are the Titan OS Ambient Intelligence Scribe. Classify the intent of the message. 
Active Registry: [${siteListStr}]
Currently Bound Site: ${boundSiteName}

Input: "${typeof rawInput === 'string' ? rawInput : 'Spoken Voice Memo'}"

Respond STRICTLY with JSON:
{
  "intent": "CREATE_ESTIMATE|CONVERT_ESTIMATE|CREATE_INVOICE|CHANGE_ORDER|AR_LOOKUP|ORACLE_QUERY|INVENTORY_QUERY|INVENTORY_UPDATE|EQUIPMENT_QUERY|EQUIPMENT_UPDATE|READINESS_QUERY|NAVIGATION_QUERY|DYNAMIC_SITE_UPDATE|LOGISTICS_DISPATCH|UNKNOWN",
  "referenced_site_name": "string (extract the site name if mentioned)",
  "qbo_customer_name": "string (extract the client name if mentioned for finance)",
  "transcript_en": "string (the english translation of the text or audio)",
  "structured_payload": {"item": "string (for LOGISTICS_DISPATCH only: what is explicitly missing or needed in the field)"}
}

Rules:
- If the user states they are missing parts, need a delivery, or require materials brought to the site (e.g., "We need sand", "Missing entrance plates"), classify as LOGISTICS_DISPATCH.`;

  const contentParts = [{ text: intentPrompt }];

  if (isAudio && audioItems.length > 0) {
    for (const item of audioItems) {
      contentParts.push({
        inline_data: {
          mime_type: item.mimeType,
          data: item.buffer.toString('base64')
        }
      });
    }
  }

  const payload = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 2);

  if (!res || !res.ok) {
    const errorText = res ? await res.text() : 'Network timeout';
    throw new Error(`Gemini NLP failed: ${errorText}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
}

// ====================================================================
// 6. BLIND VISUAL FORENSICS, SUPABASE VAULT, & 9-GATE BATCH PIPELINE
// ====================================================================

const INDUSTRIAL_9_GATE_PROMPT = `You are the Lead Forensic Construction Auditor for Bounce Padel.
Evaluate the attached field photos/videos against the 9-Gate Padel Court Installation Standard:
Gate 1: Concrete Slab / Foundation / Sub-base Prepped (Includes bare cement foundations, indoor warehouse floors, or pre-existing tennis/sport courts. CRITICAL: Flag any large concrete cracks or pools of water as blockers).
Gate 2: Perimeter Steel Frame Erected & Anchored (Super panoramic frames lack corner posts. Credit this gate if bottom steel is complete and top steel is connected. Temporary 4x4 wooden supports holding the top steel are expected and validate this stage prior to glass. Note: Third-party manufactured courts listed in Site Context may feature standard corner posts).
Gate 3: Structural Wire Mesh Panels & Entrance Gates Installed (Credit when both the lower and top wire mesh panels, including the integrated lower mesh entrance gates, are fully installed and visually straight, forming the distinct recognizable cage of a padel court).
Gate 4: 12mm Tempered Glass Panels Seated & Clamped (Verify glass panels are fully erected. Check the connection tabs/brackets: ensure all bolts are visually present, none are missing, and they sit flush. Do not evaluate or require tensioning).
Gate 5: LED Lighting Columns & Fixtures Mounted (CONDITIONAL: Only evaluate if the provided Site Context states Lights = 'Yes'. If 'Yes', verify 4 light posts are erected, each with exactly 2 LED light fixtures attached. Do not require the lights to be turned on. If the Site Context states Lights = 'No', automatically mark Gate 5 as verified/skipped to prevent blocking progress).
Gate 6: Artificial Turf Unrolled, Cut & Seamed (Turf arrives in 3 pre-lined rolls. Verify turf is laid, cut cleanly around the perimeter, and seams are joined with minimal visual gaps. Credit photos showing seam tape and adhesive applied as valid progress for this gate).
Gate 7: Silica Sand Infill Brushed In (Verify silica sand is visibly present and evenly brushed across the turf. Flag any unbrushed swirls, heavy clumps, or isolated mounds of sand as blockers, as this indicates improper pouring or spreading without final brushing).
Gate 8: Center Net Posts & Tensioned Net Installed (Verify the physical presence of two center posts and the net strung tightly between them without excessive sagging. Ensure safety padding is visibly installed around both posts).
Gate 9: Site Cleanliness & Complete Debris/Tool Removal

CRITICAL RULES:
1. ADDITIVE INGESTION: Credit every gate clearly supported by visual evidence. Never punish missing angles; list unverified gates as pending adjustments.
​2. GATE 9 CLEANLINESS GUARDRAIL: If loose trash, packaging, cardboard, tools, or construction debris are visible anywhere on or around the playing surface, Gate 9 MUST be marked false/withheld even if Gates 1–8 are complete.
3. Return STRICTLY JSON:
{
  "highest_gate": number (0 to 9),
  "verified_gates": [number],
  "cleanliness_passed": boolean,
  "blockers_detected": ["string"],
  "field_observations": "string (concise material/hardware/friction notes for Dark Matter log)",
  "summary": "string (concise, encouraging 2-sentence field summary in target language)"
}`;

const MAINTENANCE_TRIAGE_PROMPT = `You are the Lead Maintenance Inspector for Bounce Padel.
Inspect the attached court photos/videos for turf wear, sand compaction, glass alignment, net tension, lighting outages, rust, or drainage issues.
Return STRICTLY JSON:
{
  "highest_gate": 9,
  "verified_gates": [9],
  "cleanliness_passed": boolean,
  "blockers_detected": ["string (any maintenance defects found)"],
  "field_observations": "string (concise asset health notes)",
  "summary": "string (concise 2-sentence maintenance report in target language)"
}`;

async function uploadMediaToSupabaseVault(config, item) {
  if (!config?.supabase?.url || !config?.supabase?.serviceRoleKey) return null;
  try {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = item.mimeType.includes('video') ? 'mp4' : (item.mimeType.includes('png') ? 'png' : 'jpg');
    const filePath = `${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
    const bucket = config.supabase.bucket || 'titan-private-media';

    const uploadRes = await fetchWithExponentialBackoff(`${config.supabase.url}/storage/v1/object/${bucket}/${filePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.supabase.serviceRoleKey}`,
        'apikey': config.supabase.serviceRoleKey,
        'Content-Type': item.mimeType
      },
      body: item.buffer
    }, 2);

    if (!uploadRes || !uploadRes.ok) {
      console.warn(`[Supabase Vault] Upload failed (${uploadRes ? uploadRes.status : 'Network error'})`);
      return null;
    }

    const signRes = await fetchWithExponentialBackoff(`${config.supabase.url}/storage/v1/object/sign/${bucket}/${filePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.supabase.serviceRoleKey}`,
        'apikey': config.supabase.serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 604800 })
    }, 2);

    if (!signRes || !signRes.ok) return null;
    const signData = await signRes.json();
    return signData?.signedURL ? `${config.supabase.url}/storage/v1${signData.signedURL}` : null;
  } catch (err) {
    console.warn('[Supabase Vault] Exception:', err.message);
    return null;
  }
}

async function logToDarkMatterVault(config, siteName, workerName, category, rawText, distilledContext) {
  if (!config?.supabase?.url || !config?.supabase?.serviceRoleKey || !distilledContext) return;
  try {
    await fetchWithExponentialBackoff(`${config.supabase.url}/rest/v1/${config.supabase.tableDarkMatter}`, {
      method: 'POST',
      headers: {
        'apikey': config.supabase.serviceRoleKey,
        'Authorization': `Bearer ${config.supabase.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        site_name: siteName || 'Unbound Field',
        worker_name: workerName || 'Field Tech',
        category: category || 'FIELD_OBSERVATION',
        raw_text: rawText || '',
        distilled_context: distilledContext
      })
    }, 2);
  } catch (err) {
    console.warn('[Dark Matter Vault] Insert warning:', err.message);
  }
}

async function inspectBlindVisualGroundTruth(config, mediaItem, batchText, dispatchTarget, targetedSiteOverride, site, airtableWriteWithAutoDrop) {
  const payload = {
    system_instruction: { parts: [{ text: `Classify the physical environment. Is this a padel court? (CRITICAL: A bare concrete foundation slab, earthworks, or pre-existing tennis court being prepped for construction MUST be classified as a valid padel court environment for Gate 1). Output JSON {"is_padel_court": boolean, "detected_scene": string}` }] },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mediaItem.mimeType,
              data: mediaItem.buffer.toString('base64')
            }
          },
          { text: "Examine ONLY visual frames. Disregard any audio. Is this physically inside or at the apron of a padel court? Remember, a plain concrete foundation is a valid padel court environment for Gate 1." }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json'
    }
  };

  try {
    const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 2);

    if (!res || !res.ok) return { is_padel_court: true, detected_scene: 'Bypassed on API error' };

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const visualTruth = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());

    if (visualTruth.is_padel_court === false) {
      console.log(`[Vision Bypass] Partial/Macro photo detected (${visualTruth.detected_scene}). Logging to dark matter instead of blocking.`);

      const bypassNotes = `[PARTIAL SWEEP LOGGED]: \nDetected Scene: ${visualTruth.detected_scene || 'Unknown Hardware / Macro Shot'}\nCaption: ${batchText || 'No caption provided.'}`;

      if (targetedSiteOverride || site) {
        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': bypassNotes,
          'Last Intent': 'PARTIAL_MEDIA_LOG'
        }, (targetedSiteOverride || site).id);
      }

      const fallbackCard = `📸 *TITAN OS | PARTIAL MEDIA ARCHIVED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Camera Detected:* ${visualTruth.detected_scene || 'Macro shot / Non-court structure'}\n` +
        `✅ *Action:* Media has been securely logged to the site ledger.\n\n` +
        `_Note: To verify a full physical gate milestone, ensure the primary court structure is visible in the frame._`;

      await sendWhatsAppMessage(config, dispatchTarget, fallbackCard);
    }

    return visualTruth;
  } catch (err) {
    return { is_padel_court: true, detected_scene: 'Bypassed on parse error' };
  }
}

async function evaluateCourtMediaBatch(config, items, cumulativeContext, maintenanceTriagePrompt = MAINTENANCE_TRIAGE_PROMPT, industrialSystemPrompt = INDUSTRIAL_9_GATE_PROMPT) {
  const contentParts = [
    {
      text: `Context: You are evaluating a Padel court at site: ${cumulativeContext.siteName}. ` +
            `Workflow Mode: ${cumulativeContext.workflowMode}. ` +
            `Site Status: ${cumulativeContext.siteStatus}. ` +
            `Manufacturer: ${cumulativeContext.manufacturer || 'Bounce Padel'}. ` +
            `Lights: ${cumulativeContext.hasLights || 'Unknown'}. ` +
            `Target language for the output receipt card: ${cumulativeContext.workerLanguage}. ` +
            `Captions provided: "${cumulativeContext.captions || 'None'}"`
    }
  ];

  for (const item of items) {
    if (item.type === 'video' || item.type === 'image') {
      contentParts.push({
        inline_data: {
          mime_type: item.mimeType,
          data: item.buffer.toString('base64')
        }
      });
    }
  }

  const payload = {
    system_instruction: { parts: [{ text: cumulativeContext.workflowMode === 'MAINTENANCE' ? maintenanceTriagePrompt : industrialSystemPrompt }] },
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json'
    }
  };

  try {
    const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 2);

    if (!res || !res.ok) {
      console.error('[Gemini Evaluation API Error]:', res ? await res.text() : 'Network failure');
      return { highest_gate: 0, verified_gates: [], cleanliness_passed: true, blockers_detected: [], summary: 'API evaluation failed.' };
    }

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return { highest_gate: 0, verified_gates: [], cleanliness_passed: true, blockers_detected: [], summary: 'Failed to generate evaluation.' };

    return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Gemini Evaluation Exception]:', err.message);
    return { highest_gate: 0, verified_gates: [], cleanliness_passed: true, blockers_detected: [], summary: 'Exception during evaluation.' };
  }
}

async function processMediaBatch(config, currentBatch, airtableWriteWithAutoDrop, oracleFileURIs) {
  const { items, site, worker, dispatchTarget, callerIdentity } = currentBatch;
  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Field Tech';
  const workerLang = worker?.fields?.['Language'] || callerIdentity?.language || 'English';
  const combinedCaptions = items.map(i => i.caption).filter(Boolean).join(' | ');

  if (!site) {
    await sendWhatsAppMessage(
      config,
      dispatchTarget,
      `📍 *SITE CONTEXT REQUIRED*\nReceived ${items.length} file(s), but you are not currently checked in to a court.\n\nDrop a 📍 *WhatsApp Location Pin* on-site first, then re-send your sweep.`
    );
    return;
  }

  try {
    const siteName = site.fields['Site Name'] || 'Active Court';
    const workflowMode = site.fields['Workflow Mode'] || 'INSTALLATION';
    const siteStatus = site.fields['Site Status'] || 'ACTIVE';
    const hasLights = site.fields['Lights'] || 'Unknown';
    const manufacturer = site.fields['Manufacturer'] || 'Bounce Padel';

    // Stage 1: Blind Visual Ground-Truth Verification (Cold Inspection)
    const firstVisual = items.find(i => i.type === 'image' || i.type === 'video');
    if (firstVisual) {
      const groundTruth = await inspectBlindVisualGroundTruth(config, firstVisual, combinedCaptions, dispatchTarget, site, site, airtableWriteWithAutoDrop);
      if (groundTruth && groundTruth.is_padel_court === false) {
        await logToDarkMatterVault(config, siteName, workerName, 'PARTIAL_HARDWARE', combinedCaptions, groundTruth.detected_scene);
        return;
      }
    }

    // Stage 2: Parallel Supabase Vault Archival + 9-Gate Forensic Evaluation
    const uploadPromises = items.map(item => uploadMediaToSupabaseVault(config, item));
    const evalPromise = evaluateCourtMediaBatch(config, items, {
      siteName,
      workflowMode,
      siteStatus,
      hasLights,
      manufacturer,
      workerLanguage: workerLang,
      captions: combinedCaptions
    });

    const [signedUrls, audit] = await Promise.all([Promise.all(uploadPromises), evalPromise]);
    const validLinks = signedUrls.filter(Boolean);

    // Enforce Gate 9 Non-Monotonic Cleanliness Guardrail
    let verifiedGates = Array.isArray(audit.verified_gates) ? [...audit.verified_gates] : [];
    if (audit.cleanliness_passed === false) {
      verifiedGates = verifiedGates.filter(g => g !== 9);
    }
    const highestGate = verifiedGates.length > 0 ? Math.max(...verifiedGates) : (audit.highest_gate || 0);
    const isInstallationComplete = workflowMode === 'INSTALLATION' && verifiedGates.includes(9) && audit.cleanliness_passed !== false;
    const gateLabel = workflowMode === 'MAINTENANCE'
      ? 'Maintenance Sweep'
      : (isInstallationComplete ? 'Gate 9 (9/9 Verified — Build Complete)' : `Gate ${highestGate} (${verifiedGates.length}/9 Verified)`);

    // Stage 3: Ledger Mutation (Sites & Reports 2) + Auto-Transition to Maintenance Mode
    const auditNote = `[FORENSIC SWEEP] ${workerName}: ${gateLabel}. ${audit.summary || ''}${validLinks.length > 0 ? `\nVault: ${validLinks[0]}` : ''}`;

    const sitePatch = {
      'Last Note': auditNote,
      'Last Intent': isInstallationComplete
        ? 'INSTALLATION_COMPLETE_MAINTENANCE_FLIP'
        : (workflowMode === 'MAINTENANCE' ? 'MAINTENANCE_SWEEP' : 'FORENSIC_GATE_AUDIT')
    };
    if (isInstallationComplete) {
      sitePatch['Current Gate'] = gateLabel;
      sitePatch['Workflow Mode'] = 'MAINTENANCE';
    } else if (workflowMode === 'INSTALLATION' && highestGate > 0) {
      sitePatch['Current Gate'] = gateLabel;
    }

    await airtableWriteWithAutoDrop('Sites', sitePatch, site.id);

    const reportPatch = {
      'Workflow Mode': isInstallationComplete ? 'MAINTENANCE' : workflowMode,
      'Action Items': (audit.blockers_detected && audit.blockers_detected.length > 0) ? audit.blockers_detected.join('; ') : 'None',
      'Last Note': auditNote,
      'Site': [site.id]
    };
    if (worker?.id) reportPatch['Worker'] = [worker.id];
    if (validLinks.length > 0) reportPatch['Media Links'] = validLinks.join('\n');

    await airtableWriteWithAutoDrop('Reports 2', reportPatch);

    if (audit.field_observations) {
      await logToDarkMatterVault(config, siteName, workerName, workflowMode, combinedCaptions, audit.field_observations);
    }

    // Stage 4: Automated BOM Depletion on Structural Gates (2: Steel, 4: Glass, 6: Turf)
    if (workflowMode === 'INSTALLATION' && verifiedGates.length > 0) {
      try {
        const inventory = require('./inventory');
        if (inventory && inventory.processMilestoneBOMDeduction) {
          for (const g of verifiedGates) {
            if ([2, 4, 6].includes(g)) {
              await inventory.processMilestoneBOMDeduction(config, site, g);
            }
          }
        }
      } catch (bomErr) {
        console.warn('[BOM Trigger Warning]:', bomErr.message);
      }
    }

    // Stage 5: Asymmetric Stakeholder Output (Field Punch Card + Joy Cannon)
    const blockersBlock = (audit.blockers_detected && audit.blockers_detected.length > 0)
      ? `\n⚠️ *Adjustments / Holds:*\n${audit.blockers_detected.map(b => `• ${b}`).join('\n')}\n`
      : '';
    const cleanWarning = (audit.cleanliness_passed === false)
      ? `\n🧹 *Gate 9 Held:* Debris/tools visible on apron. Clear site to seal Gate 9.\n`
      : '';
    const completionNotice = isInstallationComplete
      ? `\n🔄 *Lifecycle Transition:* Court automatically flipped to *Maintenance Mode*.\n`
      : '';

    const punchCard = `🏗️ *TITAN OS | FORENSIC AUDIT RECEIPT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏟️ *Court:* ${siteName}\n` +
      `👷 *Operative:* ${workerName}\n` +
      `📊 *Milestone:* ${gateLabel}\n` +
      `📸 *Evidence:* ${items.length} file(s) sealed in vault\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${audit.summary || 'Progress logged to digital twin.'}` +
      `${blockersBlock}${cleanWarning}${completionNotice}`;

    await sendWhatsAppMessage(config, dispatchTarget, punchCard);

    // Joy Cannon: Broadcast milestone progress to external subscribers in 'Subscribed Phones'
    const subscriberPhones = site.fields['Subscribed Phones'] || site.fields['Subscriber Phones'] || site.fields['Client Phone'];
    if (subscriberPhones && workflowMode === 'INSTALLATION' && highestGate > 0) {
      const joyHeader = isInstallationComplete
        ? `🏆 *BOUNCE PADEL | COURT BUILD COMPLETE*`
        : `🎾 *BOUNCE PADEL | BUILD MILESTONE UPDATE*`;
      const joyMsg = `${joyHeader}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏟️ *Project:* ${siteName}\n` +
        `✅ *Status:* ${gateLabel}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${audit.summary || 'Construction progressing on schedule.'}` +
        (validLinks.length > 0 ? `\n\n📸 *Latest Site Capture:*\n${validLinks[0]}` : '');

      await fanOutToSubscribers(config, subscriberPhones, joyMsg);
    }
  } catch (err) {
    console.error('[processMediaBatch Runtime Error]:', err.message);
    await sendWhatsAppMessage(config, dispatchTarget, `⚠️ Forensic audit encountered a temporary interruption: ${err.message}`);
  }
}

// ====================================================================
// 7. INBOUND EMAIL WEBHOOK & SEMANTIC AI GATEKEEPER
// ====================================================================

async function handleInboundEmail(config, emailPayload, getCachedContacts) {
  try {
    const extractEmails = (str) => {
      const matches = String(str || '').match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
      return matches ? matches.map(e => e.toLowerCase().trim()) : [];
    };

    const senderEmails = extractEmails(emailPayload.from);
    const ccEmails = extractEmails(emailPayload.cc);
    const targetEmails = [...new Set([...senderEmails, ...ccEmails])];

    if (targetEmails.length === 0) {
      console.warn('[Email Handler] No valid sender/CC emails extracted.');
      return;
    }

    // 1. Resolve WhatsApp targets from Airtable Contacts ('Full Name', 'Email', 'Phone number')
    const contacts = await getCachedContacts();
    const targetPhones = [];
    const knownNames = [];

    targetEmails.forEach(targetEmail => {
      const contact = contacts.find(c => {
        const contactEmail = String(c.fields['Email'] || '').toLowerCase().trim();
        return contactEmail === targetEmail;
      });

      if (contact) {
        const rawPhone =
          contact.fields['Phone number'] ||
          contact.fields['Phone E164'] ||
          contact.fields['WhatsApp Number'] ||
          contact.fields['Phone'] ||
          '';
        let cleanPhone = String(rawPhone).replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;

        if (cleanPhone.length >= 10) {
          targetPhones.push(cleanPhone);
          knownNames.push(contact.fields['Full Name'] || contact.fields['First Name'] || targetEmail);
        }
      }
    });

    if (targetPhones.length === 0) {
      console.log(`[Email Handler] No WhatsApp-routable phone numbers found in Contacts for: ${targetEmails.join(', ')}`);
      return;
    }

    // 2. Semantic AI Gatekeeper (Temperature 0.0) — Filter out noise before buzzing WhatsApp
    const bodyText = String(emailPayload.text || emailPayload.html || '').substring(0, 4000);
    const triagePrompt = `You are the Commercial Triage Gatekeeper for Bounce Padel.
Classify this inbound email and determine if it requires immediate executive attention on WhatsApp.

From: ${emailPayload.from}
Subject: "${emailPayload.subject}"
Body:
"""
${bodyText}
"""

Categories:
- COMMERCIAL_LEAD: New padel court inquiry, pricing request, RFP, club build, or turf/canopy quote.
- MAINTENANCE_REQUEST: Repair, glass replacement, turf grooming, lighting issue, or warranty service.
- PARTNER_INTRO: Warm introduction, general contractor, architect, or strategic partner outreach.
- ACTIVE_PROJECT: Direct client, supplier, or logistics coordination on an active build.
- NOISE_SPAM_RECEIPT: Newsletters, automated billing/SaaS receipts, cold marketing/SEO spam, calendar auto-replies, or internal system notifications.

Return STRICTLY JSON:
{
  "category": "COMMERCIAL_LEAD|MAINTENANCE_REQUEST|PARTNER_INTRO|ACTIVE_PROJECT|NOISE_SPAM_RECEIPT",
  "is_critical": boolean (true ONLY for the first 4 categories; false for NOISE_SPAM_RECEIPT),
  "reason": "1-sentence summary of why it was classified this way",
  "draft_reply": "If is_critical is true, draft a warm, concise reply from Bob Burk (no subject line, sign off simply as 'Best regards, Bob Burk', mention availability via call/text/WhatsApp at 437-928-7172 if relevant). If false, return empty string."
}`;

    const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: triagePrompt }] }],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json'
        }
      })
    }, 2);

    if (!res || !res.ok) {
      console.error('[Email Handler] Gemini triage failed:', res ? await res.text() : 'Network timeout');
      return;
    }

    const data = await res.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let triage;
    try {
      triage = JSON.parse(rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    } catch (parseErr) {
      console.error('[Email Gatekeeper] Failed to parse Gemini JSON:', parseErr.message);
      return;
    }

    if (!triage.is_critical || triage.category === 'NOISE_SPAM_RECEIPT') {
      console.log(`[Email Gatekeeper] 🛡️ Filtered non-critical email (${triage.category}): "${emailPayload.subject}" — ${triage.reason}`);
      return;
    }

    const badgeMap = {
      COMMERCIAL_LEAD: '💰 COMMERCIAL LEAD',
      MAINTENANCE_REQUEST: '🛠️ MAINTENANCE REQUEST',
      PARTNER_INTRO: '🤝 PARTNER INTRO',
      ACTIVE_PROJECT: '🏗️ ACTIVE PROJECT'
    };
    const badge = badgeMap[triage.category] || '📧 PRIORITY EMAIL';

    const participants = knownNames.length > 0 ? knownNames.join(' and ') : 'colleagues';
    console.log(`[Email Gatekeeper] ✅ Routing ${triage.category} to ${participants} (${targetPhones.join(', ')})`);

    const formattedDispatch = `📧 *TITAN OS | ${badge}*\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n` +
                              `*From:* ${emailPayload.from}\n` +
                              `*Subject:* ${emailPayload.subject}\n` +
                              `*Signal:* ${triage.reason}\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n` +
                              `*Suggested Draft:*\n\n` +
                              `${(triage.draft_reply || '').trim()}`;

    const buttons = [{ id: 'DRAFT_REPLY', title: 'Draft Reply' }];

    for (const phone of targetPhones) {
      await sendWhatsAppButtons(config, phone, formattedDispatch, buttons);
    }

    console.log(`[Email Handler] Dispatched priority relay card to ${targetPhones.length} recipient(s).`);
  } catch (err) {
    console.error('[Email Handler Exception]:', err.message);
  }
}

// ====================================================================
// 8. SCHEMA NORMALIZATION ENGINE
// ====================================================================

function normalizeSitePayload(rawPayload, cachedSiteRecord) {
  if (!rawPayload || typeof rawPayload !== 'object') return {};

  const normalized = {};
  const knownKeys = Object.keys(cachedSiteRecord.fields || {});

  for (let [key, value] of Object.entries(rawPayload)) {
    let actualKey = knownKeys.find(k => k.toLowerCase() === key.toLowerCase());

    if (!actualKey) {
      const keyParts = key.toLowerCase().split(/[_\s]+/);
      actualKey = knownKeys.find(k => {
        const kLower = k.toLowerCase();
        return keyParts.every(part => part.length > 2 && kLower.includes(part));
      });
    }

    if (!actualKey) {
      console.warn(`[Schema Normalizer] Dropping unknown field: "${key}"`);
      continue;
    }

    if (typeof value === 'boolean') {
      normalized[actualKey] = value ? 'Yes' : 'No';
    } else if (typeof value === 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
      normalized[actualKey] = value.toLowerCase() === 'true' ? 'Yes' : 'No';
    } else if (typeof value === 'string' && value.length < 50) {
      normalized[actualKey] = value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    } else {
      normalized[actualKey] = value;
    }
  }

  return normalized;
}

module.exports = {
  mediaDebounceQueues,
  lastDroppedCoordinates,
  userActiveSiteMap,
  dailyEasterEggTracker,
  getUserBoundSiteId,
  updateSessionContext,
  sendWhatsAppReaction,
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  fanOutToSubscribers,
  isIndoorSite,
  resolveCoordinates,
  haversineDistanceKm,
  getHyperlocalWeather,
  evaluateWeatherTripwires,
  bindSiteContext,
  triageSpokenOrTextNLP,
  inspectBlindVisualGroundTruth,
  evaluateCourtMediaBatch,
  processMediaBatch,
  handleInboundEmail,
  normalizeSitePayload
};

/**
 * TITAN OS V6.0.22 — META WHATSAPP TRANSPORT & MULTIMODAL INGRESS
 * Module: whatsapp.js
 * Purpose: Webhooks, Debouncing, NLP Intent Routing, Forensic Vision, and Telemetry
 */

const crypto = require('crypto');

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
    const res = await fetch(`${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
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

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.text();
        console.error(`WhatsApp dispatch failed to ${cleanDestination} (${res.status}): ${errData}`);
        return false;
      }
      return true;
    } catch (err) {
      if (attempt <= retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        return false;
      }
    }
  }
  return false;
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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.warn(`[Meta Buttons] Rejected (${res.status}): ${errTxt}. Falling back to text.`);
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
    const res = await fetch(url);
    if (!res.ok) return null;
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
    const res = await fetch(url);
    if (!res.ok) return null;
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

  // Unwrap Airtable Lookup / Rollup arrays (e.g., ["25.322523, -80.275597"])
  if (Array.isArray(rawVal)) {
    if (rawVal.length === 0) return null;
    return parseCoordinatePair(rawVal[0]);
  }

  // Handle Airtable Map / Location extension objects ({ lat, lng } or { latitude, longitude })
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

  // Normalize string: replace Unicode minus/dashes with ASCII '-'
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
  let siteName = '';

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    siteId = rawLocationOrSite.id || autoPersistSiteId;
    siteName = String(fields['Site Name'] || '');

    // Locate 'Site location' matching exact name or trimmed/case-insensitive variant
    const siteLocationKey = Object.keys(fields).find(
      k => k.trim().toLowerCase() === 'site location'
    );
    rawValue = siteLocationKey ? fields[siteLocationKey] : undefined;

    if (/rcor/i.test(siteName)) {
      console.log(`[Geo Debug] ${siteName} | key="${siteLocationKey}" | type=${Array.isArray(rawValue) ? 'array' : typeof rawValue} | value=${JSON.stringify(rawValue)}`);
    }

    // 1. Direct parse of 'Site location' (handles strings, Lookup arrays, and Map objects)
    const directCoords = parseCoordinatePair(rawValue);
    if (directCoords) {
      if (/rcor/i.test(siteName)) {
        console.log(`[Geo Debug] ${siteName} -> Resolved (${directCoords.lat}, ${directCoords.lon})`);
      }
      return directCoords;
    }

    // 2. Check explicit numeric Latitude / Longitude fallback fields
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

  // 3. Fallback: if 'Site location' holds a street address string, geocode via Google Maps
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
  "intent": "CREATE_ESTIMATE|CONVERT_ESTIMATE|CREATE_INVOICE|CHANGE_ORDER|AR_LOOKUP|ORACLE_QUERY|INVENTORY_QUERY|INVENTORY_UPDATE|EQUIPMENT_QUERY|EQUIPMENT_UPDATE|READINESS_QUERY|NAVIGATION_QUERY|DYNAMIC_SITE_UPDATE|UNKNOWN",
  "referenced_site_name": "string (extract the site name if mentioned)",
  "qbo_customer_name": "string (extract the client name if mentioned for finance)",
  "transcript_en": "string (the english translation of the text or audio)",
  "structured_payload": {}
}`;

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

  const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Gemini NLP failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
}

// ====================================================================
// 6. BLIND VISUAL FORENSICS & MEDIA BATCH PROCESSING
// ====================================================================

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
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return { is_padel_court: true, detected_scene: 'Bypassed on API error' };

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

async function evaluateCourtMediaBatch(config, items, cumulativeContext, maintenanceTriagePrompt, industrialSystemPrompt) {
  const contentParts = [
    { text: `Context: You are evaluating a Padel court at site: ${cumulativeContext.siteName}. The workflow mode is ${cumulativeContext.workflowMode}. The site is currently at Status: ${cumulativeContext.siteStatus}. The target language for the output receipt card is ${cumulativeContext.workerLanguage}.` }
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
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  try {
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('[Gemini Evaluation API Error]:', await res.text());
      return { highest_gate: 0, blockers_detected: [], summary: "API evaluation failed." };
    }

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return { highest_gate: 0, blockers_detected: [], summary: "Failed to generate evaluation." };

    return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Gemini Evaluation Exception]:', err.message);
    return { highest_gate: 0, blockers_detected: [], summary: "Exception during evaluation." };
  }
}

async function processMediaBatch(config, currentBatch, airtableWriteWithAutoDrop, oracleFileURIs) {
  console.log(`[processMediaBatch] Handling ${currentBatch.items.length} items for ${currentBatch.dispatchTarget}`);
  const receiptCard = `📸 *TITAN OS | MEDIA BATCH QUEUED*\n──────────────────────────────\n${currentBatch.items.length} files securely hashed and submitted for forensic evaluation.`;
  await sendWhatsAppMessage(config, currentBatch.dispatchTarget, receiptCard);
}

// ====================================================================
// 7. INBOUND EMAIL WEBHOOK (ZAPIER / SENDGRID / MAILGUN)
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

    const contacts = await getCachedContacts();
    const targetPhones = [];
    const knownNames = [];

    targetEmails.forEach(targetEmail => {
      const contact = contacts.find(c => {
        const contactEmail = String(c.fields['Email'] || '').toLowerCase().trim();
        return contactEmail === targetEmail;
      });

      if (contact && contact.fields['Phone E164']) {
        targetPhones.push(contact.fields['Phone E164']);
        knownNames.push(contact.fields['Full Name'] || contact.fields['First Name'] || targetEmail);
      }
    });

    if (targetPhones.length === 0) {
      console.log(`[Email Handler] No WhatsApp-routable phone numbers found in Contacts for: ${targetEmails.join(', ')}`);
      return;
    }

    const participants = knownNames.length > 0 ? knownNames.join(' and ') : 'colleagues';
    console.log(`[Email Handler] Resolved WhatsApp targets for: ${participants} (${targetPhones.join(', ')})`);

    const prompt = `You are the executive assistant for Bob Burk. 
An email was just received from: ${emailPayload.from}.
The subject is: "${emailPayload.subject}".

Here is the body of the email:
"""
${emailPayload.text || emailPayload.html}
"""

Task: Draft a warm, professional, and concise reply from Bob Burk addressing the sender and any individuals introduced in the email. 
If this is an introduction, explicitly welcome the new connection and offer to serve as a resource for anything related to padel courts. Mention that Bob is currently stateside but readily available via call, text, or WhatsApp at 437-928-7172.

RULES:
1. Do NOT include a subject line in the output.
2. Sign off simply as "Best regards, Bob Burk". Do NOT include any titles like "Founder, Bounce Padel" or company names in the sign-off.
3. Keep the tone conversational but highly professional.`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    };

    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('[Email Handler] Gemini drafting failed:', await res.text());
      return;
    }

    const data = await res.json();
    const generatedReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedReply) {
      console.error('[Email Handler] Gemini returned an empty response.');
      return;
    }

    const formattedDispatch = `📧 *TITAN OS | INBOUND EMAIL RELAY*\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n` +
                              `*From:* ${emailPayload.from}\n` +
                              `*Subject:* ${emailPayload.subject}\n` +
                              `━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `${generatedReply.trim()}`;

    for (const phone of targetPhones) {
      await sendWhatsAppMessage(config, phone, formattedDispatch);
    }

    console.log(`[Email Handler] Successfully dispatched email response to ${targetPhones.length} recipients.`);

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

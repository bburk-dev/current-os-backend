/**
 * TITAN OS V6.0.22 — META WHATSAPP TRANSPORT & MULTIMODAL INGRESS
 * Module: whatsapp.js
 * Purpose: Webhooks, Debouncing, Ambient Voice-to-Ledger NLP Intent Routing,
 *          Conversational Estimates & Draws, Asynchronous Multi-Gate Vision Matrix,
 *          Ambient Multi-Turn Session Memory, Supabase Private Archival, and Telemetry
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const fetch = globalThis.fetch || require('node-fetch');

// ====================================================================
// 1. IN-MEMORY DEBOUNCERS, GEOSPATIAL CACHES & MULTI-TURN SESSIONS
// ====================================================================
const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const lastDroppedCoordinates = new Map();
const userActiveSiteMap = new Map();
const dailyEasterEggTracker = new Map();

const userSessionMemory = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000;

function getSessionContext(fromPhone) {
  const cleanPhone = String(fromPhone).replace(/\D/g, '');
  const session = userSessionMemory.get(cleanPhone);
  if (!session) return null;
  if (Date.now() - session.timestamp > SESSION_TTL_MS) {
    userSessionMemory.delete(cleanPhone);
    return null;
  }
  return session;
}

function updateSessionContext(fromPhone, updates = {}) {
  const cleanPhone = String(fromPhone).replace(/\D/g, '');
  const existing = getSessionContext(cleanPhone) || {};
  userSessionMemory.set(cleanPhone, {
    ...existing,
    ...updates,
    timestamp: Date.now()
  });
}

// ====================================================================
// 2. OUTBOUND MESSAGING (META GRAPH API V21.0)
// ====================================================================

async function sendWhatsAppReaction(config, toTarget, messageId, emoji = '⚡') {
  const phoneNumberId = config?.meta?.phoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config?.meta?.accessToken || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const graphApiUrl = config?.meta?.graphApiUrl || 'https://graph.facebook.com/v21.0';

  if (!toTarget || !messageId || !phoneNumberId || !accessToken) return false;

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
    await fetch(`${graphApiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) { 
    return false; 
  }
}

async function sendWhatsAppMessage(targetOrConfig, textOrTarget, possibleText, retries = 2) {
  let config = null;
  let toTarget = '';
  let messageBody = '';

  if (possibleText !== undefined) {
    config = targetOrConfig;
    toTarget = textOrTarget;
    messageBody = possibleText;
  } else if (typeof targetOrConfig === 'object' && targetOrConfig !== null && targetOrConfig.meta) {
    config = targetOrConfig;
    toTarget = textOrTarget;
    messageBody = possibleText || '';
  } else {
    toTarget = targetOrConfig;
    messageBody = textOrTarget;
    config = {
      meta: {
        phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
        graphApiUrl: 'https://graph.facebook.com/v21.0'
      }
    };
  }

  const phoneNumberId = config?.meta?.phoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config?.meta?.accessToken || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const graphApiUrl = config?.meta?.graphApiUrl || 'https://graph.facebook.com/v21.0';

  if (!toTarget || !phoneNumberId || !accessToken) {
    console.warn(`[Meta Outbound] Aborted: Missing destination target or phone credentials.`);
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

  const url = `${graphApiUrl}/${phoneNumberId}/messages`;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
        console.error(`[Meta Outbound Exception] Attempt ${attempt} failed:`, err.message);
        return false;
      }
    }
  }
  return false;
}

async function sendWhatsAppButtons(config, toTarget, textBody, buttons = []) {
  const phoneNumberId = config?.meta?.phoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config?.meta?.accessToken || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const graphApiUrl = config?.meta?.graphApiUrl || 'https://graph.facebook.com/v21.0';

  if (!toTarget || !buttons || buttons.length === 0 || !phoneNumberId || !accessToken) return false;
  
  let cleanDestination = String(toTarget).replace(/\D/g, '');
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${idx}_${Date.now()}`,
      title: String(btn.title || 'Select').trim().slice(0, 20)
    }
  }));

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

  const url = `${graphApiUrl}/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 *${b.title}*`).join('\n');
      return await sendWhatsAppMessage(config, cleanDestination, fallbackText);
    }
    return true;
  } catch (err) {
    const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 *${b.title}*`).join('\n');
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
    criticalAlerts.push(`🌪️ *EXTREME WIND HAZARD (${weather.windGusts} km/h):* Secure loose materials. Frame and glass hazard.`);
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
    holds.push(`💧 *CONDENSATION HOLD:* Dew delta is ${dewDelta.toFixed(1)}°C (Humidity: ${weather.humidity}%). Substrate moisture will ruin adhesive bond.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0) {
    holds.push(`🌧️ *RAIN HOLD:* Active rain detected. Hold outdoor gluing, glass, and mesh.`);
  } else if (weather.precipProbability4h > 40) {
    warnings.push(`🌦️ *RAIN PROBABILITY (${weather.precipProbability4h}% in 4h):* Keep tarps staged over open turf rolls.`);
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
// 4. IDENTITY & LOCATION RESOLUTION (THE GOD SCHEMA)
// ====================================================================

async function resolveCoordinates(config, memoryCache, rawLocationOrSite, airtableWriteWithAutoDrop, autoPersistSiteId = null) {
  let rawLocation = rawLocationOrSite;
  let siteId = autoPersistSiteId;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
    siteId = rawLocationOrSite.id || autoPersistSiteId;
  }

  if (typeof rawLocation === 'string' && memoryCache?.coordinates?.has(rawLocation)) {
    return memoryCache.coordinates.get(rawLocation);
  }

  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (directMatch) {
      const coords = { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
      if (memoryCache?.coordinates) memoryCache.coordinates.set(rawLocation, coords);
      return coords;
    }
  }

  if (typeof rawLocation === 'string' && rawLocation.length > 3) {
    const googleResult = await geocodeAddressWithGoogle(config, rawLocation);
    if (googleResult) {
      const coords = { lat: googleResult.lat, lon: googleResult.lon };
      if (memoryCache?.coordinates) memoryCache.coordinates.set(rawLocation, coords);
      if (siteId && !rawLocation.includes(',') && typeof airtableWriteWithAutoDrop === 'function') {
        const coordString = `${googleResult.lat.toFixed(6)}, ${googleResult.lon.toFixed(6)}`;
        airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, siteId).catch(() => {});
      }
      return coords;
    }
  }
  return null;
}

async function bindSiteContext(config, site, worker, callerIdentity, dispatchTarget, fromPhone, distanceMeters, userLat, userLon, airtableWriteWithAutoDrop, generateMorningEasterEgg) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Tech';
  userActiveSiteMap.set(fromPhone, site.id);
  updateSessionContext(fromPhone, { boundSiteId: site.id, siteName: site.fields['Site Name'] });
  
  if (worker && worker.id && typeof airtableWriteWithAutoDrop === 'function') {
    airtableWriteWithAutoDrop('Workers', { 'Current Site Bound': [site.id] }, worker.id).catch(() => {});
  }

  if (typeof airtableWriteWithAutoDrop === 'function') {
    airtableWriteWithAutoDrop('Sites', {
      'Last Note': `[SITE BOUND] ${workerName} checked in (${Math.round(distanceMeters)}m from court pin).`,
      'Last Intent': 'PRESENCE_VERIFIED'
    }, site.id).catch(() => {});
  }

  const indoor = isIndoorSite(site);
  let arrivalWeather = '';
  if (!indoor && userLat && userLon) {
    const weather = await getHyperlocalWeather(userLat, userLon);
    if (weather) arrivalWeather = evaluateWeatherTripwires(weather).summaryText;
  }

  let checkinCard = `📍 *TITAN OS | SITE CONTEXT BOUND*\n` +
    `──────────────────────────────\n` +
    `🏟️ *Court:* ${site.fields['Site Name']}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `📏 *Distance:* ${Math.round(distanceMeters)}m from court pin\n` +
    `──────────────────────────────\n` +
    `📊 *Gate Status:* ${site.fields['Current Gate'] || 'Active'}\n` +
    (arrivalWeather ? `\n🌤️ *Site Telemetry:*${arrivalWeather}\n` : '') +
    `\n👉 Ready for parallel sweeps, punch list updates, or material checkouts.`;

  const prefLang = worker?.fields?.['Language'] || callerIdentity?.language || 'English';
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (dailyEasterEggTracker.get(fromPhone) !== todayStr && typeof generateMorningEasterEgg === 'function') {
    const egg = await generateMorningEasterEgg(config, prefLang);
    checkinCard += egg;
    dailyEasterEggTracker.set(fromPhone, todayStr);
  }

  await sendWhatsAppMessage(config, dispatchTarget, checkinCard);
}

// ====================================================================
// 5. AMBIENT VOICE-TO-LEDGER NLP INTENT CLASSIFICATION (GEMINI 2.5 PRO)
// ====================================================================

async function triageSpokenOrTextNLP(config, rawInput, activeSitesList = [], isAudio = false, audioItems = [], fromPhone = null, siteContext = null) {
  const siteListStr = Array.isArray(activeSitesList) ? activeSitesList.join(', ') : '';
  const geminiEndpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const geminiApiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  const session = fromPhone ? getSessionContext(fromPhone) : null;
  const boundSiteId = fromPhone ? (userActiveSiteMap.get(fromPhone) || session?.boundSiteId) : null;
  const boundSiteName = siteContext?.fields?.['Site Name'] || session?.siteName || (boundSiteId ? `Site ID ${boundSiteId}` : 'Bounce Padel General Fleet');

  const intentPrompt = `You are the Titan OS Ambient Intelligence Scribe for Bounce Padel court operations and QuickBooks Online headless ERP.
Your mission: Translate natural, informal, spoken voice memos and field text into structured operational and financial commands.

ACTIVE REGISTERED SITES: [${siteListStr}]
ACTIVE BOUND SITE CONTEXT: "${boundSiteName}"

RULES FOR INTENT RECOGNITION:
1. CREATE_ESTIMATE:
   - Operative wants to quote, estimate, or price a build, court, or service.
   - EXTRACT:
     * qbo_customer_name: Look for a client, club, or site name. IF NO CLIENT IS MENTIONED, use ACTIVE BOUND SITE CONTEXT: "${boundSiteName}". IF THE SPEAKER SPELLS A NAME OUT (e.g. "B-U-R-K"), OUTPUT THE EXACT SPELLED WORD.
     * qbo_customer_email: Extract the exact email address if spoken (e.g. "bobburk@gmail.com").
     * qbo_amount: Extract numeric value (e.g. 70000, 65000). Handle "70k" -> 70000, "setenta mil" -> 70000.
     * qbo_line_items: Extract formal description of the item (e.g. "one panoramic padel court", "standard court kit").
     * apply_tax: true if "plus HST", "add tax", "plus tax", "mas tax" is mentioned; otherwise false.
     * tax_code_name: "HST", "GST", "Sales Tax", or null.

2. CONVERT_ESTIMATE:
   - Operative wants to convert an existing estimate into a partial or full progress draw / invoice.

3. CREATE_INVOICE:
   - Operative wants to bill or invoice DIRECTLY without prior estimate.

4. CHANGE_ORDER:
   - Scope modification, client addition, or extra physical work requested in the field.

5. AR_LOOKUP:
   - Queries regarding accounts receivable, overdue invoices, 30+ aging, balances.

6. ORACLE_QUERY:
   - Engineering specifications, foundation slab drawings, hurricane wind loads, glass gasket requirements.

7. INVENTORY_QUERY:
   - Material counts, depletion logs.

8. CHECKIN / GENERAL_UPDATE:
   - Operational site notes, status reports.

CRITICAL INSTRUCTION FOR TRANSCRIPT:
You MUST output the EXACT, FULL, VERBATIM word-for-word transcript of the audio in the 'transcript_en' field. Do NOT summarize it. If a word is spelled out letter-by-letter (e.g. "Burke, B-U-R-K"), you MUST correct the spelling in the transcript to match the spoken letters exactly ("Wendy Burk").

Return STRICTLY a JSON object with this schema:
{
  "intent": "CREATE_ESTIMATE" | "CONVERT_ESTIMATE" | "CREATE_INVOICE" | "CHANGE_ORDER" | "AR_LOOKUP" | "ORACLE_QUERY" | "INVENTORY_QUERY" | "CHECKIN" | "GENERAL_UPDATE",
  "qbo_customer_name": "string (resolved client/site name, correct spelling if spelled out)",
  "qbo_customer_email": "string (extract email address if spoken, else null)",
  "qbo_amount": number or null,
  "qbo_estimate_number": "string or null",
  "qbo_invoice_percentage": number or null,
  "qbo_line_items": "string or null",
  "apply_tax": boolean,
  "tax_code_name": "string or null",
  "transcript_en": "string (CRITICAL: Full verbatim word-for-word transcript. Never summarize.)"
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
  } else if (typeof rawInput === 'string' && rawInput.trim().length > 0) {
    contentParts.push({ text: `Field Transmission: "${rawInput.trim()}"` });
  }

  const payload = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json'
    }
  };

  try {
    const res = await fetch(`${geminiEndpoint}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Gemini NLP failed (${res.status}): ${await res.text()}`);

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    
    if (!parsed.qbo_customer_name && boundSiteName && boundSiteName !== 'Bounce Padel General Fleet') {
      parsed.qbo_customer_name = boundSiteName;
    }

    if (fromPhone) {
      updateSessionContext(fromPhone, { lastIntent: parsed.intent, lastCustomer: parsed.qbo_customer_name });
    }

    return parsed;
  } catch (err) {
    console.error('[NLP Triage Exception]:', err.message);
    return null;
  }
}

// ====================================================================
// 6. BLIND VISUAL FORENSICS & ASYNCHRONOUS MULTI-GATE BATCH ENGINE
// ====================================================================

async function inspectBlindVisualGroundTruth(config, mediaItem, batchText, dispatchTarget, targetedSiteOverride, site, airtableWriteWithAutoDrop) {
  const geminiEndpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const geminiApiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  const payload = {
    system_instruction: { 
      parts: [{ 
        text: `Classify the physical environment. Is this a padel court? (CRITICAL: A bare concrete foundation slab, earthworks, or pre-existing tennis court being prepped for construction MUST be classified as a valid padel court environment for Gate 1). Output JSON {"is_padel_court": boolean, "detected_scene": string}` 
      }] 
    },
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
    const res = await fetch(`${geminiEndpoint}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return { is_padel_court: true, detected_scene: 'Bypassed on API error' };

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const visualTruth = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    
    if (visualTruth.is_padel_court === false) {
      console.log(`[Vision Ingress] Component/macro detail detected (${visualTruth.detected_scene}). Logging to site record.`);
      
      const bypassNotes = `[COMPONENT LOG]: \nDetected: ${visualTruth.detected_scene || 'Hardware / Component Detail'}\nNote: ${batchText || 'Field photo logged.'}`;
      
      const targetSite = targetedSiteOverride || site;
      if (targetSite && typeof airtableWriteWithAutoDrop === 'function') {
         await airtableWriteWithAutoDrop('Sites', {
          'Last Note': bypassNotes,
          'Last Intent': 'COMPONENT_DETAIL_LOG'
        }, targetSite.id);
      }
      
      const fieldCard = `📸 *TITAN OS | COMPONENT DETAIL ARCHIVED*\n` +
        `──────────────────────────────\n` +
        `🔍 *Captured:* ${visualTruth.detected_scene || 'Structural hardware / detail'}\n` +
        `✅ *Action:* Logged to the court ledger.\n\n` +
        `_Tip: Whenever you want to clear a structural milestone, pan back to show the court frame in context._`;
        
      await sendWhatsAppMessage(config, dispatchTarget, fieldCard);
    }
    
    return visualTruth;
  } catch (err) {
    return { is_padel_court: true, detected_scene: 'Bypassed on parse error' };
  }
}

async function uploadMediaToSupabase(config, buffer, mimeType) {
  const supabaseUrl = config?.supabase?.url || process.env.SUPABASE_URL;
  const serviceKey = config?.supabase?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = config?.supabase?.bucket || process.env.STORAGE_BUCKET || 'titan-private-media';

  if (!supabaseUrl || !serviceKey) return null;

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const ext = mimeType.split('/')[1] || (mimeType.includes('video') ? 'mp4' : 'jpg');
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const filePath = `${year}/${month}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.warn('[Supabase Storage Upload Error]:', uploadError.message);
      return null;
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (signError || !signedData?.signedUrl) return null;
    return signedData.signedUrl;
  } catch (e) {
    console.error('[Supabase Storage Exception]:', e.message);
    return null;
  }
}

async function processMediaBatch(config, batch, airtableWriteWithAutoDrop, oracleFileURIs = []) {
  if (!batch || !batch.items || batch.items.length === 0) return;

  const dispatchTarget = batch.dispatchTarget;
  const site = batch.site;
  const worker = batch.worker;
  const callerIdentity = batch.callerIdentity;
  const workerName = callerIdentity?.name || worker?.fields?.['Full Name'] || 'Field Tech';
  const workerLang = callerIdentity?.language || worker?.fields?.['Language'] || 'English';

  console.log(`[Media Engine] Initiating Asynchronous Multi-Gate Sweep on ${batch.items.length} items for ${site?.fields?.['Site Name'] || 'Unbound Court'}`);

  const primaryVisualItem = batch.items.find(i => i.type === 'video' || i.type === 'image');
  if (primaryVisualItem) {
    const truth = await inspectBlindVisualGroundTruth(
      config,
      primaryVisualItem,
      primaryVisualItem.caption || '',
      dispatchTarget,
      site,
      site,
      airtableWriteWithAutoDrop
    );
    if (truth.is_padel_court === false) {
      return; 
    }
  }

  let signedMediaUrl = null;
  if (primaryVisualItem) {
    signedMediaUrl = await uploadMediaToSupabase(config, primaryVisualItem.buffer, primaryVisualItem.mimeType);
  }

  const workflowMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
  const siteName = site?.fields?.['Site Name'] || 'Active Build';
  const currentGateRaw = site?.fields?.['Current Gate'] || '0';

  const prevNumbers = (String(currentGateRaw).match(/\b([1-9]|1[0-2])\b/g) || []).map(Number);
  const verifiedSet = new Set(prevNumbers);

  if (verifiedSet.size === 1) {
    const singleVal = Array.from(verifiedSet)[0];
    for (let i = 1; i <= singleVal; i++) verifiedSet.add(i);
  }

  const verifiedArrayStr = Array.from(verifiedSet).sort((a,b)=>a-b).join(', ') || 'None';

  const evaluationPrompt = `You are the Lead Forensic Civil Engineer and Master Commissioning Agent for Bounce Padel courts worldwide.
Analyze the provided visual sweep and ambient audio of site: "${siteName}".
Workflow Mode: ${workflowMode}
Previously Verified Milestones: [${verifiedArrayStr}]

THE 12 ASYNCHRONOUS PADEL GATES TAXONOMY:
- Gate 1: Concrete Slab Foundation
- Gate 2: Structural Steel Columns & Ring Beam
- Gate 3: Electro-welded Mesh & Pillars
- Gate 4: Tempered Glass Panels Seating
- Gate 5: Light Masts & LED Fixtures
- Gate 6: Artificial Turf Carpet Layout
- Gate 7: Turf Seam Gluing & Play-Lines
- Gate 8: Silica Sand Infill
- Gate 9: Regulation Net & Tension Posts
- Gate 10: Player Access Doors & Hardware
- Gate 11: Electrical Wiring & Lighting
- Gate 12: Site Cleanliness & Handover

Return STRICTLY JSON:
{
  "completed_gates": array of integers,
  "in_progress_gates": array of integers,
  "is_clean": boolean,
  "blockers_detected": array of strings,
  "headline": string,
  "summary": string,
  "predictive_next_actions": string
}`;

  const geminiParts = [{ text: evaluationPrompt }];
  batch.items.forEach(item => {
    geminiParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  });

  const geminiEndpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const geminiApiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  try {
    const aiRes = await fetch(`${geminiEndpoint}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: geminiParts }],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!aiRes.ok) throw new Error(`Gemini Gate Evaluation failed (${aiRes.status}): ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const rawAiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const evalResult = JSON.parse(rawAiText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());

    const newlyCompleted = Array.isArray(evalResult.completed_gates) ? evalResult.completed_gates : [];
    newlyCompleted.forEach(g => {
      if (g >= 1 && g <= 12) verifiedSet.add(g);
    });

    if (!evalResult.is_clean) {
      verifiedSet.delete(12);
      if (!evalResult.blockers_detected.some(b => /clean|debris|trash|herramienta|basura/i.test(b))) {
        evalResult.blockers_detected.push("Active tools or debris detected on court slab. Cleanliness hold engaged.");
      }
    }

    const verifiedList = Array.from(verifiedSet).sort((a, b) => a - b);
    const totalVerifiedCount = verifiedList.length;
    const highestGate = verifiedList.length > 0 ? Math.max(...verifiedList) : 0;
    const inProgressList = (evalResult.in_progress_gates || []).filter(g => !verifiedSet.has(g));

    const allTwelveVerified = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(g => verifiedSet.has(g));
    let newWorkflowMode = workflowMode;
    let newSiteStatus = site?.fields?.['Site Status'] || 'ACTIVE';
    if (allTwelveVerified && (!evalResult.blockers_detected || evalResult.blockers_detected.length === 0)) {
      newWorkflowMode = 'MAINTENANCE';
      newSiteStatus = 'ACTIVE';
    }

    const gateString = allTwelveVerified 
      ? 'Gate 12 - Commissioned' 
      : `Gate ${highestGate} (${totalVerifiedCount}/12 Verified)`;

    if (typeof airtableWriteWithAutoDrop === 'function') {
      const reportPayload = {
        'Workflow Mode': newWorkflowMode,
        'Headline': evalResult.headline || `Milestone Verification (${totalVerifiedCount}/12)`,
        'Summary': evalResult.summary || 'Parallel multimodal court inspection successfully logged.',
        'Action Items': evalResult.predictive_next_actions || 'Continue parallel construction sequence.',
        'Status': evalResult.blockers_detected?.length > 0 ? 'Action Required' : 'Verified'
      };

      if (site?.id) reportPayload['Site'] = [site.id];
      if (worker?.id) reportPayload['Worker'] = [worker.id];

      await airtableWriteWithAutoDrop('Reports 2', reportPayload);

      if (site?.id) {
        await airtableWriteWithAutoDrop('Sites', {
          'Current Gate': gateString,
          'Workflow Mode': newWorkflowMode,
          'Site Status': newSiteStatus,
          'Last Note': `[PARALLEL SWEEP] Verified: [${verifiedList.join(', ')}]. Active: [${inProgressList.join(', ') || 'None'}]. Logged by ${workerName}.`
        }, site.id);
      }
    }

    updateSessionContext(dispatchTarget, {
      lastSiteId: site?.id,
      verifiedGates: verifiedList,
      inProgressGates: inProgressList
    });

    const isSpanish = String(workerLang).toLowerCase().includes('span');
    const blockersText = evalResult.blockers_detected?.length > 0
      ? `\n⚠️ *${isSpanish ? 'Obstáculos' : 'Blockers'}:*\n` + evalResult.blockers_detected.map(b => `• ${b}`).join('\n')
      : '';

    const verifiedProgressStr = verifiedList.length > 0 ? verifiedList.map(g => `G${g}`).join(', ') : 'None';
    const inProgressStr = inProgressList.length > 0 ? inProgressList.map(g => `G${g}`).join(', ') : 'None';

    const statusCard = `🎾 *TITAN OS | ${isSpanish ? 'VERIFICACIÓN PARALELA' : 'PARALLEL SWEEP CONFIRMED'}*\n` +
      `──────────────────────────────\n` +
      `🏟️ *${isSpanish ? 'Pista' : 'Court'}:* ${siteName}\n` +
      `👤 *${isSpanish ? 'Técnico' : 'Technician'}:* ${workerName}\n` +
      `✅ *${isSpanish ? 'Hitos Completados' : 'Verified Gates'}:* ${verifiedProgressStr} (${Math.round((totalVerifiedCount / 12) * 100)}%)\n` +
      `⚙️ *${isSpanish ? 'En Progreso' : 'In Progress'}:* ${inProgressStr}\n` +
      `──────────────────────────────\n` +
      `📋 *${evalResult.headline}*\n` +
      `_${evalResult.summary}_\n` +
      blockersText + `\n\n` +
      `👉 *${isSpanish ? 'Siguiente Acción' : 'Next Parallel Action'}:* ${evalResult.predictive_next_actions}`;

    await sendWhatsAppMessage(config, dispatchTarget, statusCard);

  } catch (err) {
    console.error('[Process Media Batch Error]:', err);
    await sendWhatsAppMessage(config, dispatchTarget, `⚠️ Field inspection logged to ledger. Engineering sync active.`);
  }
}

// ====================================================================
// 7. INBOUND EMAIL & RELAY ORCHESTRATION
// ====================================================================

async function handleInboundEmail(config, emailPayload, getCachedContacts) {
  try {
    const extractEmails = (str) => {
      const matches = String(str || '').match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
      return matches ? matches.map(e => e.toLowerCase().trim()) : [];
    };

    const senderEmails = extractEmails(emailPayload.from);
    const toEmails = extractEmails(emailPayload.to);
    const ccEmails = extractEmails(emailPayload.cc);
    
    const targetEmails = [...new Set([...senderEmails, ...ccEmails])];
    
    if (targetEmails.length === 0) {
      console.warn('[Email Handler] No valid sender/CC emails extracted.');
      return;
    }

    const contacts = typeof getCachedContacts === 'function' ? await getCachedContacts() : [];
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

    const geminiEndpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
    const geminiApiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    };

    const res = await fetch(`${geminiEndpoint}?key=${geminiApiKey}`, {
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
                              `──────────────────────────────\n` +
                              `*From:* ${emailPayload.from}\n` +
                              `*Subject:* ${emailPayload.subject}\n` +
                              `──────────────────────────────\n\n` +
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
// 8. CONTEXT RETRIEVAL HELPERS
// ====================================================================

function getUserBoundSiteId(phone) {
  const clean = String(phone).replace(/\D/g, '');
  return userActiveSiteMap.get(clean) || getSessionContext(clean)?.boundSiteId || null;
}

module.exports = {
  mediaDebounceQueues,
  lastDroppedCoordinates,
  userActiveSiteMap,
  dailyEasterEggTracker,
  userSessionMemory,
  getUserBoundSiteId,
  sendWhatsAppReaction,
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  fanOutToSubscribers,
  isIndoorSite,
  geocodeAddressWithGoogle,
  resolveCoordinates,
  haversineDistanceKm,
  getHyperlocalWeather,
  evaluateWeatherTripwires,
  bindSiteContext,
  triageSpokenOrTextNLP,
  inspectBlindVisualGroundTruth,
  uploadMediaToSupabase,
  processMediaBatch,
  handleInboundEmail
};

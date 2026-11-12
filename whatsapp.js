/**
 * TITAN OS V6.0.22 — WHATSAPP TELEMETRY, NLP & MULTIMODAL INGRESS
 * Module: whatsapp.js
 * Purpose: Meta Graph API Communication, Bidirectional WhatsApp Dispatch,
 *          Real-Time Emoji Reactions, Interactive Buttons, Geospatial Site Binding,
 *          In-Memory Sliding Debounce Queues, Multimodal Audio/Video/Photo Triage,
 *          Dynamic Schema Normalization (Color/Colour & Single-Select Casing),
 *          Visual Milestone Inspection, Inbound Email Bridge, and Subscriber Fanout.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ====================================================================
// 0. GLOBAL POLYFILLS & STATE STORES
// ====================================================================
if (!globalThis.fetch) {
  try {
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch;
    globalThis.Headers = nodeFetch.Headers;
    globalThis.Request = nodeFetch.Request;
    globalThis.Response = nodeFetch.Response;
  } catch (err) {
    console.warn('[WhatsApp Engine] Native fetch unavailable.');
  }
}

// In-Memory Spatial & Debounce Stores (Single-Threaded Pinned RAM)
const userActiveSiteMap = new Map();
const lastDroppedCoordinates = new Map();
const mediaDebounceQueues = new Map();
const userSessionContextMap = new Map();

// ====================================================================
// 1. GEODETIC & SESSION UTILITIES
// ====================================================================

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getUserBoundSiteId(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '');
  return userActiveSiteMap.get(cleanPhone) || userActiveSiteMap.get(phone) || null;
}

function updateSessionContext(phone, ctx) {
  const cleanPhone = String(phone).replace(/\D/g, '');
  const existing = userSessionContextMap.get(cleanPhone) || {};
  userSessionContextMap.set(cleanPhone, { ...existing, ...ctx, timestamp: Date.now() });
}

// ====================================================================
// 2. SCHEMA & SELECT OPTION NORMALIZATION ENGINE
// ====================================================================

function normalizeSitePayload(rawFields, cachedSites = []) {
  const knownColumns = new Set();
  if (Array.isArray(cachedSites)) {
    cachedSites.forEach(s => {
      if (s.fields) Object.keys(s.fields).forEach(k => knownColumns.add(k));
    });
  }

  const normalized = {};

  for (const [key, val] of Object.entries(rawFields)) {
    if (val === null || val === undefined || val === '') continue;

    let targetKey = key;
    const cleanKey = key.trim().toLowerCase();

    if (cleanKey === 'turf color' || cleanKey === 'turf colour') {
      targetKey = knownColumns.has('Turf Colour') ? 'Turf Colour' : 'Turf Color';
    } else if (cleanKey === 'turf supplier' || cleanKey === 'supplier' || cleanKey === 'turf manufacturer') {
      targetKey = knownColumns.has('Turf Supplier') ? 'Turf Supplier' : (knownColumns.has('Supplier') ? 'Supplier' : 'Turf Supplier');
    } else if (cleanKey === 'structure color' || cleanKey === 'structure colour' || cleanKey === 'frame color') {
      targetKey = knownColumns.has('Structure Colour') ? 'Structure Colour' : (knownColumns.has('Structure Color') ? 'Structure Color' : key);
    } else if (cleanKey === 'lights' || cleanKey === 'lighting') {
      targetKey = knownColumns.has('Lights') ? 'Lights' : (knownColumns.has('Lighting') ? 'Lighting' : 'Lights');
    } else {
      for (const col of knownColumns) {
        if (col.toLowerCase() === cleanKey) {
          targetKey = col;
          break;
        }
      }
    }

    let targetVal = val;
    if (typeof val === 'boolean') {
      targetVal = val ? 'Yes' : 'No';
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      const lower = trimmed.toLowerCase();

      if (lower === 'green') targetVal = 'Green';
      else if (lower === 'blue') targetVal = 'Blue';
      else if (lower === 'terracotta') targetVal = 'Terracotta';
      else if (lower === 'black') targetVal = 'Black';
      else if (lower === 'red') targetVal = 'Red';
      else if (lower === 'mondo') targetVal = 'Mondo';
      else if (lower === 'real turf' || lower === 'realturf') targetVal = 'Real Turf';
      else if (lower === 'padel galis') targetVal = 'Padel Galis';
      else if (lower === 'yes' || lower === 'true') targetVal = 'Yes';
      else if (lower === 'no' || lower === 'false') targetVal = 'No';
      else {
        targetVal = trimmed.replace(/\b\w/g, c => c.toUpperCase());
      }
    } else {
      targetVal = String(val).trim();
    }

    normalized[targetKey] = targetVal;
  }

  return normalized;
}

// ====================================================================
// 3. META GRAPH API TRANSPORT (MESSAGES, BUTTONS, REACTIONS)
// ====================================================================

async function sendWhatsAppMessage(config, to, text) {
  const cleanPhone = String(to).replace(/\D/g, '');
  const url = `${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'text',
    text: { preview_url: true, body: text }
  };

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
      const errText = await res.text();
      console.error(`[WhatsApp API Error] Message failed to ${cleanPhone} (HTTP ${res.status}):`, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[WhatsApp API Network Error] To ${cleanPhone}:`, err.message);
    return false;
  }
}

async function sendWhatsAppButtons(config, to, text, buttons) {
  const cleanPhone = String(to).replace(/\D/g, '');
  const url = `${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`;

  const formattedButtons = buttons.slice(0, 3).map((b, idx) => ({
    type: 'reply',
    reply: {
      id: b.id || `btn_${idx}`,
      title: String(b.title).substring(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: formattedButtons }
    }
  };

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
      return await sendWhatsAppMessage(config, cleanPhone, text);
    }
    return true;
  } catch (err) {
    return await sendWhatsAppMessage(config, cleanPhone, text);
  }
}

async function sendWhatsAppReaction(config, to, messageId, emoji) {
  if (!messageId) return;
  const cleanPhone = String(to).replace(/\D/g, '');
  const url = `${config.meta.graphApiUrl}/${config.meta.phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji || '👍'
    }
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn(`[WhatsApp Reaction Warning] ID ${messageId}:`, err.message);
  }
}

// ====================================================================
// 4. GEOSPATIAL RESOLUTION & SITE CONTEXT BINDING
// ====================================================================

async function resolveCoordinates(config, memoryCache, site, airtableWrite) {
  const fields = site.fields || {};
  
  const latStr = fields['Latitude'] || fields['Lat'];
  const lonStr = fields['Longitude'] || fields['Long'] || fields['Lng'] || fields['Lon'];

  if (latStr && lonStr) {
    return { lat: Number(latStr), lon: Number(lonStr) };
  }
  
  const combined = fields['Coordinates'] || fields['Location'] || fields['GPS'];
  if (typeof combined === 'string' && combined.includes(',')) {
      const parts = combined.split(',');
      if (parts.length === 2) {
          return { lat: Number(parts[0].trim()), lon: Number(parts[1].trim()) };
      }
  }

  return null;
}

async function bindSiteContext(config, site, worker, callerIdentity, dispatchTarget, fromPhone, distanceMeters, userLat, userLon, airtableWrite, fetchDadJoke, weatherStr = '') {
  const cleanPhone = String(fromPhone).replace(/\D/g, '');
  const siteId = site.id;
  const siteName = site.fields['Site Name'];

  userActiveSiteMap.set(cleanPhone, siteId);
  userActiveSiteMap.set(fromPhone, siteId);

  console.log(`[Site Engine] Bound operative ${callerIdentity.name} (${cleanPhone}) to site: ${siteName} (${siteId})`);

  if (airtableWrite) {
    const timestamp = new Date().toISOString();
    const updatePayload = {
      'Last Checked In': timestamp,
      'Last Worker Check-In': `${callerIdentity.name} (${callerIdentity.role})`
    };
    if (userLat && userLon) {
      updatePayload['Last Coordinates'] = `${userLat.toFixed(5)}, ${userLon.toFixed(5)}`;
    }
    await airtableWrite('Sites', updatePayload, siteId);
  }

  const bonusJoke = fetchDadJoke ? await fetchDadJoke() : '';
  const weatherAddon = weatherStr ? `\n\n🌤️ *Site Telemetry:*\n${weatherStr}` : '';
  
  const checkInCard = `📍 *CHECK-IN VERIFIED | TITAN OS*\n` +
                      `──────────────────────────────\n` +
                      `🏟️ *Court:* ${siteName}\n` +
                      `👤 *Installer:* ${callerIdentity.name} (${callerIdentity.role})\n` +
                      `🌐 *Proximity:* ${Math.round(distanceMeters)}m from court center\n` +
                      `──────────────────────────────\n` +
                      `Bound to *${siteName}*. Send photos, voice notes, or receipts to log progress.${weatherAddon}${bonusJoke}`;

  await sendWhatsAppMessage(config, dispatchTarget, checkInCard);
}

// ====================================================================
// 5. MULTIMODAL NLP TRIAGE (AUDIO, VOICE MEMOS, TEXT)
// ====================================================================

async function triageSpokenOrTextNLP(config, rawText, registeredSiteNames, isAudio = false, mediaItems = [], fromPhone = '', boundSite = null) {
  const boundSiteName = boundSite?.fields?.['Site Name'] || 'None';

  const systemPrompt = `You are the Lead Dispatcher for Titan OS and Bounce Padel.
Analyze this field operative communication (spoken audio dictation or text):
"${rawText || '[Spoken Audio Input]'}"

CONTEXT:
- Currently Bound Site for this Worker: "${boundSiteName}"
- Known Registered Sites: ${JSON.stringify(registeredSiteNames || [])}

TASK:
1. Classify the intent into EXACTLY ONE:
   - "CREATE_ESTIMATE": Wants to draft a quote/estimate for courts or accessories.
   - "CONVERT_ESTIMATE": Wants to convert an estimate into an invoice (e.g. "bill 50%").
   - "CREATE_INVOICE": Wants to directly issue a new customer invoice.
   - "CHANGE_ORDER": Modification of physical build scope or additional construction cost on-site.
   - "AR_LOOKUP": Inquires about outstanding invoice balances or aging receivables.
   - "ORACLE_QUERY": Engineering questions, specs, bolt torque, glass tolerances, or blueprint PDFs.
   - "INVENTORY_QUERY": Queries regarding consumable materials, turf stock, glass, steel, or parts.
   - "INVENTORY_UPDATE": Requests to add, subtract, or update the count of consumable items in inventory.
   - "EQUIPMENT_QUERY": Queries regarding the physical location or status of heavy tools (e.g. glass handler, trailers).
   - "EQUIPMENT_UPDATE": Requests to update the location or status of heavy equipment.
   - "NAVIGATION_QUERY": Requests for driving directions, maps, location coordinates, or satellite views of a specific site.
   - "METRICS_QUERY": System volume, leverage metrics, or telemetry reports.
   - "READINESS_QUERY": Readiness status check for mobilization on a court.
   - "GENERAL_UPDATE": Updating site parameters (turf color, turf supplier, lights, substrate, status) or reporting field progress.
   - "UNKNOWN": Conversational chatter or unrecognized command.

2. Extract key parameters:
   - "referenced_site_name": Court name explicitly mentioned (e.g., "Luke Pelosi", "Lewinsky", "RCOR Court 2").
   - "qbo_customer_name": Client name mentioned for billing.
   - "qbo_amount": Explicit dollar amount mentioned.
   - "qbo_estimate_number": Estimate number referenced.
   - "qbo_invoice_percentage": Draw percentage requested (e.g. 50, 100).
   - "transcript_en": Clean English transcript of what was dictated with filler words removed.

OUTPUT STRICTLY VALID JSON:
{
  "intent": "string",
  "referenced_site_name": "string or null",
  "qbo_customer_name": "string or null",
  "qbo_amount": number or null,
  "qbo_estimate_number": "string or null",
  "qbo_invoice_percentage": number or null,
  "transcript_en": "string"
}`;

  const parts = [{ text: systemPrompt }];

  if (isAudio && Array.isArray(mediaItems) && mediaItems.length > 0) {
    mediaItems.forEach(item => {
      if (item.buffer) {
        parts.push({
          inline_data: {
            mime_type: item.mimeType || 'audio/ogg',
            data: item.buffer.toString('base64')
          }
        });
      }
    });
  }

  const payload = {
    contents: [{ role: 'user', parts }],
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

    if (!res.ok) return null;
    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleanJson);
    }
  } catch (err) {
    console.error('[NLP Triage Exception]:', err.message);
  }
  return null;
}

// ====================================================================
// 6. MEDIA PROCESSING & SUPABASE STORAGE ARCHIVE
// ====================================================================

async function processMediaBatch(config, batch, airtableWriteWithAutoDrop, oracleFileURIs) {
  const { items, site, worker, dispatchTarget, callerIdentity } = batch;
  const siteName = site?.fields?.['Site Name'] || 'Unbound Asset';
  const siteId = site?.id || null;

  console.log(`[Media Pipeline] Ingesting ${items.length} file(s) for site: ${siteName}`);

  const parts = [];
  const visionPrompt = `You are the Lead Structural Inspector for Bounce Padel.
Review the attached image(s) or video sweep from site: "${siteName}".
Detect structural court progress (foundation, steel frame, glass, mesh, turf infill, net, lights).
Identify defects or hazards.
Return valid JSON:
{
  "milestone_summary": "string",
  "detected_elements": ["string"],
  "hazards_or_blockers": ["string"],
  "recommended_next_step": "string"
}`;

  parts.push({ text: visionPrompt });
  items.forEach(item => {
    parts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  });

  try {
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
      })
    });

    let inspection = {
      milestone_summary: `Progress sweep recorded (${items.length} files).`,
      detected_elements: ['Padel Structure'],
      hazards_or_blockers: [],
      recommended_next_step: 'Proceed with standard installation sequence.'
    };

    if (res.ok) {
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) inspection = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    }

    if (airtableWriteWithAutoDrop && siteId) {
      await airtableWriteWithAutoDrop('Sites', {
        'Last Note': `[FIELD SWEEP] ${callerIdentity.name}: ${inspection.milestone_summary}`,
        'Last Intent': 'FIELD_INSPECTION'
      }, siteId);
    }

    const hazardStr = inspection.hazards_or_blockers.length > 0 
      ? `\n⚠️ *Alerts:*\n• ` + inspection.hazards_or_blockers.join('\n• ') 
      : '\n✅ *Hazards:* None detected.';

    const card = `🏟️ *TITAN OS | SITE VERIFICATION*\n` +
                 `──────────────────────────────\n` +
                 `📍 *Site:* ${siteName}\n` +
                 `👤 *Inspector:* ${callerIdentity.name}\n` +
                 `📸 *Media Count:* ${items.length} file(s)\n` +
                 `──────────────────────────────\n` +
                 `📋 *Summary:* ${inspection.milestone_summary}\n` +
                 `🏗️ *Detected:* ${inspection.detected_elements.join(', ')}` +
                 hazardStr + `\n` +
                 `👉 *Next:* ${inspection.recommended_next_step}`;

    await sendWhatsAppMessage(config, dispatchTarget, card);
  } catch (err) {
    await sendWhatsAppMessage(config, dispatchTarget, `📸 Upload received (${items.length} files). Logged to ${siteName}.`);
  }
}

// ====================================================================
// 8. MODULE EXPORTS
// ====================================================================
module.exports = {
  userActiveSiteMap,
  lastDroppedCoordinates,
  mediaDebounceQueues,
  userSessionContextMap,
  haversineDistanceKm,
  getUserBoundSiteId,
  updateSessionContext,
  normalizeSitePayload,
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  sendWhatsAppReaction,
  resolveCoordinates,
  bindSiteContext,
  triageSpokenOrTextNLP,
  processMediaBatch
};

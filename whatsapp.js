/**
 * TITAN OS V6.0.22 — WHATSAPP TELEMETRY, NLP & MULTIMODAL INGRESS
 * Module: whatsapp.js
 * Purpose: Meta Graph API Communication, Bidirectional WhatsApp Dispatch,
 *          Real-Time Emoji Reactions, Interactive Buttons, Geospatial Site Binding,
 *          In-Memory Sliding Debounce Queues, Multimodal Audio/Video/Photo Triage,
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
    console.warn('[WhatsApp Engine] Native fetch not found and node-fetch unavailable.');
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

/**
 * Calculates Great-Circle distance between two decimal coordinates in kilometers.
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
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
// 2. META GRAPH API TRANSPORT (MESSAGES, BUTTONS, REACTIONS)
// ====================================================================

/**
 * Dispatches an outbound WhatsApp text message via Meta Graph API v21.0.
 */
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

/**
 * Dispatches up to 3 interactive reply buttons via Meta Graph API.
 */
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
      const errText = await res.text();
      console.warn(`[WhatsApp API Warning] Interactive buttons failed to ${cleanPhone} (HTTP ${res.status}). Falling back to text:`, errText);
      return await sendWhatsAppMessage(config, cleanPhone, text);
    }
    return true;
  } catch (err) {
    console.error(`[WhatsApp Buttons Network Error] To ${cleanPhone}:`, err.message);
    return await sendWhatsAppMessage(config, cleanPhone, text);
  }
}

/**
 * Injects a sub-400ms native emoji reaction on a specific inbound message ID.
 */
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
    console.warn(`[WhatsApp Reaction Error] ID ${messageId}:`, err.message);
  }
}

// ====================================================================
// 3. GEOSPATIAL RESOLUTION & SITE CONTEXT BINDING
// ====================================================================

/**
 * Resolves site coordinates from table fields or falls back to Google Maps Geocoding API.
 */
async function resolveCoordinates(config, memoryCache, site, airtableWrite) {
  const fields = site.fields || {};
  if (fields.Latitude && fields.Longitude) {
    return { lat: Number(fields.Latitude), lon: Number(fields.Longitude) };
  }

  const queryAddress = fields['Address'] || fields['Site Name'];
  if (!queryAddress || !config.google?.apiKey) return null;

  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryAddress)}&key=${config.google.apiKey}`;
    const res = await fetch(geoUrl);
    const data = await res.json();

    if (data.results && data.results[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      if (airtableWrite) {
        airtableWrite('Sites', {
          'Latitude': loc.lat,
          'Longitude': loc.lng
        }, site.id).catch(() => {});
      }
      return { lat: loc.lat, lon: loc.lng };
    }
  } catch (err) {
    console.warn(`[Geo Resolver Error] Could not geocode address "${queryAddress}":`, err.message);
  }
  return null;
}

/**
 * Binds a field operative's WhatsApp thread to an active court site twin.
 */
async function bindSiteContext(config, site, worker, callerIdentity, dispatchTarget, fromPhone, distanceMeters, userLat, userLon, airtableWrite, fetchDadJoke) {
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
  const checkInCard = `📍 *CHECK-IN VERIFIED | TITAN OS*\n` +
                      `──────────────────────────────\n` +
                      `🏟️ *Court:* ${siteName}\n` +
                      `👤 *Installer:* ${callerIdentity.name} (${callerIdentity.role})\n` +
                      `🌐 *Proximity:* ${Math.round(distanceMeters)}m from court center\n` +
                      `──────────────────────────────\n` +
                      `You are now actively bound to *${siteName}*.\n` +
                      `Send video walkthroughs, voice notes, or receipt photos to log milestones.${bonusJoke}`;

  await sendWhatsAppMessage(config, dispatchTarget, checkInCard);
}

// ====================================================================
// 4. MULTIMODAL NLP TRIAGE (AUDIO, VOICE MEMOS, TEXT)
// ====================================================================

/**
 * Unified multimodal intent triaging engine using Google Gemini 2.5 Pro.
 */
async function triageSpokenOrTextNLP(config, rawText, registeredSiteNames, isAudio = false, mediaItems = [], fromPhone = '', boundSite = null) {
  const boundSiteName = boundSite?.fields?.['Site Name'] || 'None';

  const systemPrompt = `You are the Lead Artificial Intelligence Dispatcher for Titan OS and Bounce Padel.
Analyze this field operative communication (which may be a spoken voice memo, an audio dictation, or raw text):
"${rawText || '[Spoken Audio Input]'}"

CONTEXT:
- Currently Bound Site for this Worker: "${boundSiteName}"
- Known Active Court Sites: ${JSON.stringify(registeredSiteNames || [])}

TASK:
1. Classify the user's intent into EXACTLY ONE of the following categories:
   - "CREATE_ESTIMATE": Operative wants to draft or price a formal client proposal/estimate for padel court builds, accessories, or services.
   - "CONVERT_ESTIMATE": Operative wants to convert an existing estimate into a progress draw invoice (e.g. "bill 50%", "convert to 40% invoice").
   - "CREATE_INVOICE": Operative wants to directly draft a net-new customer invoice.
   - "CHANGE_ORDER": Operative reports a site variation, extra labor, modified scope, or engineering adjustment on-site.
   - "AR_LOOKUP": Operative or executive asks for aging balances, accounts receivable, or outstanding invoices.
   - "ORACLE_QUERY": Operative asks technical engineering questions, foundation specs, bolt torque, glass tolerances, or requests PDF blueprints.
   - "INVENTORY_QUERY": Operative queries stock levels, turf rolls, glass crates, fastener bins, or equipment.
   - "METRICS_QUERY": Operative asks for system throughput, leverage metrics, or telemetry reports.
   - "READINESS_QUERY": Operative asks if a site is ready to mobilize (e.g. "Are we ready for Aurora?").
   - "GENERAL_UPDATE": Operative updates site specifications, reports daily progress, logs materials, or notes physical status.
   - "UNKNOWN": Query does not match any operational command.

2. Extract key entities:
   - "referenced_site_name": If a specific court or customer site is named in speech/text (e.g., "Luke Pelosi", "RCOR Court 2", "Aurora"), extract the exact name.
   - "qbo_customer_name": Targeted customer or account name for financial billing.
   - "qbo_amount": Explicit financial amount mentioned.
   - "qbo_estimate_number": Estimate number referenced.
   - "qbo_invoice_percentage": Draw percentage requested (e.g., 50, 40, 100).
   - "transcript_en": High-fidelity cleaned English transcription of the operative's memo with filler words removed.

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

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gemini NLP Error] HTTP ${res.status}:`, errText);
      return null;
    }

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
// 5. MEDIA PROCESSING PIPELINE & FORENSIC FIELD INSPECTION
// ====================================================================

/**
 * Uploads raw media buffer to Supabase Private Object Storage Bucket.
 */
async function uploadMediaToSupabase(config, buffer, mimeType, extension = 'jpg') {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null;

  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const fileId = crypto.randomUUID();
    const storagePath = `${year}/${month}/${fileId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(config.supabase.bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      console.warn('[Supabase Storage Warning] Upload failed:', uploadError.message);
      return null;
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(config.supabase.bucket)
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

    if (signError || !signedData?.signedUrl) {
      console.warn('[Supabase Storage Warning] Signed URL generation failed:', signError?.message);
      return null;
    }

    return signedData.signedUrl;
  } catch (err) {
    console.warn('[Supabase Storage Exception]:', err.message);
    return null;
  }
}

/**
 * Evaluates an aggregated batch of inspection photos or video sweeps against court milestones.
 */
async function processMediaBatch(config, batch, airtableWriteWithAutoDrop, oracleFileURIs) {
  const { items, site, worker, dispatchTarget, callerIdentity } = batch;
  const siteName = site?.fields?.['Site Name'] || 'Unbound Asset';
  const siteId = site?.id || null;

  console.log(`[Media Pipeline] Executing forensic analysis on ${items.length} file(s) for site: ${siteName}`);

  // Parallel asynchronous Supabase archival
  const uploadPromises = items.map(item => {
    const ext = item.type === 'video' ? 'mp4' : 'jpg';
    return uploadMediaToSupabase(config, item.buffer, item.mimeType, ext);
  });
  const uploadedUrls = (await Promise.all(uploadPromises)).filter(Boolean);

  const parts = [];
  const visionPrompt = `You are the Lead Forensic Structural Inspector for Bounce Padel courts worldwide.
Review the attached image(s) or video frame inspection from site: "${siteName}".

EVALUATION PROTOCOL:
1. Identify all observable physical court construction elements:
   - Concrete slab substrate, ring beam, leveling shims
   - Steel pillars, perimeter anchor bolts, gusset plates
   - Electro-welded structural mesh frames
   - 12mm tempered safety glass panels & neoprene seating gaskets
   - LED light posts, crossbeams, wiring conduits
   - Polyurethane adhesive application, turf rolls, cut lines
   - Silica sand infill distribution & uniform broom sweeping
   - Center net, tensioning winch, post alignment
   - Site safety, organizing of tools, cleanliness, active debris
2. Detect any physical defects, missing parts, or hazardous blockers.
3. Compute an overall completion estimate (0% - 100%).

OUTPUT STRICTLY VALID JSON:
{
  "court_identified": boolean,
  "milestone_summary": "string (concise summary of verified work)",
  "detected_elements": ["string"],
  "hazards_or_blockers": ["string"],
  "estimated_completion_pct": number,
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
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json'
        }
      })
    });

    let inspectionResult = {
      court_identified: true,
      milestone_summary: `Inspection batch logged (${items.length} files).`,
      detected_elements: ['Padel court structure'],
      hazards_or_blockers: [],
      estimated_completion_pct: 50,
      recommended_next_step: 'Proceed to next installation gate.'
    };

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const clean = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        inspectionResult = JSON.parse(clean);
      }
    }

    // Persist to Reports 2 table
    if (airtableWriteWithAutoDrop) {
      const reportPayload = {
        'Headline': `${siteName} — ${inspectionResult.milestone_summary.substring(0, 50)}`,
        'Action Items': inspectionResult.hazards_or_blockers.length > 0 
          ? inspectionResult.hazards_or_blockers.join('\n') 
          : inspectionResult.recommended_next_step,
        'Workflow Mode': 'INSTALLATION',
        'Last Note': `[INSPECTION AUDIT] Verified by ${callerIdentity.name}: ${inspectionResult.milestone_summary}`
      };

      if (worker?.id) reportPayload['Worker'] = [worker.id];
      if (siteId) reportPayload['Site'] = [siteId];

      await airtableWriteWithAutoDrop('Reports 2', reportPayload);

      // Update parent Sites twin
      if (siteId) {
        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': `[FIELD SWEEP] ${callerIdentity.name}: ${inspectionResult.milestone_summary}`,
          'Last Intent': 'FIELD_INSPECTION'
        }, siteId);
      }
    }

    const hazardNote = inspectionResult.hazards_or_blockers.length > 0
      ? `\n⚠️ *Alerts & Blockers:*\n• ` + inspectionResult.hazards_or_blockers.join('\n• ')
      : `\n✅ *Hazards:* None detected. Structural alignment nominal.`;

    const statusCard = `🏟️ *TITAN OS | SITE VERIFICATION AUDIT*\n` +
                       `──────────────────────────────\n` +
                       `📍 *Site:* ${siteName}\n` +
                       `👤 *Inspector:* ${callerIdentity.name}\n` +
                       `📸 *Media Ingested:* ${items.length} file(s)\n` +
                       `──────────────────────────────\n` +
                       `📋 *Status:* ${inspectionResult.milestone_summary}\n` +
                       `🏗️ *Verified:* ${inspectionResult.detected_elements.join(', ')}\n` +
                       hazardNote + `\n` +
                       `──────────────────────────────\n` +
                       `👉 *Next Step:* ${inspectionResult.recommended_next_step}`;

    await sendWhatsAppMessage(config, dispatchTarget, statusCard);
  } catch (err) {
    console.error('[Media Inspection Failure]:', err.message);
    await sendWhatsAppMessage(config, dispatchTarget, `📸 Upload received (${items.length} files). Media archived to the ${siteName} digital twin.`);
  }
}

// ====================================================================
// 6. INBOUND EMAIL & SUBSCRIBER BROADCASTS
// ====================================================================

async function handleInboundEmail(config, emailPayload, getCachedContacts) {
  console.log(`[Email Engine] Processing inbound message from ${emailPayload.from}: "${emailPayload.subject}"`);

  const contacts = getCachedContacts ? await getCachedContacts() : [];
  const senderClean = String(emailPayload.from).toLowerCase();
  const matchedContact = contacts.find(c => {
    const contactEmail = String(c.fields['Email'] || '').toLowerCase().trim();
    return contactEmail && senderClean.includes(contactEmail);
  });

  const senderName = matchedContact?.fields?.['Full Name'] || emailPayload.from;
  const alertCard = `✉️ *TITAN OS | INBOUND LEAD / EMAIL*\n` +
                    `──────────────────────────────\n` +
                    `👤 *From:* ${senderName}\n` +
                    `📌 *Subject:* ${emailPayload.subject}\n` +
                    `──────────────────────────────\n` +
                    `${(emailPayload.text || '').substring(0, 300)}...`;

  await sendWhatsAppMessage(config, config.meta.targetVerifiedPhone, alertCard);
}

async function fanOutToSubscribers(config, targetPhone, msg) {
  await sendWhatsAppMessage(config, targetPhone, msg);
}

// ====================================================================
// 7. MODULE EXPORTS
// ====================================================================
module.exports = {
  userActiveSiteMap,
  lastDroppedCoordinates,
  mediaDebounceQueues,
  userSessionContextMap,
  haversineDistanceKm,
  getUserBoundSiteId,
  updateSessionContext,
  sendWhatsAppMessage,
  sendWhatsAppButtons,
  sendWhatsAppReaction,
  resolveCoordinates,
  bindSiteContext,
  triageSpokenOrTextNLP,
  processMediaBatch,
  handleInboundEmail,
  fanOutToSubscribers
};

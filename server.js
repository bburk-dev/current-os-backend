/**
 * TITAN OS V6.0.22 — HEADLESS ERP ORCHESTRATOR
 * Module: server.js
 * Purpose: Single-Threaded Atomic Boot, Native Meta Webhooks, QBO Finance Copilot,
 *          Atomic Message Deduplication, Conversational Voice Estimates,
 *          Progress Draws, Direct Invoicing, Headless IoT Sensor Telemetry,
 *          Conversational Clarification Engine, Ambient Multi-Turn Memory,
 *          RBAC Bouncer, Zero-UI Site Provisioning, Virtual Readiness,
 *          Executive Drafting Mode, Dynamic Schema Normalization, and Field Intelligence.
 */

// ====================================================================
// 0. GLOBAL POLYFILLS & ENVIRONMENT
// ====================================================================
if (typeof fetch === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    global.fetch = nodeFetch;
    global.Headers = nodeFetch.Headers;
    global.Request = nodeFetch.Request;
    global.Response = nodeFetch.Response;
  } catch (err) {
    console.error('[CRITICAL] node-fetch is missing. Native fetch is not available in this Node version. Run "npm install node-fetch" or set NODE_VERSION to 18+ in Render.');
  }
}

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cluster = require('cluster');

// Import Decoupled Titan OS Modules
const finance = require('./finance');
const oracle = require('./oracle');
const inventory = require('./inventory');
// const equipment = require('./equipment'); // Temporarily disabled until equipment.js is uploaded to server
const whatsapp = require('./whatsapp');
const metrics = require('./metrics'); // Telemetry Layer

// ====================================================================
// 1. GLOBAL CONFIGURATION & SECRETS
// ====================================================================
const PORT = process.env.PORT || 3000;

const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    wabaId: process.env.META_WABA_ID || process.env.WHATSAPP_WABA_ID || process.env.WABA_ID,
    targetVerifiedPhone: '14379287172',
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || process.env.SUPABASE_MEDIA_BUCKET || 'titan-private-media',
    tableDarkMatter: 'dark_matter_vault'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  },
  qbo: {
    companyId: process.env.QBO_COMPANY_ID,
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    accessToken: process.env.QBO_ACCESS_TOKEN,
    refreshToken: null,
    baseUrl: 'https://quickbooks.api.intuit.com/v3/company'
  },
  google: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEO_KEY
  }
};

// ====================================================================
// 2. STATE MACHINES & CACHE-ASIDE ENGINE
// ====================================================================

let oracleFileURIs = [];
const CACHE_TTL_MS = 10 * 60 * 1000;
const ASSIGNMENTS_CACHE_TTL_MS = 3 * 60 * 1000;
const pendingNewSiteRequests = new Map();

// In-Memory Message Deduplication Store
const processedMessageIds = new Map();
const DEDUP_TTL_MS = 300 * 1000;
const draftingSessions = new Map();

const memoryCache = {
  sites: null,
  sitesLastFetched: 0,
  workers: null,
  workersLastFetched: 0,
  contacts: null,
  contactsLastFetched: 0,
  assignments: null,
  assignmentsLastFetched: 0,
  qbo: {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  }
};

// Autonomously overcomes Airtable's 100-record limit by following pagination offsets
async function fetchAllAirtableRecords(tableName, filterFormula = '', sortConfig = '') {
  let records = [];
  let offset = null;
  do {
    let url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}?`;
    if (filterFormula) url += `filterByFormula=${encodeURIComponent(filterFormula)}&`;
    if (sortConfig) url += `${sortConfig}&`;
    if (offset) url += `offset=${encodeURIComponent(offset)}`;
    
    try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.records) records = records.concat(data.records);
      offset = data.offset;
    } catch (err) {
      console.warn(`[Airtable Fetch] Error fetching page for ${tableName}:`, err.message);
      offset = null; // Break loop on error
    }
  } while (offset);
  return records;
}

async function getCachedSites(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.sites && (now - memoryCache.sitesLastFetched < CACHE_TTL_MS)) {
    return memoryCache.sites;
  }
  try {
    memoryCache.sites = await fetchAllAirtableRecords('Sites');
    memoryCache.sitesLastFetched = now;
    console.log(`[Cache Engine] Refreshed ${memoryCache.sites.length} Sites from Airtable into RAM`);
    return memoryCache.sites;
  } catch (err) {
    console.warn('[Cache Engine] Sites refresh failed:', err.message);
    return memoryCache.sites || [];
  }
}

async function getCachedWorkers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.workers && (now - memoryCache.workersLastFetched < CACHE_TTL_MS)) {
    return memoryCache.workers;
  }
  try {
    memoryCache.workers = await fetchAllAirtableRecords('Workers');
    memoryCache.workersLastFetched = now;
    return memoryCache.workers;
  } catch (err) {
    return memoryCache.workers || [];
  }
}

async function getCachedContacts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.contacts && (now - memoryCache.contactsLastFetched < CACHE_TTL_MS)) {
    return memoryCache.contacts;
  }
  try {
    memoryCache.contacts = await fetchAllAirtableRecords('Contacts');
    memoryCache.contactsLastFetched = now;
    return memoryCache.contacts;
  } catch (err) {
    return memoryCache.contacts || [];
  }
}

async function getCachedOpenAssignments(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.assignments && (now - memoryCache.assignmentsLastFetched < ASSIGNMENTS_CACHE_TTL_MS)) {
    return memoryCache.assignments;
  }
  try {
    const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
    const sort = `sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc`;
    memoryCache.assignments = await fetchAllAirtableRecords('Daily Assignments', formula, sort);
    memoryCache.assignmentsLastFetched = now;
    return memoryCache.assignments;
  } catch (err) {
    return memoryCache.assignments || [];
  }
}

async function hydrateQBOCache() {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return;
  try {
    const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceRoleKey);
    const { data, error } = await supabase
      .from('qbo_credentials')
      .select('access_token, refresh_token, expires_at')
      .eq('id', 'primary_tenant')
      .single();

    if (error) throw error;
    if (data && data.access_token && !data.access_token.includes('pending_auth')) {
      const expiresAt = new Date(data.expires_at).getTime();
      const now = Date.now();

      if (now >= expiresAt - 300000 && data.refresh_token && CONFIG.qbo.clientId && CONFIG.qbo.clientSecret) {
        console.log('[Cache Engine] QBO Token refreshing...');
        const basicAuth = Buffer.from(`${CONFIG.qbo.clientId}:${CONFIG.qbo.clientSecret}`).toString('base64');
        const refreshRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`
          },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token })
        });

        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          const newExpiresAt = new Date(Date.now() + (refreshed.expires_in * 1000)).toISOString();
          
          await supabase.from('qbo_credentials').update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token || data.refresh_token,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString()
          }).eq('id', 'primary_tenant');

          data.access_token = refreshed.access_token;
          data.refresh_token = refreshed.refresh_token || data.refresh_token;
        }
      }
      memoryCache.qbo.accessToken = data.access_token;
      memoryCache.qbo.refreshToken = data.refresh_token;
      memoryCache.qbo.expiresAt = new Date(data.expires_at).getTime();
      CONFIG.qbo.accessToken = data.access_token;
      CONFIG.qbo.refreshToken = data.refresh_token;
    }
  } catch (err) {
    console.warn('[Cache Engine] Failed to hydrate QBO credentials:', err.message);
  }
}

async function airtableWriteWithAutoDrop(tableName, payload, recordId = null, retries = 2) {
  if (Object.keys(payload).length === 0) return { success: false, writtenFields: {}, record: null };
  const url = recordId 
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}`;
    
  const method = recordId ? 'PATCH' : 'POST';
  let currentPayload = { fields: { ...payload } };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (Object.keys(currentPayload.fields).length === 0) return { success: false, writtenFields: {}, record: null };
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${CONFIG.airtable.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentPayload)
      });

      if (res.ok) {
        const data = await res.json();
        if (metrics && metrics.incrementMetric) metrics.incrementMetric('database_mutations');
        // Return strictly what survived the write to preserve forensic integrity
        return { success: true, writtenFields: currentPayload.fields, record: data };
      }

      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || '';
      
      if (res.status === 422) {
        const match = errorMsg.match(/(?:field\s*name|field)\s*[:]?\s*["'\\]+([^"'\\]+)["'\\]+/i) ||
                      errorMsg.match(/["'\\]+([^"'\\]+)["'\\]+\s*does not exist/i);
        if (match && match[1]) {
          const badField = match[1];
          console.warn(`[Airtable Auto-Healer] Dropping invalid schema field: "${badField}" from ${tableName}`);
          delete currentPayload.fields[badField];
          continue; 
        }
      }
      throw new Error(`HTTP ${res.status}: ${errorMsg}`);
      
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Airtable Write Error] Table: ${tableName} |`, err.message);
        return { success: false, writtenFields: {}, record: null };
      }
    }
  }
  return { success: false, writtenFields: {}, record: null };
}

// ====================================================================
// 3. EXECUTIVE OPERATIONS, METEOROLOGY, & DRAFTING MODE
// ====================================================================

async function fetchDadJoke() {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://icanhazdadjoke.com/', { 
      headers: { 'Accept': 'application/json' },
      signal: controller.signal 
    });
    clearTimeout(id);
    if (res.ok) {
      const data = await res.json();
      return `\n\n🎁 *Morning Bonus:* ${data.joke}`;
    }
  } catch (e) {}
  return '\n\n🎁 *Morning Bonus:* Keep up the great work!';
}

async function evaluateWeatherTripwires(lat, lon) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_gusts_10m&wind_speed_unit=mph`;
    const response = await fetch(meteoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Open-Meteo Offline');
    const data = await response.json();
    const current = data.current;
    const issues = [];
    
    if (current.wind_gusts_10m > 25) {
      issues.push(`🔴 HIGH WIND HOLD: Gusts at ${current.wind_gusts_10m} mph. Suction cup glass installation suspended.`);
    }
    if (current.temperature_2m < 10) {
      issues.push(`🔴 LOW TEMP HOLD: Ambient temperature is ${current.temperature_2m}°C. Polyurethane turf glue curing suspended.`);
    }
    const dewPointDelta = current.temperature_2m - current.dew_point_2m;
    if (dewPointDelta < 3.0 && current.relative_humidity_2m > 85) {
      issues.push(`🔴 CONDENSATION HOLD: Dew point delta is ${dewPointDelta.toFixed(1)}°C (Humidity: ${current.relative_humidity_2m}%). Substrate moisture will ruin turf adhesive bond.`);
    }
    if (current.precipitation > 0 || (current.weather_code >= 51 && current.weather_code <= 99)) {
      issues.push(`🌧️ RAIN HOLD: Active precipitation detected. Silica sand infill and adhesive operations suspended.`);
    }

    return { safe: issues.length === 0, telemetry: current, warnings: issues };
  } catch (error) {
    clearTimeout(timeoutId);
    return { safe: true, warnings: ['⚠️ Meteorological telemetry offline. Proceed with visual caution.'] };
  }
}

async function evaluateVirtualSiteReadiness(config, siteNameStr, dispatchTarget) {
  await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⏳ Computing virtual readiness matrix for ${siteNameStr}...`);
  if (metrics && metrics.incrementMetric) metrics.incrementMetric('readiness_checks');

  const allSites = await getCachedSites();
  const site = allSites.find(s => 
    s.fields['Site Name'] && 
    s.fields['Site Name'].toLowerCase().includes(siteNameStr.toLowerCase())
  );

  if (!site) {
    return await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⚠️ Could not locate site matching "${siteNameStr}".`);
  }

  const siteId = site.id;
  const siteName = site.fields['Site Name'];
  const latStr = site.fields['Latitude'] || site.fields['Lat'];
  const lonStr = site.fields['Longitude'] || site.fields['Lon'] || site.fields['Lng'];
  
  let lat = latStr ? Number(latStr) : null;
  let lon = lonStr ? Number(lonStr) : null;
  
  if (!lat && site.fields['Site location']) {
     const parts = String(site.fields['Site location']).split(',');
     if (parts.length === 2) {
         lat = Number(parts[0].trim());
         lon = Number(parts[1].trim());
     }
  }

  const openAssignments = await getCachedOpenAssignments();
  const siteAssignments = openAssignments.filter(a => a.fields['Site'] && a.fields['Site'].includes(siteId));
  const hasCrew = siteAssignments.some(a => a.fields['Worker'] && a.fields['Worker'].length > 0);
  let crewStatus = hasCrew ? `✅ Crew Assigned` : `❌ No Crew Assigned`;
  let confidenceScore = 100;

  let weatherStatus = `❓ Unknown Weather`;
  if (lat && lon) {
    const weather = await evaluateWeatherTripwires(lat, lon);
    weatherStatus = weather.safe ? `✅ Weather Clear` : `❌ Active Weather Holds`;
    if (!weather.safe) confidenceScore -= 20;
  } else {
    confidenceScore -= 10;
  }

  let financeStatus = `❓ Deposit Pending`;
  try {
    const qboCustomer = await finance.findOrCreateQboCustomer(config, siteName);
    if (qboCustomer) {
       const arQuery = `select * from Invoice where CustomerRef.value = '${qboCustomer.value}' and Balance > '0' MAXRESULTS 1`;
       const arRes = await finance.qboApiRequest(config, arQuery);
       if (arRes && arRes.QueryResponse && arRes.QueryResponse.Invoice && arRes.QueryResponse.Invoice.length > 0) {
         financeStatus = `❌ Open Balance Pending`;
         confidenceScore -= 15;
       } else {
         financeStatus = `✅ Deposit/Account Cleared`;
       }
    }
  } catch (e) {
    confidenceScore -= 10;
  }

  let inventoryStatus = `✅ Core Materials Ready`;
  if (inventory && inventory.refreshInventoryCache) {
    const stock = await inventory.refreshInventoryCache(config);
    const criticalItems = ['Glass', 'Steel', 'Turf', 'Neoprene', 'Entrance']; 
    const missing = [];
    
    for (const crit of criticalItems) {
      const match = stock.find(i => (i.fields['Item Name'] || '').toLowerCase().includes(crit.toLowerCase()));
      if (match) {
        const qty = Number(match.fields['Quantity on hand'] || match.fields['Quantity'] || 0);
        if (qty <= 0) missing.push(crit);
      } else {
         missing.push(crit); 
      }
    }
    
    if (missing.length > 0) {
      inventoryStatus = `❌ Missing: ${missing.join(', ')}`;
      confidenceScore -= 30;
    }
  }

  const isReady = hasCrew && (weatherStatus.includes('✅')) && (financeStatus.includes('✅')) && (inventoryStatus.includes('✅'));
  const overall = isReady ? `✅ *READY TO MOBILIZE*` : `❌ *NOT READY*`;

  const card = `📊 *TITAN OS | VIRTUAL SITE READINESS*\n` +
               `──────────────────────────────\n` +
               `📍 *Site:* ${siteName}\n` +
               `──────────────────────────────\n` +
               `👥 ${crewStatus}\n` +
               `🌤️ ${weatherStatus}\n` +
               `💰 ${financeStatus}\n` +
               `📦 ${inventoryStatus}\n` +
               `──────────────────────────────\n` +
               `*OVERALL:* ${overall}\n` +
               `*Confidence:* ${confidenceScore}%`;

  await whatsapp.sendWhatsAppMessage(config, dispatchTarget, card);
}

async function executeDraftingMode(config, rawText, audioBuffer, mimeType, draftContext, dispatchTarget) {
  await whatsapp.sendWhatsAppMessage(config, dispatchTarget, "⏳ Structuring professional executive response...");
  
  const prompt = `You are a professional executive assistant for Bob Burk. 
The user has provided a raw dictation (via voice or text) intended to reply to a specific message or email.
Your task is to transcribe and meticulously clean it up into a highly professional, decisive reply.
- Remove all filler words.
- Fix grammar and conversational flow.
- Output ONLY the final polished message text.

Original Context:
"""
${draftContext || 'No context provided.'}
"""

${rawText ? `Raw Text:\n"${rawText}"` : 'Process attached audio dictation.'}`;
  
  const parts = [{ text: prompt }];
  if (audioBuffer) {
    parts.push({ inline_data: { mime_type: mimeType, data: audioBuffer.toString('base64') } });
  }
  
  try {
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2 }
      })
    });
    
    if (!res.ok) throw new Error(`Gemini Draft failed: ${res.status}`);
    const data = await res.json();
    const draftedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const finalMsg = `✅ *Drafted Response:*\n──────────────────────────────\n${draftedText.trim()}\n──────────────────────────────\n_Ready to review or forward._`;
    await whatsapp.sendWhatsAppMessage(config, dispatchTarget, finalMsg);
  } catch (e) {
    await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⚠️ Failed to draft response: ${e.message}`);
  }
}

function startFridayNewsletterCron() {
  const now = new Date();
  const estDateString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const estDate = new Date(estDateString);
  
  let daysUntilFriday = 5 - estDate.getDay();
  if (daysUntilFriday < 0 || (daysUntilFriday === 0 && estDate.getHours() >= 16)) {
    daysUntilFriday += 7;
  }
  
  const nextFriday = new Date(estDate.getFullYear(), estDate.getMonth(), estDate.getDate() + daysUntilFriday, 16, 0, 0, 0);
  const msUntilNextFriday = nextFriday - estDate;
  
  setTimeout(async () => {
    await dispatchExecutiveNewsletter();
    startFridayNewsletterCron();
  }, msUntilNextFriday);
}

async function dispatchExecutiveNewsletter() {
  console.log('[Newsletter Engine] Compiling Friday Executive Briefing...');
  const sites = await getCachedSites(true);
  const assignments = await getCachedOpenAssignments(true);
  
  const activeBuilds = sites.filter(s => s.fields['Workflow Mode'] === 'INSTALLATION').length;
  const nominalMaintenance = sites.filter(s => s.fields['Workflow Mode'] === 'MAINTENANCE' && s.fields['Site Status'] !== 'WINTERIZED_CLOSED').length;
  const openTickets = assignments.length;
  let darkMatterContent = '• No actionable field intelligence signals detected this week.';
  
  if (CONFIG.supabase.url && CONFIG.supabase.serviceRoleKey) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?created_at=gte.${sevenDaysAgo}&order=created_at.desc&limit=50`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': CONFIG.supabase.serviceRoleKey,
          'Authorization': `Bearer ${CONFIG.supabase.serviceRoleKey}`
        }
      });
      
      if (res.ok) {
        const rawVault = await res.json();
        if (rawVault && rawVault.length > 0) {
          const chatterContext = rawVault.map(v => `[${v.site_name || 'Fleet'}] ${v.distilled_context || v.raw_text}`).join('\n');
          const radarPrompt = `You are the Operations Director for Bounce Padel.
Review the following unstructured field notes collected over the past 7 days:
"""
${chatterContext}
"""
Synthesize into a bulleted FIELD INTELLIGENCE SIGNAL for leadership:
1. Material / Hardware observations
2. Installation friction
3. Inventory or supplier issues
4. Technical knowledge gaps
Only report categories with actual evidence. Be concise. No preamble.`;

          const aiRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: radarPrompt }] }],
              generationConfig: { temperature: 0.2 }
            })
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) darkMatterContent = text;
          }
        }
      }
    } catch (e) {
      console.error('[Newsletter Engine] Error compiling field signals:', e.message);
    }
  }
  
  const msg = `📊 *TITAN OS | WEEKLY EXECUTIVE BRIEFING*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `*FLEET CAPACITY*\n` +
              `🏗️ Active Installs Underway: ${activeBuilds}\n` +
              `🎾 Maintained VIP Assets: ${nominalMaintenance}\n` +
              `🛠️ Open Fleet Work Orders: ${openTickets}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🌑 *FIELD INTELLIGENCE SIGNAL (7-Day Exhaust)*\n` +
              `${darkMatterContent}\n\n` +
              `_Generated autonomously. Have a great weekend._`;
              
  if (whatsapp && whatsapp.fanOutToSubscribers) {
    await whatsapp.fanOutToSubscribers(CONFIG, CONFIG.meta.targetVerifiedPhone, msg);
  }
}

// ====================================================================
// 4. INGRESS WEBHOOK CONTROLLER (NATIVE META GRAPH API ONLY)
// ====================================================================

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  if (req.path === '/webhook') {
    console.log(`[HTTP INGRESS] ${req.method} /webhook from ${req.ip || req.headers['x-forwarded-for']}`);
  }
  next();
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    console.log('[Meta Handshake] Webhook Verified Successfully with Meta.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Single-Threaded Atomic Deduplication Flow
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (!body) return;

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0]?.value;
  if (changes?.statuses) return;

  const message = changes?.messages?.[0];
  if (!message) return;

  const rawFrom = message.from || '';
  const messageId = message.id || `msg_${Date.now()}`;
  const fromPhone = String(rawFrom).replace(/\D/g, '');
  const dispatchTarget = fromPhone;

  if (metrics && metrics.incrementMetric) metrics.incrementMetric('messages_processed');

  const now = Date.now();
  if (processedMessageIds.has(messageId)) {
    console.log(`[Meta Ingress] 🛡️ Deduplicated messageId: ${messageId}`);
    return;
  }
  processedMessageIds.set(messageId, now);

  for (const [id, timestamp] of processedMessageIds.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) processedMessageIds.delete(id);
  }

  console.log(`[Meta Ingress] Processing message ${messageId} from ${dispatchTarget} (Type: ${message.type || 'text'})`);

  try {
    const callerIdentity = await resolveIdentity(fromPhone);
    console.log(`[Bouncer] Resolved Identity for ${fromPhone}: ${callerIdentity.type} (${callerIdentity.name})`);

    const sessionSiteId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(fromPhone) : null;
    let site = null;
    let allSites = [];
    
    try {
        allSites = await getCachedSites();
    } catch (e) {
        console.warn(`[Cache Log] Failed to retrieve sites from cache: ${e.message}`);
    }
    
    if (sessionSiteId && allSites.length > 0) {
      site = allSites.find(s => s.id === sessionSiteId) || null;
    }
    
    if (!site && allSites.length > 0) {
      site = allSites.find(s => {
        const gid = String(s.fields['WhatsApp Group ID'] || '').trim();
        return gid && (gid === fromPhone || fromPhone.includes(gid));
      }) || null;
    }

    const worker = callerIdentity.workerRecord;

    try {
      let safeMessageType = message.type || 'text';
      if (safeMessageType === 'interactive') safeMessageType = 'text';
      
      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': messageId,
        'Message Type': safeMessageType
      });
    } catch (e) {
        console.warn(`[Airtable Log] Failed to write to Inbound Messages 2: ${e.message}`);
    }

    const interactiveButtonId = message.interactive?.button_reply?.id || '';
    if (interactiveButtonId) {
      if (interactiveButtonId === 'DRAFT_REPLY' || interactiveButtonId === 'REPLY_VIA_EMAIL') {
        const existingSession = draftingSessions.get(fromPhone) || {};
        draftingSessions.set(fromPhone, { active: true, context: existingSession.context || null });
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `🎙️ *Drafting Mode Active*\nSend a voice note or text message to draft your reply. I will remove filler words and format it professionally.`);
        return;
      }

      if (interactiveButtonId.startsWith('BIND_SITE_')) {
        const selectedSiteId = interactiveButtonId.replace('BIND_SITE_', '');
        const selectedSite = allSites.find(s => s.id === selectedSiteId);
        if (selectedSite) {
          const userLat = whatsapp.lastDroppedCoordinates?.get(fromPhone)?.lat;
          const userLon = whatsapp.lastDroppedCoordinates?.get(fromPhone)?.lon;
          
          let dist = 0;
          if (userLat && userLon) {
             try {
                const coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, selectedSite, airtableWriteWithAutoDrop);
                if (coords) {
                    dist = whatsapp.haversineDistanceKm(userLat, userLon, coords.lat, coords.lon) * 1000;
                }
             } catch (geocodingBindingErr) {
                console.warn(`[Geocoding Error] Failed to resolve coordinates for binding: ${geocodingBindingErr.message}`);
             }
          }

          let weatherStr = '';
          if (userLat && userLon) {
             try {
                const weatherCheck = await evaluateWeatherTripwires(userLat, userLon);
                if (!weatherCheck.safe) weatherStr = `⚠️ *METEOROLOGICAL TRIPWIRE TRIGGERED*\n${weatherCheck.warnings.join('\n')}`;
                else if (weatherCheck.telemetry) weatherStr = `🟢 *Conditions Clear:* Wind (${weatherCheck.telemetry.wind_gusts_10m} mph), Temp (${weatherCheck.telemetry.temperature_2m}°C).`;
             } catch (wError) {
                console.warn(`[Meteorology Error] Failed to evaluate weather during binding: ${wError.message}`);
             }
          }
          
          await whatsapp.bindSiteContext(CONFIG, selectedSite, worker, callerIdentity, dispatchTarget, fromPhone, dist, userLat, userLon, airtableWriteWithAutoDrop, fetchDadJoke, weatherStr)
            .catch(e => console.error('[Context Binding Error]:', e.message));
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_EMAIL_EST_')) {
        const estId = interactiveButtonId.replace('QBO_EMAIL_EST_', '');
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, "⏳ Dispatching Estimate PDF via QuickBooks...");
        try {
          const emailRes = await finance.sendQboTransactionEmail(CONFIG, 'estimate', estId);
          if (emailRes) {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ *Estimate Dispatched:*\nOfficial QuickBooks PDF delivered to client.`);
          } else {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ QuickBooks could not send email. Verify client email address.`);
          }
        } catch (emailErr) {
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Failed to send estimate email.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_EMAIL_INV_')) {
        const invId = interactiveButtonId.replace('QBO_EMAIL_INV_', '');
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, "⏳ Dispatching Invoice PDF via QuickBooks...");
        try {
          const emailRes = await finance.sendQboTransactionEmail(CONFIG, 'invoice', invId);
          if (emailRes) {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ *Invoice Dispatched:*\nOfficial QuickBooks Invoice delivered to client.`);
          } else {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ QuickBooks could not send invoice email.`);
          }
        } catch (emailErr) {
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Failed to send invoice email.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_CONVERT_')) {
        const parts = interactiveButtonId.split('_');
        const estimateId = parts[2];
        const percentage = parseFloat(parts[3]) || 100;
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⏳ Converting estimate into active ${percentage}% invoice...`);

        try {
          const estData = await finance.qboApiRequest(CONFIG, `/estimate/${estimateId}`);
          const estimate = estData?.Estimate;
          if (!estimate) {
            return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Could not locate estimate #${estimateId}.`);
          }

          const defaultItemRef = finance.getDefaultQboItemRef 
            ? await finance.getDefaultQboItemRef(CONFIG) 
            : { value: "1", name: "Services" };
          const defaultTaxRef = finance.resolveQboTaxCode 
            ? await finance.resolveQboTaxCode(CONFIG, true) 
            : { value: "TAX" };

          const invLines = [];
          const estLines = (estimate.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail');

          if (estLines.length > 0) {
            for (const line of estLines) {
              const origAmt = parseFloat(line.Amount) || 0;
              const drawAmt = parseFloat((origAmt * (percentage / 100)).toFixed(2));
              invLines.push({
                Amount: drawAmt,
                DetailType: "SalesItemLineDetail",
                Description: `Progress Draw (${percentage}%) - ${line.Description || 'Bounce Padel Court Construction'}`,
                SalesItemLineDetail: {
                  Qty: line.SalesItemLineDetail?.Qty || 1,
                  UnitPrice: drawAmt,
                  ItemRef: line.SalesItemLineDetail?.ItemRef || { value: String(defaultItemRef.value) },
                  TaxCodeRef: line.SalesItemLineDetail?.TaxCodeRef || { value: String(defaultTaxRef.value) }
                }
              });
            }
          } else {
            const totalAmt = parseFloat(estimate.TotalAmt) || 0;
            const drawAmt = parseFloat((totalAmt * (percentage / 100)).toFixed(2));
            invLines.push({
              Amount: drawAmt,
              DetailType: "SalesItemLineDetail",
              Description: `Progress Draw (${percentage}%) against Estimate #${estimate.DocNumber || estimate.Id}`,
              SalesItemLineDetail: {
                Qty: 1,
                UnitPrice: drawAmt,
                ItemRef: { value: String(defaultItemRef.value) },
                TaxCodeRef: { value: String(defaultTaxRef.value) }
              }
            });
          }

          const invPayload = {
            CustomerRef: { value: String(estimate.CustomerRef.value), name: estimate.CustomerRef.name },
            GlobalTaxCalculation: "TaxExcluded",
            Line: invLines,
            LinkedTxn: [{ TxnId: estimate.Id, TxnType: "Estimate" }]
          };
          if (estimate.BillEmail) invPayload.BillEmail = estimate.BillEmail;
          if (estimate.BillAddr) invPayload.BillAddr = estimate.BillAddr;

          const invRes = await finance.qboApiRequest(CONFIG, '/invoice', 'POST', invPayload);
          const inv = invRes?.Invoice;
          const invoiceNum = inv?.DocNumber || inv?.Id || 'Issued';
          const invTotal = inv?.TotalAmt ? parseFloat(inv.TotalAmt).toFixed(2) : '0.00';

          const successCard = `🧾 *TITAN OS | PROGRESS DRAW INVOICE ISSUED*\n` +
                              `──────────────────────────────\n` +
                              `*Invoice:* #${invoiceNum}\n` +
                              `*Client:* ${estimate.CustomerRef.name}\n` +
                              `*Estimate Ref:* #${estimate.DocNumber || estimate.Id}\n` +
                              `*Draw Split:* ${percentage}%\n` +
                              `*Total (Inc. Tax):* $${invTotal} CAD\n` +
                              `──────────────────────────────\n` +
                              `✅ Invoice sealed in QuickBooks Online.`;

          const buttons = [{ id: `QBO_EMAIL_INV_${inv?.Id}`, title: "Email Invoice" }];
          await whatsapp.sendWhatsAppButtons(CONFIG, dispatchTarget, successCard, buttons);
        } catch (convErr) {
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `Headquarters is finalizing the ledger sync for this invoice.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_APPROVE_CO_')) {
        const coEstimateId = interactiveButtonId.replace('QBO_APPROVE_CO_', '');
        try {
          await finance.qboApiRequest(CONFIG, '/estimate?operation=update', 'POST', {
            Id: coEstimateId,
            SyncToken: "0",
            TxnStatus: "Accepted"
          });
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ *TITAN OS | CHANGE-ORDER SEALED*\nScope approved on QBO Estimate #${coEstimateId}. Authorized to proceed.`);
        } catch (coApproveErr) {
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `Headquarters is finalizing the change-order ledger sync.`);
        }
        return;
      }
    }

    if (message.type === 'location') {
      console.log(`[Location Triage] Received pin from ${fromPhone}. Triggering reaction...`);
      
      whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, '📍')
        .catch(e => console.error('[Meta API] Reaction Error:', e.message));
        
      const userLat = message.location?.latitude;
      const userLon = message.location?.longitude;
      
      if (userLat && userLon) {
        whatsapp.lastDroppedCoordinates.set(fromPhone, { lat: userLat, lon: userLon, timestamp: Date.now() });

        let weatherStr = '';
        try {
          const weatherCheck = await evaluateWeatherTripwires(userLat, userLon);
          if (!weatherCheck.safe) {
            weatherStr = `⚠️ *METEOROLOGICAL TRIPWIRE TRIGGERED*\n${weatherCheck.warnings.join('\n')}\n_Certain physical workflows may be suspended._`;
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, weatherStr)
                .catch(e => console.error('[Meta API] Weather Warning Message Error:', e.message));
          } else if (weatherCheck.telemetry) {
            weatherStr = `🟢 *Conditions Clear:* Wind (${weatherCheck.telemetry.wind_gusts_10m} mph), Temp (${weatherCheck.telemetry.temperature_2m}°C).`;
          }
        } catch (weatherError) {
          console.warn(`[Meteorology Error] Failed to evaluate weather for ${fromPhone}:`, weatherError.message);
        }

        let currentSites = [];
        try {
           currentSites = await getCachedSites(true);
        } catch (cacheError) {
           console.error('[Cache Error] Failed to retrieve sites:', cacheError.message);
        }
        
        const nearby = [];
        
        for (const s of currentSites) {
          try {
            const coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, s, airtableWriteWithAutoDrop);
            if (coords) {
              // Reverted threshold strictly to 800 meters as defined in the Founder's Log (Entry #024)
              const dist = whatsapp.haversineDistanceKm(userLat, userLon, coords.lat, coords.lon) * 1000;
              if (dist <= 800) nearby.push({ site: s, distance: dist });
            }
          } catch (geocodeError) {
             console.warn(`[Geocoding Error] Failed to resolve coordinates for site ${s.id}:`, geocodeError.message);
          }
        }
        
        nearby.sort((a, b) => a.distance - b.distance);

        if (nearby.length === 1) {
          console.log(`[Location Triage] Single site found (${nearby[0].site.fields['Site Name']}). Binding context.`);
          await whatsapp.bindSiteContext(CONFIG, nearby[0].site, worker, callerIdentity, dispatchTarget, fromPhone, nearby[0].distance, userLat, userLon, airtableWriteWithAutoDrop, fetchDadJoke, weatherStr)
             .catch(e => console.error('[Context Binding Error]:', e.message));
        } else if (nearby.length > 1) {
          console.log(`[Location Triage] Multiple sites found. Dispatching selector buttons.`);
          const buttons = nearby.slice(0, 3).map((n) => {
            let safeTitle = String(n.site.fields['Site Name'] || 'Site').trim();
            if (safeTitle.length > 20) {
               safeTitle = safeTitle.substring(0, 20).trim();
            }
            return {
              id: `BIND_SITE_${n.site.id}`,
              title: safeTitle
            };
          });
          
          await whatsapp.sendWhatsAppButtons(CONFIG, dispatchTarget, `📍 Multiple courts detected within 800m. Please select your active zone:`, buttons)
              .catch(e => {
                  console.error('[Meta API] Button Message Error (falling back to text):', e.message);
                  const fallbackText = `📍 Multiple courts detected nearby:\n\n` + 
                                       buttons.map(b => `👉 ${b.title}`).join('\n') + 
                                       `\n\nReply with the exact name to bind context.`;
                  return whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, fallbackText);
              });
        } else {
          console.log(`[Site Engine] Unmapped location pin dropped at (${userLat.toFixed(5)}, ${userLon.toFixed(5)}) by ${dispatchTarget}`);
          
          pendingNewSiteRequests.set(fromPhone, {
            lat: userLat,
            lon: userLon,
            timestamp: Date.now()
          });

          const promptMsg = `📍 *UNREGISTERED LOCATION DETECTED*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Coordinates: \`${userLat.toFixed(5)}, ${userLon.toFixed(5)}\`\n` +
            `No Bounce Padel courts were located within 800m.\n\n` +
            `Would you like to register this as a *NEW SITE*?\n\n` +
            `Reply with the site name:\n` +
            `👉 *CREATE SITE: [Site Name]*\n` +
            `_(e.g., CREATE SITE: RCOR Court 1)_`;

          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, promptMsg)
              .catch(e => console.error('[Meta API] Unregistered Location Message Error:', e.message));
        }
      }
      return;
    }

    if (message.type === 'video' || message.type === 'image' || message.type === 'document') {
      const mediaObj = message[message.type];
      const mediaId = mediaObj.id;
      const mimeType = mediaObj.mime_type || (message.type === 'video' ? 'video/mp4' : 'image/jpeg');
      
      if (metrics && metrics.incrementMetric) metrics.incrementMetric('photos_processed');

      await whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, message.type === 'video' ? '🎥' : '🧾');

      let mediaBuffer = null;
      if (CONFIG.meta.accessToken && mediaId) {
        const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
        const metaMediaData = await metaMediaRes.json().catch(() => ({}));
        if (metaMediaRes.ok && metaMediaData?.url) {
          const mediaBufferRes = await fetch(metaMediaData.url, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
          if (mediaBufferRes.ok) mediaBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());
        }
      }

      if (!mediaBuffer) {
        console.warn(`[Media Ingress] Failed to download media buffer for id: ${mediaId}`);
        return;
      }

      const queueKey = `${dispatchTarget}_${site?.id || 'unbound'}`;

      if (!whatsapp.mediaDebounceQueues.has(queueKey)) {
        whatsapp.mediaDebounceQueues.set(queueKey, {
          items: [],
          timer: null,
          site,
          worker,
          dispatchTarget,
          callerIdentity
        });
      }

      const queue = whatsapp.mediaDebounceQueues.get(queueKey);
      queue.items.push({ buffer: mediaBuffer, mimeType, messageId, type: message.type, caption: mediaObj.caption || '' });
      
      if (queue.timer) clearTimeout(queue.timer);
      queue.timer = setTimeout(async () => {
        const currentBatch = whatsapp.mediaDebounceQueues.get(queueKey);
        whatsapp.mediaDebounceQueues.delete(queueKey);
        if (!currentBatch || currentBatch.items.length === 0) return;
        
        console.log(`[Batch Engine] Executing analysis on ${currentBatch.items.length} files from ${dispatchTarget}`);

        try {
          const hasVideo = currentBatch.items.some(i => i.type === 'video');
          const hasReceiptKeyword = currentBatch.items.some(i => /receipt|expense|costco|depot|gas|fuel|food|lunch|dinner|invoice|hardware|bill|store/i.test(i.caption || ''));
          
          let isReceipt = hasReceiptKeyword;
          let isScreenshot = false;
          
          if (!hasVideo && currentBatch.items.length > 0) {
            try {
              const firstImg = currentBatch.items[0];
              const checkPrompt = `Determine if this image is a paper financial receipt/invoice/store bill, a screenshot of an email/text message, OR a construction/padel court scene. Return JSON strictly: {"is_receipt": boolean, "is_message_screenshot": boolean, "ocr_text": "extracted text if message screenshot, else null"}`;
              
              const checkRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    role: 'user',
                    parts: [
                      { text: checkPrompt },
                      { inline_data: { mime_type: firstImg.mimeType, data: firstImg.buffer.toString('base64') } }
                    ]
                  }],
                  generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
                })
              });

              if (checkRes.ok) {
                const checkData = await checkRes.json();
                const parsedCheck = JSON.parse(checkData.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
                if (parsedCheck.is_receipt === true) isReceipt = true;
                if (parsedCheck.is_message_screenshot === true) isScreenshot = true;
                
                if (isScreenshot) {
                  draftingSessions.set(dispatchTarget, { active: false, context: parsedCheck.ocr_text });
                  const buttons = [{ id: 'DRAFT_REPLY', title: "Draft Reply" }];
                  await whatsapp.sendWhatsAppButtons(CONFIG, dispatchTarget, `📸 *TITAN OS | MESSAGE SCREENSHOT DETECTED*\n──────────────────────────────\nWould you like to draft a professional reply to this message?`, buttons);
                  return;
                }
              }
            } catch (e) {
              console.warn('[Batch Triage] Fast visual classifier bypassed:', e.message);
            }
          }

          if (!hasVideo && isReceipt && finance && finance.handleReceiptUpload) {
            await finance.handleReceiptUpload(CONFIG, currentBatch, dispatchTarget, (t,m)=>whatsapp.sendWhatsAppMessage(CONFIG,t,m), callerIdentity, airtableWriteWithAutoDrop);
            return;
          }

          await whatsapp.processMediaBatch(CONFIG, currentBatch, airtableWriteWithAutoDrop, oracleFileURIs);
        } catch (batchErr) {
          console.error('[Batch Engine Failure]:', batchErr);
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Error processing media submission: ${batchErr.message}`);
        }
      }, 3500);
      return;
    }

    if (message.type === 'audio' || message.type === 'voice') {
      const mediaObj = message[message.type];
      const mediaId = mediaObj?.id;
      const mimeType = mediaObj?.mime_type || 'audio/ogg';
      
      if (metrics && metrics.incrementMetric) metrics.incrementMetric('voice_commands');
      await whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, '🎙️');

      let audioBuffer = null;
      if (CONFIG.meta.accessToken && mediaId) {
        const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
        const metaMediaData = await metaMediaRes.json().catch(() => ({}));
        if (metaMediaRes.ok && metaMediaData?.url) {
          const mediaBufferRes = await fetch(metaMediaData.url, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
          if (mediaBufferRes.ok) audioBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());
        }
      }

      if (audioBuffer) {
        if (draftingSessions.has(fromPhone) && draftingSessions.get(fromPhone).active) {
           const draftCtx = draftingSessions.get(fromPhone).context;
           draftingSessions.delete(fromPhone);
           await executeDraftingMode(CONFIG, null, audioBuffer, mimeType, draftCtx, dispatchTarget);
           return;
        }

        const registeredSiteNames = allSites.map(s => s.fields['Site Name']).filter(Boolean);
        const boundSiteId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(fromPhone) : null;
        const activeBoundSite = boundSiteId ? allSites.find(s => s.id === boundSiteId) : site;

        console.log(`[Audio Ingress] Parsing spoken voice memo via Gemini 2.5 Pro from ${dispatchTarget}...`);

        const spokenTriage = await whatsapp.triageSpokenOrTextNLP(CONFIG, '', registeredSiteNames, true, [{ buffer: audioBuffer, mimeType }], fromPhone, activeBoundSite);

        console.log(`[Audio Ingress] Spoken Intent: ${spokenTriage?.intent || 'UNKNOWN'} | Client: ${spokenTriage?.qbo_customer_name || 'None'}`);

        if (spokenTriage) {
          const dM = (t,m) => whatsapp.sendWhatsAppMessage(CONFIG, t, m);
          const dB = (t,m,b) => whatsapp.sendWhatsAppButtons(CONFIG, t, m, b);

          if (spokenTriage.intent === 'CREATE_ESTIMATE' && finance?.handleEstimateCreation) {
            await finance.handleEstimateCreation(CONFIG, spokenTriage, dispatchTarget, oracleFileURIs, dM, dB);
            return;
          }
          if (spokenTriage.intent === 'CONVERT_ESTIMATE' && finance?.handleInvoiceApproval) {
            await finance.handleInvoiceApproval(CONFIG, spokenTriage, dispatchTarget, dM, dB);
            return;
          }
          if (spokenTriage.intent === 'CREATE_INVOICE' && finance?.handleInvoiceCreation) {
            await finance.handleInvoiceCreation(CONFIG, spokenTriage, dispatchTarget, oracleFileURIs, dM, dB);
            return;
          }
          if (spokenTriage.intent === 'CHANGE_ORDER' && finance?.handleConversationalChangeOrder) {
            await finance.handleConversationalChangeOrder(CONFIG, spokenTriage, dispatchTarget, oracleFileURIs, dM, dB, callerIdentity);
            return;
          }
          if (spokenTriage.intent === 'AR_LOOKUP') {
            const userRole = String(callerIdentity.role || '').trim().toLowerCase();
            if (userRole !== 'admin') {
              return await dM(dispatchTarget, `⚠️ Access Denied. Financial ledger queries are restricted to Admin roles.`);
            }
            if (finance?.handleARLookup) {
              await finance.handleARLookup(CONFIG, dispatchTarget, dM, callerIdentity);
              return;
            }
          }
          if (spokenTriage.intent === 'ORACLE_QUERY' && oracle?.handleOracleQuery) {
            await oracle.handleOracleQuery(CONFIG, spokenTriage, dispatchTarget, oracleFileURIs, dM);
            return;
          }
          if (spokenTriage.intent === 'INVENTORY_QUERY' && inventory?.handleSpokenInventorySnapshot) {
            await inventory.handleSpokenInventorySnapshot(CONFIG, spokenTriage.transcript_en || '', dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
            return;
          }
          if (spokenTriage.intent === 'INVENTORY_UPDATE' && inventory?.handleSpokenInventoryUpdate) {
            await inventory.handleSpokenInventoryUpdate(CONFIG, spokenTriage.transcript_en || '', dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
            return;
          }
          if (spokenTriage.intent === 'READINESS_QUERY') {
             const targetSiteName = spokenTriage.qbo_customer_name || (activeBoundSite ? activeBoundSite.fields['Site Name'] : null);
             if (!targetSiteName) return await dM(dispatchTarget, `⚠️ Please specify a court name.`);
             return await evaluateVirtualSiteReadiness(CONFIG, targetSiteName, dispatchTarget);
          }
          if (spokenTriage.intent === 'NAVIGATION_QUERY' || (spokenTriage.transcript_en || '').toLowerCase().includes('directions to') || (spokenTriage.transcript_en || '').toLowerCase().includes('location for')) {
             let targetSiteName = spokenTriage.referenced_site_name;
             const tLower = (spokenTriage.transcript_en || '').toLowerCase();
             
             if (!targetSiteName) {
                 targetSiteName = tLower.replace(/can i get directions to\s*/i, '').replace(/directions to\s*/i, '').replace(/location for\s*/i, '').replace(/how do i get to\s*/i, '').replace(/\?/g, '').trim();
             }
             
             let activeTargetSite = null;
             
             // Fuzzy match the site name
             if (targetSiteName) {
               activeTargetSite = allSites.find(s => {
                  const sName = (s.fields['Site Name'] || '').toLowerCase();
                  if (sName.includes(targetSiteName.toLowerCase())) return true;
                  
                  // Fuzzy logic: check if spoken name matches phonetically or closely
                  const words = sName.split(' ').filter(w => w.length > 3);
                  return words.some(w => targetSiteName.toLowerCase().includes(w));
               });
             } else {
               activeTargetSite = activeBoundSite;
             }
             
             if (activeTargetSite) {
                let lat = activeTargetSite.fields['Latitude'] || activeTargetSite.fields['Lat'];
                let lon = activeTargetSite.fields['Longitude'] || activeTargetSite.fields['Lon'] || activeTargetSite.fields['Lng'];
                
                if (!lat && activeTargetSite.fields['Site location']) {
                    const parts = String(activeTargetSite.fields['Site location']).split(',');
                    if (parts.length === 2) {
                        lat = parts[0].trim();
                        lon = parts[1].trim();
                    }
                }
                
                if (lat && lon) {
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&dir_action=navigate`;
                    const satUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lon}&zoom=19&basemap=satellite`;
                    
                    const navCard = `🧭 *TITAN OS | DIGITAL SITE PASS*\n` +
                                    `──────────────────────────────\n` +
                                    `🏟️ *Destination:* ${activeTargetSite.fields['Site Name']}\n` +
                                    `🌐 *Coordinates:* \`${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}\`\n` +
                                    `──────────────────────────────\n` +
                                    `🚗 *Driving Directions:*\n${mapsUrl}\n\n` +
                                    `🛰️ *Satellite View (For Logistics):*\n${satUrl}`;
                    
                    return await dM(dispatchTarget, navCard);
                }
             }
             return await dM(dispatchTarget, `⚠️ Could not locate coordinates for "${targetSiteName || 'that site'}".`);
          }

          // DYNAMIC AIRTABLE READ / WRITE INTENT FOR SPOKEN MEMOS
          const transcript = spokenTriage.transcript_en || '';
          const transcriptLower = transcript.toLowerCase();
          const isQuestion = transcriptLower.includes('what') || transcriptLower.includes('who') || transcriptLower.includes('how') || transcriptLower.includes('tell me') || transcript.includes('?');
          const isUpdate = transcriptLower.includes('update site') || transcriptLower.includes('change site') || transcriptLower.includes('set site') || transcriptLower.includes('update');

          if (isQuestion || isUpdate) {
            let activeTargetSite = null;
            
            // PRIORITY 1: Explicitly Named Site via NLP Extraction
            if (spokenTriage.referenced_site_name) {
              const ref = spokenTriage.referenced_site_name.toLowerCase();
              activeTargetSite = allSites.find(s => {
                  const sName = (s.fields['Site Name'] || '').toLowerCase();
                  return sName.includes(ref) || ref.includes(sName);
              });
            }
            // PRIORITY 2: Fuzzy matching in Transcript
            if (!activeTargetSite) {
              activeTargetSite = allSites.find(s => {
                  const sName = (s.fields['Site Name'] || '').toLowerCase();
                  if (transcriptLower.includes(sName)) return true;
                  const words = sName.split(' ').filter(w => w.length > 4);
                  return words.some(w => transcriptLower.includes(w));
              });
            }
            // PRIORITY 3: Fallback to Currently Bound Site
            if (!activeTargetSite) {
              activeTargetSite = activeBoundSite;
            }

            if (!activeTargetSite) {
              if (whatsapp.updateSessionContext) whatsapp.updateSessionContext(fromPhone, { pendingText: transcript });
              return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `Got it. Which site does this update apply to?`);
            }

            // DYNAMIC READ
            if (isQuestion && !isUpdate) {
              try {
                const queryPrompt = `You are Titan OS, assisting a field supervisor.
User query: "${transcript}"
Site Record (${activeTargetSite.fields['Site Name']}):
${JSON.stringify(activeTargetSite.fields, null, 2)}

Answer accurately based strictly on the record. If empty, state that it is not documented in the ledger.`;

                const geminiRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: queryPrompt }] }],
                    generationConfig: { temperature: 0.1 }
                  })
                });

                if (geminiRes.ok) {
                  const aiData = await geminiRes.json();
                  const answer = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (answer) {
                    return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `🏟️ *${activeTargetSite.fields['Site Name']} Ledger:*\n${answer.trim()}`);
                  }
                }
              } catch (e) {}
            }

            // DYNAMIC WRITE
            if (isUpdate) {
              try {
                const knownColumns = new Set();
                allSites.forEach(s => { if (s.fields) Object.keys(s.fields).forEach(k => knownColumns.add(k)); });
                
                const extractionPrompt = `You are an AI extracting database patches for the 'Sites' table.
Transcript: "${transcript}"
Known Airtable Columns: ${JSON.stringify(Array.from(knownColumns))}

Extract any fields the user wants updated. Match extracted keys EXACTLY to the 'Known Airtable Columns' above (e.g. use "Turf Colour" not "Turf Color", use "Supplier" not "Turf Supplier").
Format Single Select dropdowns in Title Case (e.g. "Green", "Mondo", "Yes").
Format Checkboxes as strictly boolean true or false.
Return ONLY valid JSON mapping exact field names to values.
Do not wrap in markdown quotes. Return empty JSON {} if no columns identified.`;

                const geminiRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
                    generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
                  })
                });

                let payloadToPatch = {
                  'Last Note': `[FIELD UPDATE] ${callerIdentity.name}: "${transcript}"`,
                  'Last Intent': 'DYNAMIC_SITE_UPDATE'
                };

                if (geminiRes.ok) {
                  const aiData = await geminiRes.json();
                  const rawJson = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (rawJson) {
                    const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    
                    // Route to dynamic schema normalizer to completely avoid 422 Dropdown errors
                    const normalized = whatsapp.normalizeSitePayload ? whatsapp.normalizeSitePayload(parsed, activeTargetSite) : parsed;
                    
                    for (const [key, value] of Object.entries(normalized)) {
                        payloadToPatch[key] = value;
                    }
                  }
                }

                // Call write and strictly only announce the fields that SURVIVED Airtable's 422 schema checks
                const writeResult = await airtableWriteWithAutoDrop('Sites', payloadToPatch, activeTargetSite.id);
                await getCachedSites(true);
                if (metrics && metrics.incrementMetric) metrics.incrementMetric('sites_updated');

                if (writeResult && writeResult.success) {
                  const writtenKeys = Object.keys(writeResult.writtenFields).filter(k => k !== 'Last Note' && k !== 'Last Intent');
                  if (writtenKeys.length > 0) {
                    const writtenSummary = writtenKeys.map(k => `${k}: *${writeResult.writtenFields[k]}*`).join('\n• ');
                    await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ Logged to the *${activeTargetSite.fields['Site Name']}* ledger.\n\n*Successfully Updated:*\n• ${writtenSummary}`);
                  } else {
                    await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Logged to the *${activeTargetSite.fields['Site Name']}* ledger, but Airtable rejected the specific column updates (Schema mismatch).`);
                  }
                } else {
                  await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `❌ Failed to update the *${activeTargetSite.fields['Site Name']}* ledger.`);
                }
                return;
                
              } catch (e) {
                console.error('[Dynamic Extraction Failure]', e.message);
              }
            }
          }
        }
      }
      return;
    }

    const payloadText = message.text?.body || message.interactive?.button_reply?.title || '';
    if (message.type === 'text' || message.type === 'interactive' || payloadText) {
      const txt = payloadText.trim();
      const lTxt = txt.toLowerCase();

      console.log(`[Text Engine] Parsing payload: "${txt}" from ${dispatchTarget} (Caller: ${callerIdentity.name}, Role: ${callerIdentity.role})`);

      if (draftingSessions.has(fromPhone) && draftingSessions.get(fromPhone).active && !interactiveButtonId) {
         const draftCtx = draftingSessions.get(fromPhone).context;
         draftingSessions.delete(fromPhone);
         await executeDraftingMode(CONFIG, txt, null, null, draftCtx, dispatchTarget);
         return;
      }

      if (lTxt === '/help' || lTxt === 'help') {
        const helpMenu = `🛠️ *TITAN OS | COMMAND CENTER*\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n` +
                         `*👷 Field Installation*\n` +
                         `• Drop a 📍 Pin to check in.\n` +
                         `• Send photos/receipts to log expenses or progress.\n` +
                         `• Send voice notes to dynamically update specifications.\n\n` +
                         `*🚚 Navigation & Telemetry*\n` +
                         `• \`/map [Site Name]\` for routing\n` +
                         `• \`/readiness [Site Name]\` for audit matrix\n` +
                         `• \`/metrics\` for system throughput\n\n` +
                         `*📦 Resources*\n` +
                         `• "Check inventory"\n` +
                         `• "What equipment is at [Site]?"\n\n` +
                         `*💰 Finance & Exec*\n` +
                         `• "What is my 30+ AR?"\n` +
                         `• "Create an estimate for [Client]..."`;
        return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, helpMenu);
      }

      if (lTxt.startsWith('/map ') || lTxt.includes('directions to') || lTxt.includes('location for')) {
         let targetSiteName = lTxt.replace(/^\/map\s*/i, '').replace(/directions to\s*/i, '').replace(/can i get directions to\s*/i, '').replace(/location for\s*/i, '').replace(/how do i get to\s*/i, '').replace(/\?/g, '').trim();
         const allSites = await getCachedSites();
         
         let targetSite = allSites.find(s => s.fields['Site Name'] && s.fields['Site Name'].toLowerCase().includes(targetSiteName.toLowerCase()));

         if (!targetSite) {
            targetSite = allSites.find(s => {
                const sName = (s.fields['Site Name'] || '').toLowerCase();
                const words = sName.split(' ').filter(w => w.length > 3);
                return words.some(w => targetSiteName.toLowerCase().includes(w));
            });
         }

         if (targetSite) {
           let lat = targetSite.fields['Latitude'] || targetSite.fields['Lat'];
           let lon = targetSite.fields['Longitude'] || targetSite.fields['Lon'] || targetSite.fields['Lng'];
           
           if (!lat && targetSite.fields['Site location']) {
               const parts = String(targetSite.fields['Site location']).split(',');
               if (parts.length === 2) {
                   lat = parts[0].trim();
                   lon = parts[1].trim();
               }
           }
           
           if (lat && lon) {
               const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&dir_action=navigate`;
               const satUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lon}&zoom=19&basemap=satellite`;

               const navCard = `🧭 *TITAN OS | DIGITAL SITE PASS*\n` +
                               `──────────────────────────────\n` +
                               `🏟️ *Destination:* ${targetSite.fields['Site Name']}\n` +
                               `🌐 *Coordinates:* \`${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}\`\n` +
                               `──────────────────────────────\n` +
                               `🚗 *Driving Directions:*\n${mapsUrl}\n\n` +
                               `🛰️ *Satellite View (For Logistics):*\n${satUrl}`;
               
               return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, navCard);
           }
         }
         return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Could not locate coordinates for "${targetSiteName}".`);
      }

      if (lTxt === '/metrics' || lTxt === '/telemetry') {
        const userRole = String(callerIdentity.role || '').trim().toLowerCase();
        if (userRole !== 'admin') return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Restricted to Admin.`);
        if (metrics && metrics.getTelemetryReport) {
            return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, metrics.getTelemetryReport());
        }
        return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Metrics module offline.`);
      }

      if (lTxt.startsWith('/readiness')) {
        const siteNameStr = txt.replace(/^\/readiness\s*/i, '').trim();
        return await evaluateVirtualSiteReadiness(CONFIG, siteNameStr, dispatchTarget);
      }

      if (lTxt.startsWith('create site') || lTxt.startsWith('new site') || (pendingNewSiteRequests.has(fromPhone) && (lTxt.startsWith('yes') || lTxt.startsWith('site:')))) {
        let siteName = txt.replace(/^create\s+site:?/i, '').replace(/^new\s+site:?/i, '').replace(/^site:?/i, '').trim();
        const pendingGeo = pendingNewSiteRequests.get(fromPhone) || whatsapp.lastDroppedCoordinates.get(fromPhone);

        if (!pendingGeo) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `📍 Drop a WhatsApp pin first, then reply with CREATE SITE: [Name]`);
        }

        const newRecord = await airtableWriteWithAutoDrop('Sites', {
          'Site Name': siteName,
          'Workflow Mode': 'INSTALLATION',
          'Site Status': 'ACTIVE',
          'Latitude': pendingGeo.lat,
          'Longitude': pendingGeo.lon
        });

        if (newRecord?.success) {
          pendingNewSiteRequests.delete(fromPhone);
          await getCachedSites(true);
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `🏟️ *NEW SITE CREATED*\nDigital twin active for *${siteName}* at \`${pendingGeo.lat.toFixed(5)}, ${pendingGeo.lon.toFixed(5)}\`.`);
        }
        return;
      }

      // Check text-based dynamic read / write
      const allSites = await getCachedSites();
      const registeredSiteNames = allSites.map(s => s.fields['Site Name']).filter(Boolean);
      const boundSiteId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(fromPhone) : null;
      const boundSite = boundSiteId ? allSites.find(s => s.id === boundSiteId) : site;

      const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, registeredSiteNames, false, [], fromPhone, boundSite);
      
      if (triage && triage.intent === 'INVENTORY_QUERY' && inventory && inventory.handleSpokenInventorySnapshot) {
         await inventory.handleSpokenInventorySnapshot(CONFIG, txt, dispatchTarget, (t,m)=>whatsapp.sendWhatsAppMessage(CONFIG,t,m), callerIdentity, airtableWriteWithAutoDrop);
         return;
      }
      
      if (triage && triage.intent === 'INVENTORY_UPDATE' && inventory && inventory.handleSpokenInventoryUpdate) {
         await inventory.handleSpokenInventoryUpdate(CONFIG, txt, dispatchTarget, (t,m)=>whatsapp.sendWhatsAppMessage(CONFIG,t,m), callerIdentity, airtableWriteWithAutoDrop);
         return;
      }

      if (triage && triage.intent === 'NAVIGATION_QUERY') {
         let targetSiteName = triage?.referenced_site_name;
         if (!targetSiteName) {
             targetSiteName = lTxt.replace(/^\/map\s*/i, '').replace(/directions to\s*/i, '').replace(/can i get directions to\s*/i, '').replace(/location for\s*/i, '').replace(/how do i get to\s*/i, '').replace(/\?/g, '').trim();
         }
         
         let activeTargetSite = null;
         if (targetSiteName) {
           activeTargetSite = allSites.find(s => {
               const sName = (s.fields['Site Name'] || '').toLowerCase();
               if (sName.includes(targetSiteName.toLowerCase())) return true;
               
               const words = sName.split(' ').filter(w => w.length > 3);
               return words.some(w => targetSiteName.toLowerCase().includes(w));
           });
         } else {
           activeTargetSite = boundSite;
         }

         if (activeTargetSite) {
           let lat = activeTargetSite.fields['Latitude'] || activeTargetSite.fields['Lat'];
           let lon = activeTargetSite.fields['Longitude'] || activeTargetSite.fields['Lon'] || activeTargetSite.fields['Lng'];
           
           if (!lat && activeTargetSite.fields['Site location']) {
               const parts = String(activeTargetSite.fields['Site location']).split(',');
               if (parts.length === 2) {
                   lat = parts[0].trim();
                   lon = parts[1].trim();
               }
           }
           
           if (lat && lon) {
               const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&dir_action=navigate`;
               const satUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lon}&zoom=19&basemap=satellite`;
               
               const navCard = `🧭 *TITAN OS | DIGITAL SITE PASS*\n` +
                               `──────────────────────────────\n` +
                               `🏟️ *Destination:* ${activeTargetSite.fields['Site Name']}\n` +
                               `🌐 *Coordinates:* \`${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}\`\n` +
                               `──────────────────────────────\n` +
                               `🚗 *Driving Directions:*\n${mapsUrl}\n\n` +
                               `🛰️ *Satellite View (For Logistics):*\n${satUrl}`;
               
               return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, navCard);
           }
         }
         return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Could not locate coordinates for "${targetSiteName || 'that site'}".`);
      }

      const isQuestion = lTxt.includes('what') || lTxt.includes('who') || lTxt.includes('when') || lTxt.includes('how') || lTxt.includes('tell me') || txt.endsWith('?');
      const isUpdate = lTxt.includes('update site') || lTxt.includes('change site') || lTxt.includes('set site');

      if ((isQuestion || isUpdate) && boundSite) {
        
        let activeTargetSite = null;
        if (triage?.referenced_site_name) {
          const ref = triage.referenced_site_name.toLowerCase();
          activeTargetSite = allSites.find(s => {
              const sName = (s.fields['Site Name'] || '').toLowerCase();
              return sName.includes(ref) || ref.includes(sName);
          });
        }
        if (!activeTargetSite) {
           activeTargetSite = allSites.find(s => {
              const sName = (s.fields['Site Name'] || '').toLowerCase();
              if (lTxt.includes(sName)) return true;
              const words = sName.split(' ').filter(w => w.length > 4);
              return words.some(w => lTxt.includes(w));
          });
        }
        if (!activeTargetSite) activeTargetSite = boundSite;
        
        if (isQuestion && !isUpdate) {
          const queryPrompt = `Answer the question from this record:\nQuery: "${txt}"\nRecord: ${JSON.stringify(activeTargetSite.fields, null, 2)}`;
          const geminiRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: queryPrompt }] }] })
          });
          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (ans) return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `🏟️ *${activeTargetSite.fields['Site Name']} Ledger:*\n${ans.trim()}`);
          }
        }
        if (isUpdate) {
          const knownColumns = new Set();
          allSites.forEach(s => { if (s.fields) Object.keys(s.fields).forEach(k => knownColumns.add(k)); });
          
          const extractPrompt = `Extract key-value pairs for Airtable Sites table update:\n"${txt}"\nKnown Columns: ${JSON.stringify(Array.from(knownColumns))}\nReturn JSON strictly matching Known Columns.`;
          const geminiRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
              generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
            })
          });
          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
              const parsed = JSON.parse(rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
              const normalized = whatsapp.normalizeSitePayload ? whatsapp.normalizeSitePayload(parsed, activeTargetSite) : parsed;
              
              const payload = { 'Last Note': `[TEXT UPDATE] ${callerIdentity.name}: "${txt}"`, 'Last Intent': 'DYNAMIC_SITE_UPDATE' };
              for (const [key, value] of Object.entries(normalized)) {
                  payload[key] = value;
              }
              
              const writeResult = await airtableWriteWithAutoDrop('Sites', payload, activeTargetSite.id);
              await getCachedSites(true);
              
              if (writeResult && writeResult.success) {
                const writtenKeys = Object.keys(writeResult.writtenFields).filter(k => k !== 'Last Note' && k !== 'Last Intent');
                if (writtenKeys.length > 0) {
                  const writtenSummary = writtenKeys.map(k => `${k}: *${writeResult.writtenFields[k]}*`).join('\n• ');
                  await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ Logged to the *${activeTargetSite.fields['Site Name']}* ledger.\n\n*Successfully Updated:*\n• ${writtenSummary}`);
                } else {
                  await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Logged to the *${activeTargetSite.fields['Site Name']}* ledger, but Airtable rejected the specific column updates (Schema mismatch).`);
                }
              } else {
                await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `❌ Failed to update the *${activeTargetSite.fields['Site Name']}* ledger.`);
              }
              return;
            }
          }
        }
      }
      return;
    }

  } catch (err) {
    console.error('[Runtime Exception in /webhook]:', err);
  }
});

// ====================================================================
// F. HEADLESS IN-SITU IOT TELEMETRY INGRESS
// ====================================================================
app.post('/api/telemetry/iot', async (req, res) => {
  res.status(202).json({ status: 'Accepted', message: 'In-situ sensor telemetry ingested.' });

  try {
    const { site_id, site_name, slab_moisture_pct, slab_temp_c, ambient_humidity_pct } = req.body;
    
    if (!site_id && !site_name) {
      console.warn('[IoT Telemetry] Discarded telemetry: No site reference.');
      return;
    }

    const allSites = await getCachedSites();
    const site = allSites.find(s => s.id === site_id || (site_name && s.fields['Site Name']?.toLowerCase() === site_name.toLowerCase()));

    if (!site) {
      console.warn(`[IoT Telemetry] Site not found for identifier: ${site_id || site_name}`);
      return;
    }

    console.log(`[IoT Telemetry] Logging physical telemetry for ${site.fields['Site Name']}: Moisture=${slab_moisture_pct}%, Temp=${slab_temp_c}°C`);

    const holds = [];
    if (slab_moisture_pct !== undefined && slab_moisture_pct > 3.0) {
      holds.push(`💧 *IN-SITU SLAB MOISTURE CRITICAL (${slab_moisture_pct}%):* Exceeds 3.0% threshold. Polyurethane turf glue will suffer osmotic blistering.`);
    }

    if (slab_temp_c !== undefined && slab_temp_c < 10.0) {
      holds.push(`❄️ *SUBSTRATE TEMP CRITICAL (${slab_temp_c}°C):* Concrete slab too cold for adhesive molecular curing.`);
    }

    const note = `[IoT SENSOR LOG] Moisture: ${slab_moisture_pct ?? 'N/A'}% | Temp: ${slab_temp_c ?? 'N/A'}°C | Humidity: ${ambient_humidity_pct ?? 'N/A'}%`;
    await airtableWriteWithAutoDrop('Sites', {
      'Last Note': note,
      'Last Intent': holds.length > 0 ? 'PHYSICAL_HOLD_ENGAGED' : 'IOT_TELEMETRY_LOG'
    }, site.id);

    if (holds.length > 0) {
      const alertCard = `⚠️ *TITAN OS | IN-SITU PHYSICAL HOLD*\n` +
                        `──────────────────────────────\n` +
                        `🏟️ *Court:* ${site.fields['Site Name']}\n` +
                        `📡 *Source:* Embedded Concrete Data Logger\n` +
                        `──────────────────────────────\n` +
                        holds.join('\n') + `\n\n` +
                        `_Physical turf gluing & glass seating automatically suspended on this asset._`;

      const groupTarget = site.fields['WhatsApp Group ID'] || CONFIG.meta.targetVerifiedPhone;
      await whatsapp.sendWhatsAppMessage(CONFIG, groupTarget, alertCard);
    }

  } catch (err) {
    console.error('[IoT Ingress Runtime Error]:', err.message);
  }
});

// ====================================================================
// G. COMMERCIAL EMAIL INGRESS (AIRTABLE AUTOMATION WEBHOOK TARGET)
// ====================================================================
app.post('/api/inbound-email', async (req, res) => {
  res.sendStatus(200);

  try {
    const b = req.body || {};
    const fromAddr = b.from || b.sender || b.From || b.email || b.Email || 'Airtable Lead System';
    const subjectLine = b.subject || b.Subject || b.title || 'Inbound Commercial Inquiry';
    
    let rawText = '';
    if (b.text || b.body_plain || b.content || b.message) {
        rawText = b.text || b.body_plain || b.content || b.message;
    } else {
        rawText = JSON.stringify(b);
    }
    
    const cleanText = typeof rawText === 'string' ? rawText.replace(/<[^>]*>?/gm, '').trim() : JSON.stringify(rawText);

    if (cleanText.length < 5 || cleanText === '{}') {
      console.warn('[Email Ingress] Ignored malformed empty payload from Airtable automation.');
      return;
    }

    console.log(`[Email Ingress] Processing email from ${fromAddr}: "${subjectLine}"`);
    
    if (whatsapp && whatsapp.handleInboundEmail) {
        const emailPayload = {
            from: fromAddr,
            to: b.to || '',
            cc: b.cc || '',
            subject: subjectLine,
            text: cleanText,
            html: b.html || ''
        };
        await whatsapp.handleInboundEmail(CONFIG, emailPayload, getCachedContacts);
    }
  } catch (err) {
    console.error('[Runtime Exception in /api/inbound-email]:', err);
  }
});

app.post('/api/sync-oracle', async (req, res) => {
  try {
    const internalKey = req.headers['x-titan-internal-key'];
    if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
      return res.status(403).json({ error: 'Unauthorized: Invalid Cryptographic Signature' });
    }

    console.log('[Titan OS Oracle] Manual synchronization triggered via webhook.');
    res.status(202).json({ status: 'Accepted', message: 'Oracle Sync Protocol Initiated in background.' });

    if (oracle && oracle.syncOracleDocs) {
      oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; });
    }
  } catch (error) {
    console.error('[Titan OS Oracle] Manual Sync execution failed:', error);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '6.0.22' });
});

async function resolveIdentity(fromPhone) {
  const workers = await getCachedWorkers();
  const cleanDigits = String(fromPhone).replace(/\D/g, '');
  
  const worker = workers.find(w => {
    const rawNumber = String(w.fields['WhatsApp Number'] || w.fields['Phone E164'] || w.fields['Phone'] || w.fields['Mobile'] || '').replace(/\D/g, '');
    return rawNumber && (rawNumber === cleanDigits || cleanDigits.endsWith(rawNumber) || rawNumber.endsWith(cleanDigits));
  });
  
  if (worker) {
    return { 
      type: 'WORKER', 
      id: worker.id, 
      name: worker.fields['Full Name'] || 'Field Tech', 
      role: worker.fields['Role'] || 'Installer', 
      workerRecord: worker, 
      phone: fromPhone,
      language: worker.fields['Language'] || 'English'
    };
  }
  return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: fromPhone, language: 'English' };
}

// ====================================================================
// SINGLE-THREADED ATOMIC BOOT SEQUENCE
// ====================================================================
if (!globalThis.__TITAN_SERVER_INITIALIZED__) {
  globalThis.__TITAN_SERVER_INITIALIZED__ = true;

  process.on('uncaughtException', (err) => console.error('[CRITICAL] Uncaught Exception:', err));
  process.on('unhandledRejection', (reason) => console.error('[CRITICAL] Unhandled Rejection:', reason));

  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V6.0.22 SINGLE-THREADED ORCHESTRATOR RUNNING`);
  console.log(`====================================================================`);

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Core Engine] System online and listening on PORT ${PORT}`);
    try {
      await getCachedSites();
      await getCachedWorkers();
      await getCachedContacts();
      await getCachedOpenAssignments();
      
      if (inventory && inventory.refreshInventoryCache) {
          await inventory.refreshInventoryCache(CONFIG);
      }
      
      // Initialize Background Timers
      startFridayNewsletterCron();
      if (oracle && oracle.syncOracleDocs) {
        oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; });
        setInterval(() => { oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; }); }, 24 * 60 * 60 * 1000);
      }

    } catch (err) {
      console.error(`[Cache Hydration Error]:`, err.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Core Engine] Port ${PORT} already bound in this process space. Bypassing secondary bind.`);
    } else {
      console.error('[Core Engine] Listener Error:', err);
    }
  });

  process.on('SIGTERM', () => {
    console.log('[Core Engine] SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });
}

module.exports = app;

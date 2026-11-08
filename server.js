/**
 * TITAN OS V6.0.22 — HEADLESS ERP ORCHESTRATOR
 * Module: server.js
 * Purpose: Cluster Boot, Cron Jobs, Cache Management, Native Meta Graph Webhooks,
 *          Autonomous QBO Token Refresh, Media Batch Execution, and Zero-UI Site Provisioning
 */

// ====================================================================
// 0. GLOBAL POLYFILLS & ENVIRONMENT
// ====================================================================
if (!globalThis.fetch) {
  try {
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch;
    globalThis.Headers = nodeFetch.Headers;
    globalThis.Request = nodeFetch.Request;
    globalThis.Response = nodeFetch.Response;
  } catch (err) {
    console.warn('[System] native fetch not found and node-fetch not installed.');
  }
}

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const cluster = require('cluster');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Import Decoupled Titan OS Modules
const finance = require('./finance');
const oracle = require('./oracle');
const inventory = require('./inventory');
const whatsapp = require('./whatsapp');

// ====================================================================
// 1. GLOBAL CONFIGURATION & SECRETS
// ====================================================================
const PORT = process.env.PORT || 3000;
const numCPUs = process.env.WEB_CONCURRENCY || os.cpus().length || 1;

const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    wabaId: process.env.META_WABA_ID || process.env.WABA_ID,
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

// Universal WhatsApp message dispatcher adapter: handles both (target, text) and (CONFIG, target, text)
function dispatchOutboundWhatsApp(targetOrConfig, textOrTarget, possibleText) {
  if (possibleText !== undefined) {
    return whatsapp.sendWhatsAppMessage(targetOrConfig, textOrTarget, possibleText);
  }
  return whatsapp.sendWhatsAppMessage(CONFIG, targetOrConfig, textOrTarget);
}

// ====================================================================
// 2. STATE MACHINES & CACHE-ASIDE ENGINE
// ====================================================================

let oracleFileURIs = [];
const CACHE_TTL_MS = 10 * 60 * 1000;
const ASSIGNMENTS_CACHE_TTL_MS = 3 * 60 * 1000;

// Ephemeral buffer for off-site GPS pins awaiting naming confirmation
const pendingNewSiteRequests = new Map();

const memoryCache = {
  sites: null,
  sitesLastFetched: 0,
  workers: null,
  workersLastFetched: 0,
  contacts: null,
  contactsLastFetched: 0,
  assignments: null,
  assignmentsLastFetched: 0,
  coordinates: new Map(),
  qbo: {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  }
};

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
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Workers?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memoryCache.workers = data.records || [];
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

async function getCachedOpenAssignments(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.assignments && (now - memoryCache.assignmentsLastFetched < ASSIGNMENTS_CACHE_TTL_MS)) {
    return memoryCache.assignments;
  }
  try {
    const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memoryCache.assignments = data.records || [];
    memoryCache.assignmentsLastFetched = now;
    return memoryCache.assignments;
  } catch (err) {
    return memoryCache.assignments || [];
  }
}

// Autonomous QBO Token Hydration & Auto-Refresh Daemon
async function hydrateQBOCache() {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) {
      console.warn('[Cache Engine] Supabase credentials missing. Bypassing QBO state hydration.');
      return;
  }
  try {
      const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceRoleKey);
      const { data, error } = await supabase
          .from('qbo_credentials')
          .select('access_token, refresh_token, expires_at')
          .eq('id', 'primary_tenant')
          .single();

      if (error) throw error;
      if (data && data.access_token && !data.access_token.includes('pending_auth') && !data.access_token.includes('PASTE_')) {
          const expiresAt = new Date(data.expires_at).getTime();
          const now = Date.now();

          // If token is expired or within 5 minutes of expiring, refresh using refresh_token
          if (now >= expiresAt - 300000 && data.refresh_token && CONFIG.qbo.clientId && CONFIG.qbo.clientSecret) {
              console.log('[Cache Engine] QBO Access Token expired or near expiry. Initiating refresh...');
              const basicAuth = Buffer.from(`${CONFIG.qbo.clientId}:${CONFIG.qbo.clientSecret}`).toString('base64');
              const refreshRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
                  method: 'POST',
                  headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Authorization': `Basic ${basicAuth}`
                  },
                  body: new URLSearchParams({
                      grant_type: 'refresh_token',
                      refresh_token: data.refresh_token
                  })
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
                  console.log('[Cache Engine] QBO Cryptographic State Successfully Auto-Refreshed & Sealed in DB');
              } else {
                  console.warn('[Cache Engine] QBO Token Refresh HTTP error:', refreshRes.status);
              }
          }

          memoryCache.qbo.accessToken = data.access_token;
          memoryCache.qbo.refreshToken = data.refresh_token;
          memoryCache.qbo.expiresAt = new Date(data.expires_at).getTime();

          CONFIG.qbo.accessToken = data.access_token;
          CONFIG.qbo.refreshToken = data.refresh_token;
          console.log('[Cache Engine] QBO Cryptographic State Hydrated into RAM and CONFIG');
      } else {
          console.warn('[Cache Engine] QBO Credentials in Supabase are unauthenticated or using placeholders.');
      }
  } catch (err) {
      console.warn('[Cache Engine] Failed to hydrate QBO credentials:', err.message);
  }
}

async function airtableWriteWithAutoDrop(tableName, payload, recordId = null, retries = 2) {
  if (Object.keys(payload).length === 0) return null;
  const url = recordId 
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}`;
    
  const method = recordId ? 'PATCH' : 'POST';
  let currentPayload = { fields: { ...payload } };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (Object.keys(currentPayload.fields).length === 0) return null;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${CONFIG.airtable.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentPayload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || '';
        
        if (res.status === 422) {
          const match = errorMsg.match(/field\s*["'\\]+([^"'\\]+)["'\\]+/i) || errorMsg.match(/Unknown field name\s*["'\\]+([^"'\\]+)["'\\]+/i);
          if (match && match[1]) {
            const badField = match[1];
            console.warn(`[Airtable Auto-Healer] Dropping invalid schema field: "${badField}" from ${tableName}`);
            delete currentPayload.fields[badField];
            continue; 
          }
        }
        throw new Error(`HTTP ${res.status}: ${errorMsg}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Airtable Write Error] Table: ${tableName} |`, err.message);
        return null;
      }
    }
  }
  return null;
}

// ====================================================================
// 3. EXECUTIVE PROJECT MANAGEMENT & METEOROLOGICAL TELEMETRY
// ====================================================================

async function evaluateWeatherTripwires(lat, lon) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
      const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,wind_gusts_10m&wind_speed_unit=mph`;
      const response = await fetch(meteoUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Open-Meteo Telemetry Offline');
      
      const data = await response.json();
      const current = data.current;
      const issues = [];
      
      if (current.wind_gusts_10m > 25) {
          issues.push(`🔴 HIGH WIND HOLD: Gusts at ${current.wind_gusts_10m} mph. Glass lifting suspended.`);
      }
      
      const dewPointDelta = current.temperature_2m - current.dew_point_2m;
      if (dewPointDelta < 3.0 && current.relative_humidity_2m > 85) {
          issues.push(`🔴 CONDENSATION HOLD: Dew point delta is ${dewPointDelta.toFixed(1)}°C. Turf adhesive curing suspended.`);
      }

      return { safe: issues.length === 0, telemetry: current, warnings: issues };
  } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Titan OS Edge] Weather Tripwire evaluation bypassed due to network failure.', error.message);
      return { safe: true, warnings: ['⚠️ Meteorological telemetry offline. Proceed with visual caution.'] };
  }
}

function startFridayNewsletterCron() {
  const now = new Date();
  const estDateString = now.toLocaleString("en-US", {timeZone: "America/New_York"});
  const estDate = new Date(estDateString);
  
  let daysUntilFriday = 5 - estDate.getDay();
  if (daysUntilFriday < 0 || (daysUntilFriday === 0 && estDate.getHours() >= 16)) {
      daysUntilFriday += 7;
  }
  
  const nextFriday = new Date(estDate.getFullYear(), estDate.getMonth(), estDate.getDate() + daysUntilFriday, 16, 0, 0, 0);
  const msUntilNextFriday = nextFriday - estDate;
  
  console.log(`[Newsletter Cron] Scheduled for ${msUntilNextFriday / 1000 / 60 / 60} hours from now.`);
  
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
  
  let darkMatterContent = 'No anomalies detected this week.';
  
  if (CONFIG.supabase.url && CONFIG.supabase.serviceRoleKey) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?created_at=gte.${sevenDaysAgo}&order=created_at.desc&limit=10`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
            'apikey': CONFIG.supabase.serviceRoleKey,
            'Authorization': `Bearer ${CONFIG.supabase.serviceRoleKey}`
        }
      });
      
      if (res.ok) {
        const vault = await res.json();
        if (vault && vault.length > 0) {
            darkMatterContent = vault.slice(0, 5).map(dm => 
              `• *${dm.site_name}* (${dm.category}): ${dm.distilled_context || dm.raw_text}`
            ).join('\n');
        }
      }
    } catch (e) {
       console.error('[Newsletter Engine] Supabase fetch failed', e);
    }
  }
  
  const msg = `📊 *TITAN OS | WEEKLY EXECUTIVE BRIEFING*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `*KPI ROLLUP*\n` +
              `🏗️ Active Installs Underway: ${activeBuilds}\n` +
              `🎾 Maintained VIP Assets: ${nominalMaintenance}\n` +
              `🛠️ Open Fleet Work Orders: ${openTickets}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🌑 *DARK MATTER LOG (Last 7 Days)*\n` +
              `${darkMatterContent}\n\n` +
              `_Generated autonomously. Have a great weekend._`;
              
  if (whatsapp && whatsapp.fanOutToSubscribers) {
      await whatsapp.fanOutToSubscribers(CONFIG, CONFIG.meta.targetVerifiedPhone, msg);
  }
}

// ====================================================================
// 4. INGRESS WEBHOOK CONTROLLER (NATIVE META GRAPH API)
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

// Meta Webhook Verification Handshake
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    console.log('[Meta Handshake] Webhook Verified Successfully with Meta.');
    return res.status(200).send(challenge);
  }
  console.warn('[Meta Handshake] Rejected. Verify token mismatch or invalid mode.');
  return res.sendStatus(403);
});

// Inbound Event Pipeline
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (!body) return;

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0]?.value;
  
  if (changes?.statuses) return; // Drop read/delivery receipts

  const message = changes?.messages?.[0];
  if (!message) return;

  const rawFrom = message.from || '';
  const messageId = message.id || `msg_${Date.now()}`;
  const fromPhone = String(rawFrom).replace(/\D/g, '');
  const dispatchTarget = fromPhone;

  console.log(`[Meta Ingress] Processing message from ${dispatchTarget} (Type: ${message.type || 'text'})`);

  try {
    const callerIdentity = await resolveIdentity(fromPhone);
    const sessionSiteId = whatsapp.userActiveSiteMap?.get(fromPhone);
    let site = null;
    
    if (sessionSiteId) {
      const allSites = await getCachedSites();
      site = allSites.find(s => s.id === sessionSiteId) || null;
    }
    
    if (!site) {
      const allSites = await getCachedSites();
      site = allSites.find(s => {
          const gid = String(s.fields['WhatsApp Group ID'] || '').trim();
          return gid && (gid === fromPhone || fromPhone.includes(gid));
      }) || null;
    }

    const worker = callerIdentity.workerRecord;

    // ================================================================
    // A. LOCATION DROPS (Proof of Presence, Weather & Site Discovery)
    // ================================================================
    if (message.type === 'location') {
      if (whatsapp.sendWhatsAppReaction) {
          whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, '📍').catch(() => {});
      }
      const userLat = message.location?.latitude;
      const userLon = message.location?.longitude;
      
      if (userLat && userLon) {
        if (whatsapp.lastDroppedCoordinates) {
            whatsapp.lastDroppedCoordinates.set(fromPhone, { lat: userLat, lon: userLon, timestamp: Date.now() });
        }

        const weatherCheck = await evaluateWeatherTripwires(userLat, userLon);
        if (!weatherCheck.safe && whatsapp.sendWhatsAppMessage) {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ *METEOROLOGICAL TRIPWIRE TRIGGERED*\n${weatherCheck.warnings.join('\n')}\n_Certain physical workflows may be suspended._`);
        }

        const allSites = await getCachedSites();
        const nearby = [];
        for (const s of allSites) {
          if (whatsapp.resolveCoordinates) {
              const coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, s, airtableWriteWithAutoDrop);
              if (coords) {
                const dist = whatsapp.haversineDistanceKm(userLat, userLon, coords.lat, coords.lon) * 1000;
                if (dist <= 800) nearby.push({ site: s, distance: dist });
              }
          }
        }
        nearby.sort((a, b) => a.distance - b.distance);

        if (nearby.length > 0 && whatsapp.bindSiteContext) {
          await whatsapp.bindSiteContext(CONFIG, nearby[0].site, worker, callerIdentity, dispatchTarget, fromPhone, nearby[0].distance, userLat, userLon, airtableWriteWithAutoDrop, async () => { return '\n\n🎁 *Morning Bonus:* Keep up the great work!'; });
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
            `_(e.g., CREATE SITE: Miami Shores Club)_`;

          if (whatsapp.sendWhatsAppMessage) {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, promptMsg);
          }
        }
      }
      return;
    }

    // ================================================================
    // B. TEXT NLP COMMANDS, SITE PROVISIONING & FINANCE ROUTING
    // ================================================================
    const rawText = message.text?.body || '';
    if (message.type === 'text' || rawText) {
      const txt = rawText.trim();
      const lTxt = txt.toLowerCase();

      console.log(`[Text Engine] Inbound message: "${txt}" from ${dispatchTarget}`);

      // 0. Zero-UI Site Provisioning Handler
      const isCreateSiteQuery = lTxt.startsWith('create site') || 
                                lTxt.startsWith('new site') || 
                                lTxt.startsWith('/createsite') || 
                                lTxt.startsWith('/newsite') ||
                                (pendingNewSiteRequests.has(fromPhone) && (lTxt.startsWith('yes') || lTxt.startsWith('site:')));

      if (isCreateSiteQuery) {
          let siteName = txt
            .replace(/^create\s+site:?/i, '')
            .replace(/^new\s+site:?/i, '')
            .replace(/^\/createsite:?/i, '')
            .replace(/^\/newsite:?/i, '')
            .replace(/^yes,?:?/i, '')
            .replace(/^site:?/i, '')
            .trim();

          if (!siteName) {
              await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ Please reply with the site name:\n👉 *CREATE SITE: [Site Name]*\n_(e.g., CREATE SITE: RCOR Court 3)_`);
              return;
          }

          const pendingGeo = pendingNewSiteRequests.get(fromPhone) || whatsapp.lastDroppedCoordinates?.get(fromPhone);
          
          if (!pendingGeo || (Date.now() - pendingGeo.timestamp > 2 * 60 * 60 * 1000)) {
              await dispatchOutboundWhatsApp(dispatchTarget, `📍 Coordinates expired. Please drop a new WhatsApp location pin first, then reply with:\n*CREATE SITE: ${siteName}*`);
              return;
          }

          console.log(`[Site Engine] Provisioning "${siteName}" at (${pendingGeo.lat}, ${pendingGeo.lon}) for ${dispatchTarget}`);
          
          const newRecord = await airtableWriteWithAutoDrop('Sites', {
              'Site Name': siteName,
              'Workflow Mode': 'INSTALLATION',
              'Site Status': 'ACTIVE',
              'Latitude': pendingGeo.lat,
              'Longitude': pendingGeo.lon
          });

          if (newRecord && newRecord.id) {
              pendingNewSiteRequests.delete(fromPhone);
              await getCachedSites(true);

              if (whatsapp.userActiveSiteMap) {
                  whatsapp.userActiveSiteMap.set(fromPhone, newRecord.id);
              }

              const weather = await evaluateWeatherTripwires(pendingGeo.lat, pendingGeo.lon);
              let weatherNote = '';
              if (!weather.safe) {
                  weatherNote = `\n\n⚠️ *METEOROLOGICAL WARNING*\n${weather.warnings.join('\n')}`;
              }

              const confirmMsg = `🏟️ *NEW SITE PROVISIONED*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `📍 *Site:* ${siteName}\n` +
                  `🌐 *Coordinates:* \`${pendingGeo.lat.toFixed(5)}, ${pendingGeo.lon.toFixed(5)}\`\n` +
                  `⚙️ *Mode:* INSTALLATION\n` +
                  `📊 *Status:* ACTIVE\n\n` +
                  `✅ Digital twin active. You are now checked in to *${siteName}*.\n` +
                  `Send photos, voice memos, or video sweeps to begin logging progress.${weatherNote}`;

              await dispatchOutboundWhatsApp(dispatchTarget, confirmMsg);
          } else {
              await dispatchOutboundWhatsApp(dispatchTarget, `❌ Failed to create site in Airtable. Please try again or notify HQ.`);
          }
          return;
      }

      // 1. Headless Accounts Receivable (QBO) Ingress
      const isARQuery = lTxt === 'ar' || 
                        lTxt.startsWith('ar ') || 
                        lTxt.endsWith(' ar') || 
                        lTxt.includes('ar +') || 
                        lTxt.includes('ar+') || 
                        lTxt.includes('+ 30') || 
                        lTxt.includes('+30') || 
                        lTxt.includes('30+') || 
                        lTxt.includes('aging') || 
                        lTxt.includes('balance') || 
                        lTxt.includes('open invoice') || 
                        lTxt.startsWith('/ar');

      if (isARQuery) {
          console.log(`[Finance Engine] AR Lookup initiated for ${dispatchTarget}`);
          if (finance && finance.handleARLookup) {
              await finance.handleARLookup(CONFIG, dispatchTarget, dispatchOutboundWhatsApp);
          } else if (finance && finance.getAgingReport) {
              const report = await finance.getAgingReport(CONFIG, 30);
              await dispatchOutboundWhatsApp(dispatchTarget, report);
          } else {
              console.warn('[Finance Engine] AR lookup handler not exported in finance.js');
          }
          return;
      }

      // 2. Structured Invoicing & Estimates
      if (lTxt.startsWith('/estimate') || lTxt.startsWith('/invoice')) {
          if (whatsapp.triageSpokenOrTextNLP) {
              const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, []);
              if (triage) {
                  if (triage.intent === 'CREATE_ESTIMATE' && finance.handleEstimateCreation) {
                      await finance.handleEstimateCreation(CONFIG, triage, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp);
                  } else if (triage.intent === 'CREATE_INVOICE' && finance.handleInvoiceCreation) {
                      await finance.handleInvoiceCreation(CONFIG, triage, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp);
                  } else if (finance && finance.handleInvoiceApproval) {
                      await finance.handleInvoiceApproval(CONFIG, triage, dispatchTarget, dispatchOutboundWhatsApp, (c,t,m,b) => whatsapp.sendWhatsAppButtons(c,t,m,b));
                  }
              }
          }
          return;
      }
      
      // 3. Oracle RAG Engine
      if (lTxt.startsWith('/docs') || lTxt.startsWith('/specs') || lTxt.includes('spec') || lTxt.includes('engineering plan')) {
          if (whatsapp.triageSpokenOrTextNLP && oracle && oracle.handleOracleQuery) {
              const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, []);
              await oracle.handleOracleQuery(CONFIG, triage, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp);
          }
          return;
      }

      // 4. Inventory Tracking
      if (lTxt.startsWith('/inv') || lTxt === 'inv' || lTxt.includes('inventory') || lTxt.includes('stock')) {
          if (inventory && inventory.handleSpokenInventorySnapshot) {
              await inventory.handleSpokenInventorySnapshot(dispatchTarget, (t,m) => dispatchOutboundWhatsApp(t, m));
          }
          return;
      }

      // 5. Fallback Conversational Intent Routing
      if (whatsapp.triageSpokenOrTextNLP) {
          const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, []);
          console.log(`[Text Engine] General triage: ${triage?.intent || 'CONVERSATIONAL_FALLTHROUGH'}`);
      }
      
      return;
    }

    // ================================================================
    // C. MULTIMEDIA INTAKE (Sliding Window Debouncer & Batch Execution)
    // ================================================================
    if (message.type === 'video' || message.type === 'image' || message.type === 'audio' || message.type === 'voice') {
      const mediaObj = message[message.type];
      const mediaId = mediaObj.id;
      const mimeType = mediaObj.mime_type || (message.type === 'video' ? 'video/mp4' : 'image/jpeg');
      
      if (whatsapp.sendWhatsAppReaction) {
          whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, message.type === 'video' ? '🎥' : '🧾').catch(() => {});
      }

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

      if (whatsapp.mediaDebounceQueues) {
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
               if (whatsapp && whatsapp.processMediaBatch) {
                 await whatsapp.processMediaBatch(CONFIG, currentBatch, airtableWriteWithAutoDrop, oracleFileURIs);
               } else if (finance && finance.handleReceiptUpload) {
                 await finance.handleReceiptUpload(CONFIG, currentBatch, dispatchTarget, dispatchOutboundWhatsApp);
               } else {
                 console.warn('[Batch Engine] No registered batch media handler.');
               }
             } catch (batchErr) {
               console.error('[Batch Engine Failure]:', batchErr);
               await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ Error processing media submission: ${batchErr.message}`);
             }
          }, 3500);
      }
      return;
    }
    
  } catch (err) {
    console.error('[Runtime Exception in /webhook]:', err);
  }
});

// ====================================================================
// D. INBOUND EMAIL WEBHOOK 
// ====================================================================
app.post('/api/inbound-email', async (req, res) => {
  res.sendStatus(200);

  try {
    const emailPayload = {
      from: req.body.from || '',
      to: req.body.to || '',
      cc: req.body.cc || '',
      subject: req.body.subject || 'No Subject',
      text: req.body.text || req.body.body_plain || '',
      html: req.body.html || req.body.body_html || ''
    };

    if (!emailPayload.from || (!emailPayload.text && !emailPayload.html)) {
      console.warn('[Email Ingress] Ignored malformed email payload.');
      return;
    }

    console.log(`[Email Ingress] Processing email from ${emailPayload.from}: "${emailPayload.subject}"`);
    if (whatsapp && whatsapp.handleInboundEmail) {
        await whatsapp.handleInboundEmail(CONFIG, emailPayload, getCachedContacts);
    }

  } catch (err) {
    console.error('[Runtime Exception in /api/inbound-email]:', err);
  }
});

// ====================================================================
// E. ON-DEMAND HEADLESS WEBHOOK FOR ORACLE SYNC
// ====================================================================
app.post('/api/sync-oracle', async (req, res) => {
  try {
      const internalKey = req.headers['x-titan-internal-key'];
      if (process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
          return res.status(403).json({ error: 'Unauthorized: Invalid Cryptographic Signature' });
      }

      console.log('[Titan OS Oracle] Manual synchronization triggered via Airtable webhook.');
      res.status(202).json({ status: 'Accepted', message: 'Oracle Sync Protocol Initiated in background.' });

      if (oracle && oracle.syncOracleDocs) {
          oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; });
      } else {
          console.warn('[Titan OS Oracle] Sync module not found. Payload ignored.');
      }
  } catch (error) {
      console.error('[Titan OS Oracle] Manual Sync execution failed:', error);
  }
});

// Helper: Resolve Caller Identity from Relational Workers Cache
async function resolveIdentity(fromPhone) {
    const workers = await getCachedWorkers();
    const cleanDigits = fromPhone.replace(/\D/g, '');
    const worker = workers.find(w => {
      const pE164 = String(w.fields['Phone E164'] || '').replace(/\D/g, '');
      return pE164 && (pE164 === cleanDigits || cleanDigits.endsWith(pE164));
    });
    
    if (worker) {
      return { type: 'WORKER', id: worker.id, name: worker.fields['Full Name'] || 'Field Tech', role: worker.fields['Role'], workerRecord: worker, phone: fromPhone };
    }
    return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: fromPhone };
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '6.0.22' });
});

// ====================================================================
// 5. CLUSTER ORCHESTRATION & BOOTSTRAP
// ====================================================================

process.on('uncaughtException', (err) => console.error('[CRITICAL] Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('[CRITICAL] Unhandled Rejection:', reason));

if (cluster.isPrimary) {
  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V6.0.22 PRIMARY ORCHESTRATOR RUNNING`);
  console.log(`====================================================================`);
  console.log(`[Cluster Engine] Forking ${numCPUs} concurrent worker processes...`);

  startFridayNewsletterCron();
  
  if (oracle && oracle.syncOracleDocs) {
    oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; });
    setInterval(() => { oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; }); }, 24 * 60 * 60 * 1000);
  }

  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.error(`[CRITICAL] Worker ${worker.process.pid} died (${signal || code}). Orchestrator spinning up a replacement...`);
    cluster.fork();
  });
} else {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Cluster Engine] Worker ${process.pid} online and listening on PORT ${PORT}`);
    try {
      await getCachedSites();
      await getCachedWorkers();
      await getCachedContacts();
      await getCachedOpenAssignments();
      
      if (inventory && inventory.refreshInventoryCache) {
          await inventory.refreshInventoryCache(CONFIG);
      }
      
      await hydrateQBOCache();

    } catch (err) {
      console.error(`[Worker ${process.pid} Cache Hydration Error]:`, err.message);
    }
  });
}

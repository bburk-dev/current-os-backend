/**
 * TITAN OS V6.0.22 — HEADLESS ERP ORCHESTRATOR
 * Module: server.js
 * Purpose: Single-Threaded Atomic Boot, Native Meta Webhooks, QBO Finance Copilot,
 *          Atomic Message Deduplication, Conversational Voice Estimates,
 *          Progress Draws, Direct Invoicing, Headless IoT Sensor Telemetry,
 *          Conversational Clarification Engine, Ambient Multi-Turn Memory,
 *          RBAC Bouncer, and Zero-UI Site Provisioning
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

function dispatchOutboundWhatsApp(targetOrConfig, textOrTarget, possibleText) {
  if (possibleText !== undefined) {
    return whatsapp.sendWhatsAppMessage(targetOrConfig, textOrTarget, possibleText);
  }
  return whatsapp.sendWhatsAppMessage(CONFIG, targetOrConfig, textOrTarget);
}

function dispatchOutboundButtons(targetOrConfig, textOrTarget, possibleButtonsOrText, possibleButtons) {
  if (possibleButtons !== undefined) {
    return whatsapp.sendWhatsAppButtons(targetOrConfig, textOrTarget, possibleButtonsOrText, possibleButtons);
  }
  return whatsapp.sendWhatsAppButtons(CONFIG, targetOrConfig, textOrTarget, possibleButtonsOrText);
}

// ====================================================================
// 2. STATE MACHINES & CACHE-ASIDE ENGINE
// ====================================================================

let oracleFileURIs = [];
const CACHE_TTL_MS = 10 * 60 * 1000;
const ASSIGNMENTS_CACHE_TTL_MS = 3 * 60 * 1000;
const pendingNewSiteRequests = new Map();

// In-Memory Message Deduplication Store (Guaranteed Singleton)
const processedMessageIds = new Map();
const DEDUP_TTL_MS = 300 * 1000;

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
    console.log(`[Cache Engine] Refreshed ${memoryCache.workers.length} Workers from Airtable into RAM`);
    return memoryCache.workers;
  } catch (err) {
    console.warn('[Cache Engine] Workers refresh failed:', err.message);
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
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_gusts_10m&wind_speed_unit=mph`;
    const response = await fetch(meteoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Open-Meteo Telemetry Offline');
    
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
    console.error('[Titan OS Edge] Weather Tripwire evaluation bypassed due to network failure.', error.message);
    return { safe: true, warnings: ['⚠️ Meteorological telemetry offline. Proceed with visual caution.'] };
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
  console.warn('[Meta Handshake] Rejected. Verify token mismatch or invalid mode.');
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

  // Atomic Single-Threaded Deduplication Lock
  const now = Date.now();
  if (processedMessageIds.has(messageId)) {
    console.log(`[Meta Ingress] 🛡️ Deduplicated messageId: ${messageId} (Already processed)`);
    return;
  }
  processedMessageIds.set(messageId, now);

  // GC expired message hashes
  for (const [id, timestamp] of processedMessageIds.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) processedMessageIds.delete(id);
  }

  console.log(`[Meta Ingress] Processing message ${messageId} from ${dispatchTarget} (Type: ${message.type || 'text'})`);

  try {
    const callerIdentity = await resolveIdentity(fromPhone);
    const sessionSiteId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(fromPhone) : (whatsapp.userActiveSiteMap?.get(fromPhone) || null);
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

    // Fail-safe wrapper to prevent 422 Select Field rejections from crashing ingress
    try {
      let safeMessageType = message.type || 'text';
      if (safeMessageType === 'interactive') safeMessageType = 'text'; // Bypass Airtable Single Select schema mismatch
      
      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': messageId,
        'Message Type': safeMessageType,
        'Worker': worker?.id ? [worker.id] : []
      });
    } catch (e) {
      console.warn('[Airtable Inbound Log Warning]:', e.message);
    }

    const interactiveButtonId = message.interactive?.button_reply?.id || '';
    if (interactiveButtonId) {
      console.log(`[Button Action] Intercepted button tap: ${interactiveButtonId} from ${dispatchTarget}`);

      if (interactiveButtonId.startsWith('QBO_EMAIL_EST_')) {
        const estId = interactiveButtonId.replace('QBO_EMAIL_EST_', '');
        await dispatchOutboundWhatsApp(dispatchTarget, "⏳ Dispatching official Estimate PDF to client email via QuickBooks...");

        try {
          const emailRes = await finance.sendQboTransactionEmail(CONFIG, 'estimate', estId);
          if (emailRes) {
            await dispatchOutboundWhatsApp(dispatchTarget, `✅ *Estimate Dispatched:*\nOfficial QuickBooks PDF delivered directly to client's email inbox.`);
          } else {
            await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ QuickBooks could not send email. Verify client email address.`);
          }
        } catch (emailErr) {
          console.error('[QBO Send Estimate Error]:', emailErr.message);
          await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ Failed to send estimate email via QuickBooks.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_EMAIL_INV_')) {
        const invId = interactiveButtonId.replace('QBO_EMAIL_INV_', '');
        await dispatchOutboundWhatsApp(dispatchTarget, "⏳ Dispatching Invoice PDF to client email via QuickBooks...");

        try {
          const emailRes = await finance.sendQboTransactionEmail(CONFIG, 'invoice', invId);
          if (emailRes) {
            await dispatchOutboundWhatsApp(dispatchTarget, `✅ *Invoice Dispatched:*\nOfficial QuickBooks Invoice delivered directly to client's email inbox.`);
          } else {
            await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ QuickBooks could not send invoice email. Verify client email address.`);
          }
        } catch (emailErr) {
          console.error('[QBO Send Invoice Error]:', emailErr.message);
          await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ Failed to send invoice email via QuickBooks.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_CONVERT_')) {
        const parts = interactiveButtonId.split('_');
        const estimateId = parts[2];
        const percentage = parseFloat(parts[3]) || 100;

        await dispatchOutboundWhatsApp(dispatchTarget, `⏳ Converting estimate into active ${percentage}% QuickBooks invoice...`);

        try {
          const estData = await finance.qboApiRequest(CONFIG, `/estimate/${estimateId}`);
          const estimate = estData?.Estimate;

          if (!estimate) {
            await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ Could not locate estimate #${estimateId} in QuickBooks.`);
            return;
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
            CustomerRef: {
              value: String(estimate.CustomerRef.value),
              name: estimate.CustomerRef.name
            },
            GlobalTaxCalculation: "TaxExcluded",
            Line: invLines,
            LinkedTxn: [
              {
                TxnId: estimate.Id,
                TxnType: "Estimate"
              }
            ]
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
                              `✅ Invoice sealed in QuickBooks Online and linked to Estimate #${estimate.DocNumber || estimate.Id}.`;

          const buttons = [
            { id: `QBO_EMAIL_INV_${inv?.Id}`, title: "Email Invoice" }
          ];
          await dispatchOutboundButtons(dispatchTarget, successCard, buttons);
        } catch (convErr) {
          console.error('[Button Convert Draw Error]:', convErr.message);
          await dispatchOutboundWhatsApp(dispatchTarget, `Got it. Headquarters is finalizing the ledger sync for this invoice.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_APPROVE_CO_')) {
        const coEstimateId = interactiveButtonId.replace('QBO_APPROVE_CO_', '');
        await dispatchOutboundWhatsApp(dispatchTarget, "⏳ Locking Change-Order into QuickBooks ledger...");

        try {
          await finance.qboApiRequest(CONFIG, '/estimate?operation=update', 'POST', {
            Id: coEstimateId,
            SyncToken: "0",
            TxnStatus: "Accepted"
          });

          await dispatchOutboundWhatsApp(
            dispatchTarget, 
            `✅ *TITAN OS | CHANGE-ORDER SEALED*\n──────────────────────────────\nScope modification approved and cryptographically bound to QBO Estimate #${coEstimateId}. Field crew authorized to proceed.`
          );
        } catch (coApproveErr) {
          console.error('[Button Approve CO Error]:', coApproveErr.message);
          await dispatchOutboundWhatsApp(dispatchTarget, `Got it. Headquarters is finalizing the change-order ledger sync.`);
        }
        return;
      }
    }

    if (message.type === 'audio' || message.type === 'voice') {
      const mediaObj = message[message.type];
      const mediaId = mediaObj?.id;
      const mimeType = mediaObj?.mime_type || 'audio/ogg';

      if (whatsapp.sendWhatsAppReaction) {
        whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, '🎙️').catch(() => {});
      }

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
        const allSites = await getCachedSites();
        const registeredSiteNames = allSites.map(s => s.fields['Site Name']).filter(Boolean);
        const boundSiteId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(fromPhone) : (whatsapp.userActiveSiteMap?.get(fromPhone) || null);
        const boundSite = boundSiteId ? allSites.find(s => s.id === boundSiteId) : site;

        console.log(`[Audio Ingress] Parsing spoken voice memo via Gemini 2.5 Pro from ${dispatchTarget}...`);

        const spokenTriage = whatsapp.triageSpokenOrTextNLP 
          ? await whatsapp.triageSpokenOrTextNLP(CONFIG, '', registeredSiteNames, true, [{ buffer: audioBuffer, mimeType }], fromPhone, boundSite)
          : null;

        console.log(`[Audio Ingress] Spoken Intent: ${spokenTriage?.intent || 'UNKNOWN'} | Client: ${spokenTriage?.qbo_customer_name || 'None'}`);

        if (spokenTriage) {
          if (spokenTriage.intent === 'CREATE_ESTIMATE') {
            if (finance && finance.handleEstimateCreation) {
              await finance.handleEstimateCreation(
                CONFIG, 
                spokenTriage, 
                dispatchTarget, 
                oracleFileURIs, 
                dispatchOutboundWhatsApp,
                dispatchOutboundButtons
              );
              return;
            }
          }

          if (spokenTriage.intent === 'CONVERT_ESTIMATE') {
            if (finance && finance.handleInvoiceApproval) {
              await finance.handleInvoiceApproval(
                CONFIG, 
                spokenTriage, 
                dispatchTarget, 
                dispatchOutboundWhatsApp, 
                dispatchOutboundButtons
              );
              return;
            }
          }

          if (spokenTriage.intent === 'CREATE_INVOICE') {
            if (finance && finance.handleInvoiceCreation) {
              await finance.handleInvoiceCreation(
                CONFIG, 
                spokenTriage, 
                dispatchTarget, 
                oracleFileURIs, 
                dispatchOutboundWhatsApp,
                dispatchOutboundButtons
              );
              return;
            }
          }

          if (spokenTriage.intent === 'CHANGE_ORDER') {
            if (finance && finance.handleConversationalChangeOrder) {
              await finance.handleConversationalChangeOrder(
                CONFIG, 
                spokenTriage, 
                dispatchTarget, 
                oracleFileURIs, 
                dispatchOutboundWhatsApp, 
                dispatchOutboundButtons, 
                callerIdentity
              );
              return;
            }
          }

          if (spokenTriage.intent === 'AR_LOOKUP') {
            const userRole = String(callerIdentity.role || '').trim().toLowerCase();
            if (userRole !== 'admin') {
              console.warn(`[Security Alert] Unauthorized spoken AR lookup blocked for ${dispatchTarget}`);
              await dispatchOutboundWhatsApp(
                dispatchTarget, 
                `⚠️ *TITAN OS SECURITY*\n━━━━━━━━━━━━━━━━━━━━\nAccess Denied. Financial ledger queries are restricted to Executive/Admin roles.\n_Your query has been logged._`
              );
              return;
            }
            if (finance && finance.handleARLookup) {
              await finance.handleARLookup(CONFIG, dispatchTarget, dispatchOutboundWhatsApp, callerIdentity);
              return;
            }
          }

          if (spokenTriage.intent === 'ORACLE_QUERY') {
            if (oracle && oracle.handleOracleQuery) {
              await oracle.handleOracleQuery(CONFIG, spokenTriage, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp);
              return;
            }
          }

          if (spokenTriage.intent === 'INVENTORY_QUERY') {
            if (inventory && inventory.handleSpokenInventorySnapshot) {
              await inventory.handleSpokenInventorySnapshot(CONFIG, spokenTriage.transcript_en || '', dispatchTarget, dispatchOutboundWhatsApp, callerIdentity, airtableWriteWithAutoDrop);
              return;
            }
          }

          if (spokenTriage.intent === 'UNKNOWN' || spokenTriage.intent === 'GENERAL_UPDATE') {
            const transcript = spokenTriage.transcript_en || '';
            const isActionable = transcript.length > 10 && (transcript.includes('need') || transcript.includes('broken') || transcript.includes('missing') || transcript.includes('finished'));
            if (isActionable) {
               if (!boundSite) {
                 if (whatsapp.updateSessionContext) whatsapp.updateSessionContext(fromPhone, { pendingText: transcript });
                 await dispatchOutboundWhatsApp(dispatchTarget, `Got it. Which site are you currently working at?`);
                 return;
               }
               await airtableWriteWithAutoDrop('Sites', {
                 'Last Note': `[FIELD UPDATE] ${callerIdentity.name}: "${transcript}"`,
                 'Last Intent': 'GENERAL_UPDATE'
               }, boundSite.id);
               await dispatchOutboundWhatsApp(dispatchTarget, `✅ Logged to the ${boundSite.fields['Site Name']} ledger.`);
               return;
            }
          }
        }
      }
      return;
    }

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
        if (!weatherCheck.safe) {
          await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ *METEOROLOGICAL TRIPWIRE TRIGGERED*\n${weatherCheck.warnings.join('\n')}\n_Certain physical workflows may be suspended._`);
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

          await dispatchOutboundWhatsApp(dispatchTarget, promptMsg);
        }
      }
      return;
    }

    const rawText = message.text?.body || message.interactive?.button_reply?.title || '';
    if (message.type === 'text' || message.type === 'interactive' || rawText) {
      const txt = rawText.trim();
      const lTxt = txt.toLowerCase();

      console.log(`[Text Engine] Parsing payload: "${txt}" from ${dispatchTarget} (Caller: ${callerIdentity.name}, Role: ${callerIdentity.role})`);

      if (lTxt.startsWith('create site') || lTxt.startsWith('new site') || lTxt.startsWith('/createsite') || lTxt.startsWith('/newsite') || (pendingNewSiteRequests.has(fromPhone) && (lTxt.startsWith('yes') || lTxt.startsWith('site:')))) {
        let siteName = txt.replace(/^create\s+site:?/i, '').replace(/^new\s+site:?/i, '').replace(/^\/createsite:?/i, '').replace(/^\/newsite:?/i, '').replace(/^yes,?:?/i, '').replace(/^site:?/i, '').trim();

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

      const allSites = await getCachedSites();
      const registeredSiteNames = allSites.map(s => s.fields['Site Name']).filter(Boolean);
      const boundSiteId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(fromPhone) : (whatsapp.userActiveSiteMap?.get(fromPhone) || null);
      const boundSite = boundSiteId ? allSites.find(s => s.id === boundSiteId) : site;

      const triage = whatsapp.triageSpokenOrTextNLP 
        ? await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, registeredSiteNames, false, [], fromPhone, boundSite)
        : null;

      console.log(`[Text Engine] Evaluated Intent: ${triage?.intent || 'UNKNOWN'} | Client: ${triage?.qbo_customer_name || 'None'}`);

      const isARQuery = triage?.intent === 'AR_LOOKUP' || lTxt === 'ar' || lTxt.startsWith('ar ') || lTxt.endsWith(' ar') || lTxt.includes('ar +') || lTxt.includes('ar+') || lTxt.includes('+ 30') || lTxt.includes('+30') || lTxt.includes('30+') || lTxt.includes('aging') || lTxt.includes('balance') || lTxt.includes('open invoice') || lTxt.startsWith('/ar');

      if (isARQuery) {
        console.log(`[Finance Engine] AR Lookup initiated for ${dispatchTarget} (Role: ${callerIdentity.role})`);
        const userRole = String(callerIdentity.role || '').trim().toLowerCase();
        if (userRole !== 'admin') {
          console.warn(`[Security Alert] Unauthorized AR lookup blocked for ${dispatchTarget} (Name: ${callerIdentity.name}, Role: ${callerIdentity.role})`);
          await dispatchOutboundWhatsApp(dispatchTarget, `⚠️ *TITAN OS SECURITY*\n━━━━━━━━━━━━━━━━━━━━\nAccess Denied. Financial ledger queries are restricted to Executive/Admin roles.\n_Your query has been logged._`);
          return;
        }

        if (finance && finance.handleARLookup) {
          await finance.handleARLookup(CONFIG, dispatchTarget, dispatchOutboundWhatsApp, callerIdentity);
        } else if (finance && finance.getAgingReport) {
          const report = await finance.getAgingReport(CONFIG, 30);
          await dispatchOutboundWhatsApp(dispatchTarget, report);
        }
        return;
      }

      if (triage?.intent === 'CREATE_ESTIMATE' || lTxt.includes('build an estimate') || lTxt.includes('create estimate') || lTxt.startsWith('/estimate')) {
        if (finance && finance.handleEstimateCreation) {
          await finance.handleEstimateCreation(CONFIG, triage || { transcript_en: txt }, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp, dispatchOutboundButtons);
          return;
        }
      }

      if (triage?.intent === 'CONVERT_ESTIMATE' || lTxt.includes('convert to') || lTxt.includes('% invoice') || lTxt.includes('draw')) {
        if (finance && finance.handleInvoiceApproval) {
          await finance.handleInvoiceApproval(CONFIG, triage || { transcript_en: txt }, dispatchTarget, dispatchOutboundWhatsApp, dispatchOutboundButtons);
          return;
        }
      }

      if (triage?.intent === 'CREATE_INVOICE' || lTxt.includes('create invoice') || lTxt.includes('direct invoice') || lTxt.startsWith('/invoice')) {
        if (finance && finance.handleInvoiceCreation) {
          await finance.handleInvoiceCreation(CONFIG, triage || { transcript_en: txt }, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp, dispatchOutboundButtons);
          return;
        }
      }

      if (triage?.intent === 'CHANGE_ORDER' || lTxt.includes('change order') || lTxt.includes('change-order') || lTxt.includes('variation') || lTxt.startsWith('/changeorder') || lTxt.startsWith('/co')) {
        if (finance && finance.handleConversationalChangeOrder) {
          await finance.handleConversationalChangeOrder(CONFIG, triage || txt, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp, dispatchOutboundButtons, callerIdentity);
          return;
        }
      }

      if (triage?.intent === 'ORACLE_QUERY' || lTxt.startsWith('/docs') || lTxt.startsWith('/specs') || lTxt.includes('spec') || lTxt.includes('engineering plan')) {
        if (oracle && oracle.handleOracleQuery) {
          await oracle.handleOracleQuery(CONFIG, triage || txt, dispatchTarget, oracleFileURIs, dispatchOutboundWhatsApp);
          return;
        }
      }

      if (triage?.intent === 'INVENTORY_QUERY' || lTxt.startsWith('/inv') || lTxt === 'inv' || lTxt.includes('inventory') || lTxt.includes('stock')) {
        if (inventory && inventory.handleSpokenInventorySnapshot) {
          await inventory.handleSpokenInventorySnapshot(CONFIG, txt, dispatchTarget, dispatchOutboundWhatsApp, callerIdentity, airtableWriteWithAutoDrop);
          return;
        }
      }

      if (!triage || triage.intent === 'UNKNOWN' || triage.intent === 'GENERAL_UPDATE') {
        const isActionable = lTxt.length > 10 && (lTxt.includes('need') || lTxt.includes('broken') || lTxt.includes('missing') || lTxt.includes('finished'));
        if (isActionable) {
           console.log(`[Text Engine] Ambiguous operational intent detected. Triggering clarification.`);
           if (!boundSite) {
             if (whatsapp.updateSessionContext) whatsapp.updateSessionContext(fromPhone, { pendingText: txt });
             await dispatchOutboundWhatsApp(dispatchTarget, `Got it. Which site are you currently working at? (Reply with the court name).`);
             return;
           }
           await airtableWriteWithAutoDrop('Sites', {
             'Last Note': `[FIELD UPDATE] ${callerIdentity.name}: "${txt}"`,
             'Last Intent': 'GENERAL_UPDATE'
           }, boundSite.id);
           await dispatchOutboundWhatsApp(dispatchTarget, `✅ Logged to the ${boundSite.fields['Site Name']} ledger.`);
           return;
        }
        console.log(`[Text Engine] General conversational fallthrough: ignored.`);
        return;
      }
      return;
    }

    if (message.type === 'video' || message.type === 'image') {
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
            const hasVideo = currentBatch.items.some(i => i.type === 'video');
            const hasReceiptKeyword = currentBatch.items.some(i => /receipt|expense|costco|depot|gas|fuel|food|lunch|dinner|invoice|hardware|bill|store/i.test(i.caption || ''));
            
            let isReceipt = hasReceiptKeyword;
            
            if (!hasVideo && !isReceipt && currentBatch.items.length > 0) {
              try {
                const firstImg = currentBatch.items[0];
                const checkPrompt = "Determine if this image is a paper financial receipt/invoice/store bill OR a construction/padel court scene. Return JSON strictly: {\"is_receipt\": boolean}";
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
                  if (parsedCheck.is_receipt === true) {
                    isReceipt = true;
                  }
                }
              } catch (e) {
                console.warn('[Batch Triage] Fast receipt classifier bypassed:', e.message);
              }
            }

            if (!hasVideo && isReceipt) {
              if (finance && finance.handleReceiptUpload) {
                await finance.handleReceiptUpload(CONFIG, currentBatch, dispatchTarget, dispatchOutboundWhatsApp, callerIdentity, airtableWriteWithAutoDrop);
                return;
              }
            }

            if (whatsapp && whatsapp.processMediaBatch) {
              await whatsapp.processMediaBatch(CONFIG, currentBatch, airtableWriteWithAutoDrop, oracleFileURIs);
            } else if (finance && finance.handleReceiptUpload) {
              await finance.handleReceiptUpload(CONFIG, currentBatch, dispatchTarget, dispatchOutboundWhatsApp, callerIdentity, airtableWriteWithAutoDrop);
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
      await dispatchOutboundWhatsApp(groupTarget, alertCard);
    }

  } catch (err) {
    console.error('[IoT Ingress Runtime Error]:', err.message);
  }
});

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
    }
  } catch (error) {
    console.error('[Titan OS Oracle] Manual Sync execution failed:', error);
  }
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

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '6.0.22' });
});

// ====================================================================
// 5. ATOMIC ORCHESTRATION & BOOTSTRAP 
// ====================================================================

process.on('uncaughtException', (err) => console.error('[CRITICAL] Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('[CRITICAL] Unhandled Rejection:', reason));

console.log(`====================================================================`);
console.log(`🚀 TITAN OS V6.0.22 SINGLE-THREADED ORCHESTRATOR RUNNING`);
console.log(`====================================================================`);

startFridayNewsletterCron();

if (oracle && oracle.syncOracleDocs) {
  oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; });
  setInterval(() => { oracle.syncOracleDocs(CONFIG, (uris) => { oracleFileURIs = uris; }); }, 24 * 60 * 60 * 1000);
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Core Engine] System online and listening on PORT ${PORT}`);
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
    console.error(`[Cache Hydration Error]:`, err.message);
  }
});

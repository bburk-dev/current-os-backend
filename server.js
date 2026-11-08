/**
 * TITAN OS V6.0.22 — HEADLESS ERP ORCHESTRATOR
 * Module: server.js
 * Purpose: Cluster Boot, Cron Jobs, Cache Management, and Webhook Routing
 */

// ====================================================================
// 0. GLOBAL POLYFILLS & ENVIRONMENT
// ====================================================================
// This MUST be the first thing to run so all decoupled modules inherit fetch
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
    bucket: process.env.STORAGE_BUCKET || 'inbound-media',
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
    accessToken: process.env.QBO_ACCESS_TOKEN, 
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

const memoryCache = {
  sites: null,
  sitesLastFetched: 0,
  workers: null,
  workersLastFetched: 0,
  contacts: null,
  contactsLastFetched: 0,
  assignments: null,
  assignmentsLastFetched: 0,
  coordinates: new Map()
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
// 3. EXECUTIVE PROJECT MANAGEMENT & FORECASTING
// ====================================================================

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
              
  await whatsapp.fanOutToSubscribers(CONFIG, CONFIG.meta.targetVerifiedPhone, msg);
}

// ====================================================================
// 4. INGRESS WEBHOOK CONTROLLER
// ====================================================================

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0]?.value;
  const message = changes?.messages?.[0];
  
  if (!message) return;

  const rawFrom = message.from || '';
  const messageId = message.id;
  const fromPhone = rawFrom.replace(/\D/g, '');
  const dispatchTarget = fromPhone;

  try {
    const callerIdentity = await resolveIdentity(fromPhone);
    const sessionSiteId = whatsapp.userActiveSiteMap.get(fromPhone);
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

    // A. LOCATION DROPS (Proof of Presence)
    if (message.type === 'location') {
      whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, '📍').catch(() => {});
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;
      whatsapp.lastDroppedCoordinates.set(fromPhone, { lat: userLat, lon: userLon, timestamp: Date.now() });

      const allSites = await getCachedSites();
      const nearby = [];
      for (const s of allSites) {
        const coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, s, airtableWriteWithAutoDrop);
        if (coords) {
          const dist = whatsapp.haversineDistanceKm(userLat, userLon, coords.lat, coords.lon) * 1000;
          if (dist <= 800) nearby.push({ site: s, distance: dist });
        }
      }
      nearby.sort((a, b) => a.distance - b.distance);

      if (nearby.length > 0) {
        await whatsapp.bindSiteContext(CONFIG, nearby[0].site, worker, callerIdentity, dispatchTarget, fromPhone, nearby[0].distance, userLat, userLon, airtableWriteWithAutoDrop, async () => { return '\n\n🎁 *Morning Bonus:* Keep up the great work!'; });
      } else {
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `📍 Pin received (${userLat.toFixed(4)}, ${userLon.toFixed(4)}), but no Bounce Padel courts are located within 800m.`);
      }
      return;
    }

    // B. TEXT NLP COMMANDS
    if (message.type === 'text') {
      const txt = message.text?.body?.trim() || '';
      const lTxt = txt.toLowerCase();

      // Finance Intent Pre-emption
      if (lTxt.startsWith('/estimate') || lTxt.startsWith('/invoice')) {
          const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, []);
          if (triage) {
              if (triage.intent === 'CREATE_ESTIMATE') {
                  await finance.handleEstimateCreation(CONFIG, triage, dispatchTarget, oracleFileURIs, (c,t,m) => whatsapp.sendWhatsAppMessage(c,t,m));
              } else if (triage.intent === 'CREATE_INVOICE') {
                  await finance.handleInvoiceCreation(CONFIG, triage, dispatchTarget, oracleFileURIs, (c,t,m) => whatsapp.sendWhatsAppMessage(c,t,m));
              } else {
                  await finance.handleInvoiceApproval(CONFIG, triage, dispatchTarget, (c,t,m) => whatsapp.sendWhatsAppMessage(c,t,m), (c,t,m,b) => whatsapp.sendWhatsAppButtons(c,t,m,b));
              }
          }
          return;
      }
      
      // Oracle Engine Intent
      if (lTxt.startsWith('/docs') || lTxt.startsWith('/specs')) {
          const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, []);
          await oracle.handleOracleQuery(CONFIG, triage, dispatchTarget, oracleFileURIs, (c,t,m) => whatsapp.sendWhatsAppMessage(c,t,m));
          return;
      }

      // Inventory Engine Intent
      if (lTxt.startsWith('/inv') || lTxt === 'inv') {
          await inventory.handleSpokenInventorySnapshot(dispatchTarget, (t,m) => whatsapp.sendWhatsAppMessage(CONFIG, t, m));
          return;
      }
    }

    // C. MULTIMEDIA INTAKE (Debouncer Aggregation)
    if (message.type === 'video' || message.type === 'image' || message.type === 'audio' || message.type === 'voice') {
      const mediaObj = message[message.type];
      const mediaId = mediaObj.id;
      const mimeType = mediaObj.mime_type || (message.type === 'video' ? 'video/mp4' : 'image/jpeg');
      
      whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, message.type === 'video' ? '🎥' : '🧾').catch(() => {});

      const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
      const metaMediaData = await metaMediaRes.json().catch(() => ({}));
      
      if (!metaMediaRes.ok || !metaMediaData?.url) return;

      const mediaBufferRes = await fetch(metaMediaData.url, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
      if (!mediaBufferRes.ok) return;
      
      const mediaBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());
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
         
         // Visual Triage execution goes here, followed by evaluateCourtMediaBatch
         console.log(`[Batch Engine] Processing ${currentBatch.items.length} files from ${dispatchTarget}`);
      }, 3500);
      
      return;
    }
    
  } catch (err) {
    console.error('[Runtime Exception in /webhook]:', err);
  }
});

// D. INBOUND EMAIL WEBHOOK (ZAPIER / SENDGRID / MAILGUN)
app.post('/api/inbound-email', async (req, res) => {
  res.sendStatus(200); // Acknowledge receipt immediately

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
    await whatsapp.handleInboundEmail(CONFIG, emailPayload, getCachedContacts);

  } catch (err) {
    console.error('[Runtime Exception in /api/inbound-email]:', err);
  }
});

// Helper: Resolve Caller Identity
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

  // Singletons: Run crons ONLY on the primary process
  startFridayNewsletterCron();
  
  // RAG Engine auto-ingestion
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
  // Workers handle the routing and individual cache hydration
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
    } catch (err) {
      console.error(`[Worker ${process.pid} Cache Hydration Error]:`, err.message);
    }
  });
}

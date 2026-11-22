/**
- TITAN OS V6.0.42 — HEADLESS ERP ORCHESTRATOR
- Module: server.js
- Purpose: Single-Threaded Atomic Boot, Native Meta Webhooks, Credential
-          Sanitization, Rate-Limited Airtable Pacer & Linked-Record Resolver,
-          Canonical 9-Gate Named Milestones (with Passive Gate 5 Silicone &
-          Conditional Gate 6 Lights Y/N Logic), Schema-Exact Reports 2 &
-          Sites Sync (Verified Image, Client Milestone Title, Completion %,
-          Joy Cannon Update), Bilingual Forensic Pipeline (Native Worker Card
-          + English Joy Cannon & Ledger Notes), Retroactive "Be Water" Media
-          Binding Buffer, QBO Finance Copilot, Atomic Message Deduplication,
-          Voice Estimates, Full-Ledger Analytics, Court Configuration Inspector,
-          IoT Telemetry, RBAC Bouncer, Zero-UI Site Provisioning, Virtual
-          Readiness, Executive Drafting Mode + Native Gmail Dispatch, and
-          Swarm Logistics Push Dispatch (Fabrication + Pinned Agents).
 */

// ====================================================================
// 0. GLOBAL POLYFILLS & ENVIRONMENT SANITIZATION
// ====================================================================
if (typeof fetch === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    global.fetch = nodeFetch;
    global.Headers = nodeFetch.Headers;
    global.Request = nodeFetch.Request;
    global.Response = nodeFetch.Response;
  } catch (err) {
    console.error('[CRITICAL] node-fetch is missing.');
  }
}

try { require('dotenv').config(); } catch (e) {}

function cleanEnv(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  return String(val).replace(/[\r\n\t]/g, '').trim() || fallback;
}

const SANITIZED_AIRTABLE_KEY = cleanEnv(process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN);
const SANITIZED_AIRTABLE_BASE = cleanEnv(process.env.AIRTABLE_BASE_ID, 'apppNFEBAt2iQLVEP');
if (SANITIZED_AIRTABLE_KEY) {
  process.env.AIRTABLE_API_KEY = SANITIZED_AIRTABLE_KEY;
  process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN = SANITIZED_AIRTABLE_KEY;
}
if (SANITIZED_AIRTABLE_BASE) {
  process.env.AIRTABLE_BASE_ID = SANITIZED_AIRTABLE_BASE;
}

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const finance = require('./finance');
const oracle = require('./oracle');
const inventory = require('./inventory');
const whatsapp = require('./whatsapp');

let gmail = null;
try { gmail = require('./gmail'); } catch (e) { gmail = null; }

let metrics = null;
try { metrics = require('./metrics'); } catch (e) { metrics = null; }

// ====================================================================
// 1. GLOBAL CONFIGURATION & SECRETS
// ====================================================================
const PORT = process.env.PORT || 3000;

const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: cleanEnv(process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
    accessToken: cleanEnv(process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN),
    appSecret: cleanEnv(process.env.META_APP_SECRET),
    phoneNumberId: cleanEnv(process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID),
    wabaId: cleanEnv(process.env.META_WABA_ID || process.env.WHATSAPP_WABA_ID || process.env.WABA_ID),
    targetVerifiedPhone: '14379287172',
    botPhoneNumber: '12892217329',
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: cleanEnv(process.env.SUPABASE_URL),
    serviceRoleKey: cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    bucket: cleanEnv(process.env.STORAGE_BUCKET || process.env.SUPABASE_MEDIA_BUCKET, 'titan-private-media'),
    tableDarkMatter: 'dark_matter_vault'
  },
  gemini: {
    apiKey: cleanEnv(process.env.GEMINI_API_KEY),
    model: 'gemini-2.5-pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
  },
  airtable: {
    apiKey: SANITIZED_AIRTABLE_KEY,
    baseId: SANITIZED_AIRTABLE_BASE,
    endpoint: 'https://api.airtable.com/v0'
  },
  qbo: {
    companyId: cleanEnv(process.env.QBO_COMPANY_ID),
    clientId: cleanEnv(process.env.QBO_CLIENT_ID),
    clientSecret: cleanEnv(process.env.QBO_CLIENT_SECRET),
    accessToken: cleanEnv(process.env.QBO_ACCESS_TOKEN),
    refreshToken: cleanEnv(process.env.QBO_REFRESH_TOKEN) || null,
    baseUrl: 'https://quickbooks.api.intuit.com/v3/company'
  },
  google: {
    apiKey: cleanEnv(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEO_KEY)
  },
  gmail: {
    clientId: cleanEnv(process.env.GMAIL_CLIENT_ID),
    clientSecret: cleanEnv(process.env.GMAIL_CLIENT_SECRET),
    refreshToken: cleanEnv(process.env.GMAIL_REFRESH_TOKEN)
  }
};

// ====================================================================
// 1B. CANONICAL 9-GATE MILESTONE ENGINE (PASSIVE & CONDITIONAL RULES)
// ====================================================================
const GATE_CATALOG = {
  1: {
    en: 'Foundation and site readiness',
    es: 'Preparación de base y sitio',
    passive: false,
    requiresLights: false
  },
  2: {
    en: 'Steel frame up',
    es: 'Estructura de acero levantada',
    passive: false,
    requiresLights: false
  },
  3: {
    en: 'Side mesh and upper mesh up',
    es: 'Malla lateral y malla superior instaladas',
    passive: false,
    requiresLights: false
  },
  4: {
    en: 'Glass installed',
    es: 'Vidrio instalado',
    passive: false,
    requiresLights: false
  },
  5: {
    en: 'Silicone applied',
    es: 'Silicona aplicada',
    passive: true,
    requiresLights: false
  },
  6: {
    en: 'Lighting up',
    es: 'Iluminación instalada',
    passive: false,
    requiresLights: true
  },
  7: {
    en: 'Turf installed and sand is in',
    es: 'Césped instalado y arena colocada',
    passive: false,
    requiresLights: false
  },
  8: {
    en: 'Net posts and net are up',
    es: 'Postes de red y red instalados',
    passive: false,
    requiresLights: false
  },
  9: {
    en: 'Site is clean and ready for play!',
    es: '¡Sitio limpio y listo para jugar!',
    passive: false,
    requiresLights: false
  }
};

function siteHasLights(siteRecord) {
  if (!siteRecord || !siteRecord.fields) return false;
  const raw = siteRecord.fields['Lights'];
  if (raw === true) return true;
  const val = String(raw || '').trim().toLowerCase();
  return val === 'yes' || val === 'y' || val === 'true' || val === '1';
}

function getActiveGateNumbersForSite(siteRecord) {
  const hasLights = siteHasLights(siteRecord);
  return Object.entries(GATE_CATALOG)
    .filter(([, meta]) => {
      if (meta.passive) return false;
      if (meta.requiresLights && !hasLights) return false;
      return true;
    })
    .map(([num]) => parseInt(num, 10))
    .sort((a, b) => a - b);
}

function getGateName(gateNumber, lang = 'en') {
  const num = parseInt(gateNumber, 10);
  const entry = GATE_CATALOG[num];
  if (!entry) return lang === 'es' ? `Etapa ${num}` : `Milestone ${num}`;
  return lang === 'es' ? entry.es : entry.en;
}

function computeSiteGateProgress(siteRecord, highestOrClearedGates) {
  const activeGateNums = getActiveGateNumbersForSite(siteRecord);
  const totalActiveGates = activeGateNums.length; // 8 if Lights=Yes, 7 if Lights=No (Gate 5 Silicone is passive)

  let verifiedActiveCount = 0;
  let passiveSiliconeApplied = false;
  let latestMilestoneNum = 1;

  if (Array.isArray(highestOrClearedGates) && highestOrClearedGates.length > 0) {
    const nums = highestOrClearedGates
      .map(g => {
        if (typeof g === 'number') return g;
        const m = String(g).match(/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(n => n !== null && GATE_CATALOG[n]);

    if (nums.includes(5)) passiveSiliconeApplied = true;
    const activeCleared = nums.filter(n => activeGateNums.includes(n));
    verifiedActiveCount = activeCleared.length;
    if (nums.length > 0) latestMilestoneNum = Math.max(...nums);
  } else {
    const rawNum = parseInt(highestOrClearedGates, 10) || 1;
    latestMilestoneNum = rawNum;
    if (rawNum >= 5) passiveSiliconeApplied = true;
    verifiedActiveCount = activeGateNums.filter(n => n <= rawNum).length;
  }

  const ratio = totalActiveGates > 0
    ? Math.min(1, Math.max(0, verifiedActiveCount / totalActiveGates))
    : 0;
  const percentInt = Math.round(ratio * 100);
  const milestoneTitleEn = getGateName(latestMilestoneNum, 'en');
  const currentGateLabel = `${milestoneTitleEn} (${verifiedActiveCount}/${totalActiveGates} Verified)`;

  return {
    activeGateNums,
    totalActiveGates,
    verifiedActiveCount,
    passiveSiliconeApplied,
    latestMilestoneNum,
    milestoneTitleEn,
    currentGateLabel,
    ratio,
    percentInt
  };
}

function replaceGateNumbersWithNames(text, lang = 'en', siteRecord = null) {
  if (!text || typeof text !== 'string') return text;
  const verifiedWord = lang === 'es' ? 'Verificado' : 'Verified';
  const passiveWord = lang === 'es' ? 'reconocido' : 'acknowledged';
  const activeTotal = siteRecord ? getActiveGateNumbersForSite(siteRecord).length : null;

  let out = text;

  // 1. Replace "Gate 3 (3/9 Verified)" or "Gate 3 (3/9 Verificado)"
  out = out.replace(
    /\b(?:Gate|Puerta|Fase)\s*#?\s*(\d{1,2})\s*\((\d+)\s*\/\s*(\d+)\s*(?:Verified|Verificado)?\)/gi,
    (_, gNumStr, doneStr, totalStr) => {
      const gNum = parseInt(gNumStr, 10);
      const name = getGateName(gNum, lang);
      if (GATE_CATALOG[gNum]?.passive) {
        return `${name} (${passiveWord})`;
      }
      if (siteRecord) {
        const prog = computeSiteGateProgress(siteRecord, gNum);
        return `${name} (${prog.verifiedActiveCount}/${prog.totalActiveGates} ${verifiedWord})`;
      }
      const denom = activeTotal || totalStr;
      return `${name} (${doneStr}/${denom} ${verifiedWord})`;
    }
  );

  // 2. Replace plural lists like "Gates 1, 2, and 3" or "Gates 1, 2, 3"
  out = out.replace(
    /\b(?:Gates|Puertas|Fases)\s+((?:#?\d{1,2}(?:\s*,\s*|\s+(?:and|y)\s+)?)+)/gi,
    (_, listChunk) => {
      return listChunk.replace(/#?(\d{1,2})/g, (__, nStr) => {
        const n = parseInt(nStr, 10);
        const name = getGateName(n, lang);
        return GATE_CATALOG[n]?.passive ? `${name} (${passiveWord})` : name;
      });
    }
  );

  // 3. Replace standalone "Gate 3" / "Gate #3"
  out = out.replace(
    /\b(?:Gate|Puerta|Fase)\s*#?\s*(\d{1,2})\b/gi,
    (_, gNumStr) => {
      const gNum = parseInt(gNumStr, 10);
      const name = getGateName(gNum, lang);
      return GATE_CATALOG[gNum]?.passive ? `${name} (${passiveWord})` : name;
    }
  );

  return out;
}

function extractMilestoneTitleFromText(text) {
  const s = String(text || '');
  const gateNumMatch = s.match(/\b(?:Gate|Puerta|Fase)\s*#?\s*(\d{1,2})\b/i);
  if (gateNumMatch) {
    return getGateName(gateNumMatch[1], 'en');
  }
  for (const entry of Object.values(GATE_CATALOG)) {
    if (s.toLowerCase().includes(entry.en.toLowerCase())) {
      return entry.en;
    }
  }
  return null;
}

CONFIG.GATE_CATALOG = GATE_CATALOG;
CONFIG.siteHasLights = siteHasLights;
CONFIG.getActiveGateNumbersForSite = getActiveGateNumbersForSite;
CONFIG.getGateName = getGateName;
CONFIG.computeSiteGateProgress = computeSiteGateProgress;

// ====================================================================
// 2. STATE MACHINES, AIRTABLE PACER & CACHE-ASIDE ENGINE
// ====================================================================
let oracleFileURIs = [];
const CACHE_TTL_MS = 10 * 60 * 1000;
const ASSIGNMENTS_CACHE_TTL_MS = 3 * 60 * 1000;
const UNBOUND_MEDIA_TTL_MS = 10 * 60 * 1000;
const pendingNewSiteRequests = new Map();
const pendingUnboundMediaBatches = new Map();
const processedMessageIds = new Map();
const DEDUP_TTL_MS = 300 * 1000;
const draftingSessions = new Map();

const airtableSchemaCache = {
  discovered: false,
  sitesTable: 'Sites',
  sitesPrimaryField: 'Site Name',
  sitesFields: [],
  sitesFieldTypes: {},
  workersTable: 'Workers',
  contactsTable: 'Contacts',
  assignmentsTable: 'Daily Assignments',
  reportsTable: 'Reports 2',
  reportsFields: [],
  reportsFieldTypes: {}
};

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
  qbo: { accessToken: null, refreshToken: null, expiresAt: null }
};

function getActiveOracleURIs() {
  if (Array.isArray(oracleFileURIs) && oracleFileURIs.length > 0) {
    return oracleFileURIs;
  }
  if (oracle && typeof oracle.getOracleFileURIs === 'function') {
    const live = oracle.getOracleFileURIs();
    if (Array.isArray(live) && live.length > 0) {
      oracleFileURIs = live;
      return live;
    }
  }
  return [];
}

async function fetchWithExponentialBackoff(url, options = {}, retries = 2) {
  const safeUrl = String(url).split('?')[0];
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return res;
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

// Strict Airtable Rate-Limit Pacer (Max 4 requests/sec to stay safely below Airtable's 5 req/sec limit)
let airtableQueueTail = Promise.resolve();
let lastAirtableRequestTime = 0;
const AIRTABLE_MIN_SPACING_MS = 260;

function scheduleAirtableRequest(fn) {
  const run = async () => {
    const elapsed = Date.now() - lastAirtableRequestTime;
    if (elapsed < AIRTABLE_MIN_SPACING_MS) {
      await new Promise(r => setTimeout(r, AIRTABLE_MIN_SPACING_MS - elapsed));
    }
    lastAirtableRequestTime = Date.now();
    return await fn();
  };
  const next = airtableQueueTail.then(run, run);
  airtableQueueTail = next.catch(() => {});
  return next;
}

async function airtablePacedFetch(url, options = {}, retries = 3) {
  return scheduleAirtableRequest(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) return res;
        const retryAfterHeader = Number(res.headers?.get?.('retry-after') || 0);
        const backoffMs = retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : 1500 * Math.pow(2, attempt);
        console.warn(`[Airtable Pacer] HTTP ${res.status} received. Backing off ${backoffMs}ms (attempt ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, backoffMs));
        lastAirtableRequestTime = Date.now();
        continue;
      }
      return res;
    }
  });
}

async function discoverAirtableBaseSchema(force = false) {
  if (airtableSchemaCache.discovered && !force) return airtableSchemaCache;
  if (!CONFIG.airtable.apiKey || !CONFIG.airtable.baseId) return airtableSchemaCache;

  try {
    const schemaUrl = `${CONFIG.airtable.endpoint}/meta/bases/${CONFIG.airtable.baseId}/tables`;
    const res = await airtablePacedFetch(schemaUrl, {
      headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
    }, 2);

    if (!res || !res.ok) {
      console.warn(`[Airtable Schema] Meta lookup returned HTTP ${res ? res.status : 'Network Error'} (using default table names).`);
      return airtableSchemaCache;
    }

    const data = await res.json();
    const tables = data.tables || [];

    if (tables.length > 0) {
      console.log(`[Airtable Schema] Discovered ${tables.length} tables: ${tables.map(t => `${t.name} (${t.id})`).join(', ')}`);

      const sitesMeta =
        tables.find(t => t.name.trim().toLowerCase() === 'sites') ||
        tables.find(t => t.id === 'tblxtDkCjankGSI1J') ||
        tables.find(t => /\b(sites|courts)\b/i.test(t.name) && !/inbound|message|report|assign/i.test(t.name));

      if (sitesMeta) {
        airtableSchemaCache.sitesTable = sitesMeta.name;
        airtableSchemaCache.sitesFields = (sitesMeta.fields || []).map(f => f.name);
        const sTypes = {};
        (sitesMeta.fields || []).forEach(f => { sTypes[f.name] = f.type; });
        airtableSchemaCache.sitesFieldTypes = sTypes;

        const primaryFieldObj = (sitesMeta.fields || []).find(f => f.id === sitesMeta.primaryFieldId) || sitesMeta.fields?.[0];
        if (primaryFieldObj?.name) {
          airtableSchemaCache.sitesPrimaryField = primaryFieldObj.name;
        }
        console.log(`[Airtable Schema] Bound Sites -> "${sitesMeta.name}" | Primary: "${airtableSchemaCache.sitesPrimaryField}" | Columns: [${airtableSchemaCache.sitesFields.join(', ')}]`);
      }

      const workersMeta =
        tables.find(t => t.name.trim().toLowerCase() === 'workers') ||
        tables.find(t => /\bworker|staff|crew\b/i.test(t.name));
      if (workersMeta) airtableSchemaCache.workersTable = workersMeta.name;

      const contactsMeta =
        tables.find(t => t.name.trim().toLowerCase() === 'contacts') ||
        tables.find(t => /\bcontact|client|lead|partner\b/i.test(t.name));
      if (contactsMeta) airtableSchemaCache.contactsTable = contactsMeta.name;

      const assignmentsMeta =
        tables.find(t => t.name.trim().toLowerCase() === 'daily assignments') ||
        tables.find(t => /\bassignment|ticket|work order\b/i.test(t.name));
      if (assignmentsMeta) airtableSchemaCache.assignmentsTable = assignmentsMeta.name;

      const reportsMeta =
        tables.find(t => t.name.trim().toLowerCase() === 'reports 2') ||
        tables.find(t => t.id === 'tblc7FCmSZzHnBXd9') ||
        tables.find(t => /\breports?\b/i.test(t.name) && !/status/i.test(t.name));
      if (reportsMeta) {
        airtableSchemaCache.reportsTable = reportsMeta.name;
        airtableSchemaCache.reportsFields = (reportsMeta.fields || []).map(f => f.name);
        const rTypes = {};
        (reportsMeta.fields || []).forEach(f => { rTypes[f.name] = f.type; });
        airtableSchemaCache.reportsFieldTypes = rTypes;
        console.log(`[Airtable Schema] Bound Reports -> "${reportsMeta.name}" | Columns: [${airtableSchemaCache.reportsFields.join(', ')}]`);
      }

      airtableSchemaCache.discovered = true;
    }
  } catch (err) {
    console.warn('[Airtable Schema] Discovery warning:', err.message);
  }
  return airtableSchemaCache;
}

async function fetchAllAirtableRecords(tableNameOrId, filterFormula = '', sortConfig = '') {
  const records = [];
  let offset = null;
  do {
    let url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableNameOrId)}?pageSize=100&`;
    if (filterFormula) url += `filterByFormula=${encodeURIComponent(filterFormula)}&`;
    if (sortConfig) url += `${sortConfig}&`;
    if (offset) url += `offset=${encodeURIComponent(offset)}`;

    const res = await airtablePacedFetch(url, {
      headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
    }, 3);

    if (!res || !res.ok) {
      const errBody = res ? await res.text().catch(() => '') : 'Network error';
      throw new Error(`HTTP ${res ? res.status : 'NET'} on ${tableNameOrId}: ${errBody.slice(0, 140)}`);
    }

    const data = await res.json();
    if (Array.isArray(data.records)) {
      records.push(...data.records);
    }
    offset = data.offset || null;
  } while (offset);
  return records;
}

function getSiteDisplayName(siteRecord) {
  if (!siteRecord || !siteRecord.fields) return 'Unnamed Court';
  const f = siteRecord.fields;
  const primary = airtableSchemaCache.sitesPrimaryField;
  return String(
    f[primary] ||
    f['Site Name'] ||
    f['Name'] ||
    f['Court Name'] ||
    f['Project Name'] ||
    f['Site'] ||
    siteRecord.id
  ).trim();
}

async function getCachedSites(forceRefresh = false) {
  const now = Date.now();
  const hasCachedData = Array.isArray(memoryCache.sites) && memoryCache.sites.length > 0;
  const isExpired = now - memoryCache.sitesLastFetched > CACHE_TTL_MS;

  if (forceRefresh || !hasCachedData) {
    try {
      let fresh = await fetchAllAirtableRecords(airtableSchemaCache.sitesTable);
      if (fresh.length === 0 && airtableSchemaCache.sitesTable !== 'Sites') {
        fresh = await fetchAllAirtableRecords('Sites');
      }
      if (Array.isArray(fresh) && fresh.length > 0) {
        memoryCache.sites = fresh;
        memoryCache.sitesLastFetched = Date.now();
        console.log(`[Cache Engine] Refreshed ${memoryCache.sites.length} Sites from Airtable into RAM`);

        // NEW: Autonomous Geocoding Background Check
        setTimeout(async () => {
          for (const s of memoryCache.sites) {
            try { await whatsapp.resolveCoordinates(CONFIG, memoryCache, s, airtableWriteWithAutoDrop); } catch (e) {}
          }
        }, 1000);
      }
    } catch (err) {
      console.warn('[Cache Engine] Sites fetch failed (preserving existing cache):', err.message);
    }
    return memoryCache.sites || [];
  }

  if (isExpired && hasCachedData) {
    fetchAllAirtableRecords(airtableSchemaCache.sitesTable).then(freshData => {
      if (Array.isArray(freshData) && freshData.length > 0) {
        memoryCache.sites = freshData;
        memoryCache.sitesLastFetched = Date.now();
      }
    }).catch(() => {});
  }
  return memoryCache.sites || [];
}

async function getCachedWorkers(forceRefresh = false) {
  const now = Date.now();
  const hasCachedData = Array.isArray(memoryCache.workers) && memoryCache.workers.length > 0;
  const isExpired = now - memoryCache.workersLastFetched > CACHE_TTL_MS;

  if (forceRefresh || !hasCachedData) {
    try {
      const fresh = await fetchAllAirtableRecords(airtableSchemaCache.workersTable);
      if (Array.isArray(fresh) && fresh.length > 0) {
        memoryCache.workers = fresh;
        memoryCache.workersLastFetched = Date.now();
        console.log(`[Cache Engine] Refreshed ${memoryCache.workers.length} Workers from Airtable into RAM`);
      }
    } catch (err) {
      console.warn('[Cache Engine] Workers fetch failed:', err.message);
    }
    return memoryCache.workers || [];
  }

  if (isExpired && hasCachedData) {
    fetchAllAirtableRecords(airtableSchemaCache.workersTable).then(freshData => {
      if (Array.isArray(freshData) && freshData.length > 0) {
        memoryCache.workers = freshData;
        memoryCache.workersLastFetched = Date.now();
      }
    }).catch(() => {});
  }
  return memoryCache.workers || [];
}

async function getCachedContacts(forceRefresh = false) {
  const now = Date.now();
  const hasCachedData = Array.isArray(memoryCache.contacts) && memoryCache.contacts.length > 0;
  const isExpired = now - memoryCache.contactsLastFetched > CACHE_TTL_MS;

  if (!forceRefresh && hasCachedData && !isExpired) {
    return memoryCache.contacts;
  }

  try {
    const fresh = await fetchAllAirtableRecords(airtableSchemaCache.contactsTable);
    if (Array.isArray(fresh) && fresh.length > 0) {
      memoryCache.contacts = fresh;
      memoryCache.contactsLastFetched = Date.now();
      console.log(`[Cache Engine] Refreshed ${memoryCache.contacts.length} Contacts from Airtable into RAM`);
    }
    return memoryCache.contacts || [];
  } catch (err) {
    console.warn('[Cache Engine] Contacts fetch skipped:', err.message);
    return memoryCache.contacts || [];
  }
}

async function getCachedOpenAssignments(forceRefresh = false) {
  const now = Date.now();
  const hasCachedData = Array.isArray(memoryCache.assignments) && memoryCache.assignments.length > 0;
  const isExpired = now - memoryCache.assignmentsLastFetched > ASSIGNMENTS_CACHE_TTL_MS;
  const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
  const sort = `sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc`;

  if (forceRefresh || !hasCachedData) {
    try {
      const fresh = await fetchAllAirtableRecords(airtableSchemaCache.assignmentsTable, formula, sort);
      if (Array.isArray(fresh)) {
        memoryCache.assignments = fresh;
        memoryCache.assignmentsLastFetched = Date.now();
      }
    } catch (err) {
      console.warn('[Cache Engine] Open Assignments fetch failed:', err.message);
    }
    return memoryCache.assignments || [];
  }

  if (isExpired && hasCachedData) {
    fetchAllAirtableRecords(airtableSchemaCache.assignmentsTable, formula, sort).then(freshData => {
      if (Array.isArray(freshData)) {
        memoryCache.assignments = freshData;
        memoryCache.assignmentsLastFetched = Date.now();
      }
    }).catch(() => {});
  }
  return memoryCache.assignments || [];
}

async function hydrateQBOCache() {
  if (finance && typeof finance.syncQboCredentialsFromSupabase === 'function') {
    const synced = await finance.syncQboCredentialsFromSupabase(CONFIG);
    if (synced) {
      memoryCache.qbo.accessToken = CONFIG.qbo.accessToken;
      memoryCache.qbo.refreshToken = CONFIG.qbo.refreshToken;
      console.log('[Cache Engine] Hydrated QBO credentials from Supabase vault via finance module.');
      return;
    }
  }

  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return;
  try {
    const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceRoleKey);
    const { data, error } = await supabase.from('qbo_credentials').select('access_token, refresh_token, expires_at').eq('id', 'primary_tenant').single();
    if (error) throw error;
    if (data && data.access_token && !data.access_token.includes('pending_auth')) {
      const expiresAt = new Date(data.expires_at).getTime();
      const now = Date.now();
      if (now >= expiresAt - 300000 && data.refresh_token && CONFIG.qbo.clientId && CONFIG.qbo.clientSecret) {
        const basicAuth = Buffer.from(`${CONFIG.qbo.clientId}:${CONFIG.qbo.clientSecret}`).toString('base64');
        const refreshRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
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
      memoryCache.qbo.accessToken = String(data.access_token).trim();
      memoryCache.qbo.refreshToken = String(data.refresh_token).trim();
      memoryCache.qbo.expiresAt = new Date(data.expires_at).getTime();
      CONFIG.qbo.accessToken = memoryCache.qbo.accessToken;
      CONFIG.qbo.refreshToken = memoryCache.qbo.refreshToken;
    }
  } catch (err) {
    console.warn('[Cache Engine] Failed to hydrate QBO credentials:', err.message);
  }
}

async function airtableWriteWithAutoDrop(tableName, payload, recordId = null, retries = 2) {
  if (Object.keys(payload).length === 0) return { success: false, writtenFields: {}, record: null };
  let resolvedTable = tableName;
  if (tableName === 'Sites') resolvedTable = airtableSchemaCache.sitesTable;
  else if (tableName === 'Reports 2') resolvedTable = airtableSchemaCache.reportsTable;

  const url = recordId
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(resolvedTable)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(resolvedTable)}`;
  const method = recordId ? 'PATCH' : 'POST';
  let currentPayload = { fields: { ...payload } };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (Object.keys(currentPayload.fields).length === 0) return { success: false, writtenFields: {}, record: null };
      const res = await airtablePacedFetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload)
      }, 2);
      if (res && res.ok) {
        const data = await res.json();
        if (metrics && metrics.incrementMetric) metrics.incrementMetric('database_mutations');
        return { success: true, writtenFields: currentPayload.fields, record: data };
      }
      const errorData = res ? await res.json().catch(() => ({})) : {};
      const errorMsg = errorData?.error?.message || '';
      if (res && res.status === 422) {
        const match = errorMsg.match(/(?:field\s*name|field)\s*[:]?\s*["'\\]+([^"'\\]+)["'\\]+/i) || errorMsg.match(/["'\\]+([^"'\\]+)["'\\]+\s*does not exist/i);
        if (match && match[1]) {
          const badField = match[1];
          console.warn(`[Airtable Auto-Healer] Dropping invalid schema field: "${badField}" from ${tableName}`);
          delete currentPayload.fields[badField];
          continue;
        }
      }
      throw new Error(`HTTP ${res ? res.status : 'NET'}: ${errorMsg}`);
    } catch (err) {
      if (attempt === retries) return { success: false, writtenFields: {}, record: null };
    }
  }
  return { success: false, writtenFields: {}, record: null };
}

// ====================================================================
// 2B. BILINGUAL FORENSIC PAYLOAD BUILDER & LEDGER NORMALIZER
// ====================================================================

function looksNonEnglish(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/[¡¿áéíóúñüàèìòùâêîôûç]/i.test(s)) return true;
  if (/\b(el|la|los|las|está|están|pista|jaula|vidrio|luces|progreso|trabajo|instalación|completado|pendiente|con|para|del|por|sin|sobre|equipo|material|cancha|malla|césped|base)\b/i.test(s)) {
    return true;
  }
  return false;
}

async function translateTextToEnglish(text) {
  const raw = String(text || '').trim();
  if (!raw || !looksNonEnglish(raw) || !CONFIG.gemini.apiKey) return raw;

  try {
    const prompt = `Translate the following construction site status note into clear, concise, professional English for an executive client update and engineering ledger. Preserve all technical terms, numbers, and milestone references accurately. Output ONLY the translated English text with no preamble or quotes:\n\n${raw}`;
    const res = await fetchWithExponentialBackoff(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.0 }
      })
    }, 1);

    if (res && res.ok) {
      const data = await res.json();
      const translated = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (translated) return translated;
    }
  } catch (err) {
    console.warn('[Bilingual Translator] Falling back to original text:', err.message);
  }
  return raw;
}

function formatAirtableMediaValue(rawMedia, fieldType) {
  const urls = Array.isArray(rawMedia)
    ? rawMedia.map(u => String(u).trim()).filter(u => u.startsWith('http'))
    : String(rawMedia || '').split(/\s+/).map(u => u.trim()).filter(u => u.startsWith('http'));

  if (urls.length === 0) return null;
  if (fieldType === 'multipleAttachments') {
    return urls.map(u => ({ url: u }));
  }
  if (fieldType === 'url') {
    return urls[0];
  }
  return urls.join('\n');
}

function buildForensicLedgerPayloads({
  siteRecord,
  workerRecord,
  workerName,
  verifiedGates,
  workerNativeSummary,
  englishLedgerSummary,
  signedMediaUrls,
  discoveredSchema
}) {
  const progress = computeSiteGateProgress(siteRecord, verifiedGates);
  const namedEnglishSummary = replaceGateNumbersWithNames(englishLedgerSummary, 'en', siteRecord);
  const namedWorkerSummary = replaceGateNumbersWithNames(workerNativeSummary || englishLedgerSummary, 'es', siteRecord);
  const primaryVideoUrl = Array.isArray(signedMediaUrls) && signedMediaUrls.length > 0 ? signedMediaUrls[0] : '';

  const schemaObj = discoveredSchema || airtableSchemaCache;
  const sitesColumns = schemaObj.sitesFields || schemaObj?.Sites?.columns || [];
  const sitesTypes = schemaObj.sitesFieldTypes || schemaObj?.Sites?.columnTypes || {};

  const siteFields = {
    'Current Gate': progress.currentGateLabel,
    'Last Note': `[FORENSIC SWEEP] ${workerName}: ${progress.currentGateLabel}. ${namedEnglishSummary}`
  };

  if (sitesColumns.length === 0 || sitesColumns.includes('Completion %')) {
    const colType = sitesTypes['Completion %'];
    siteFields['Completion %'] = colType === 'number' ? progress.percentInt : Number(progress.ratio.toFixed(2));
  }

  if (primaryVideoUrl && (sitesColumns.length === 0 || sitesColumns.includes('Latest Video Link'))) {
    const formattedSiteMedia = formatAirtableMediaValue(signedMediaUrls, sitesTypes['Latest Video Link']);
    if (formattedSiteMedia) siteFields['Latest Video Link'] = formattedSiteMedia;
  }

  if (
    progress.verifiedActiveCount >= 1 &&
    siteRecord?.fields?.['Workflow Mode'] === 'INSTALLATION' &&
    siteRecord?.fields?.['Site Status'] === 'PLANNING'
  ) {
    siteFields['Site Status'] = 'ACTIVE';
  }

  const reportsColumns = schemaObj.reportsFields || schemaObj?.['Reports 2']?.columns || [];
  const reportsTypes = schemaObj.reportsFieldTypes || schemaObj?.['Reports 2']?.columnTypes || {};
  const reportFields = {};

  if (reportsColumns.includes('Joy Cannon Update')) {
    reportFields['Joy Cannon Update'] = namedEnglishSummary;
  }
  if (reportsColumns.includes('Worker Summary')) {
    reportFields['Worker Summary'] = namedEnglishSummary;
  }
  if (reportsColumns.includes('Active Gate')) {
    reportFields['Active Gate'] = progress.currentGateLabel;
  }
  if (reportsColumns.includes('Client Milestone Title')) {
    reportFields['Client Milestone Title'] = progress.milestoneTitleEn;
  }
  if (reportsColumns.includes('Worker')) {
    if (reportsTypes['Worker'] === 'multipleRecordLinks') {
      if (workerRecord?.id) reportFields['Worker'] = [workerRecord.id];
    } else if (workerName) {
      reportFields['Worker'] = workerName;
    }
  }
  if (reportsColumns.includes('Sites') && siteRecord?.id && reportsTypes['Sites'] === 'multipleRecordLinks') {
    reportFields['Sites'] = [siteRecord.id];
  }

  if (Array.isArray(signedMediaUrls) && signedMediaUrls.length > 0) {
    const mediaCandidates = ['Verified Image', 'Media Links', 'Video Link', 'Media URL', 'Latest Video Link'];
    const mediaCol = reportsColumns.find((col) => mediaCandidates.includes(col));
    if (mediaCol) {
      const formattedReportMedia = formatAirtableMediaValue(signedMediaUrls, reportsTypes[mediaCol]);
      if (formattedReportMedia) {
        reportFields[mediaCol] = formattedReportMedia;
      }
    }
  }

  const filledBlocks = Math.round(progress.ratio * 10);
  const progressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(10 - filledBlocks)}] ${progress.percentInt}%`;

  const joyCannonMessage = [
    `🎾 *BOUNCE PADEL | BUILD MILESTONE UPDATE*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🏟️ *Project:* ${siteRecord ? getSiteDisplayName(siteRecord) : 'Active Site'}`,
    `🏁 *Milestone:* ${progress.milestoneTitleEn}`,
    `📊 *Progress:* ${progressBar}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    namedEnglishSummary,
    primaryVideoUrl ? `\n📸 *Latest Site Capture:*\n${primaryVideoUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return {
    siteFields,
    reportFields,
    joyCannonMessage,
    workerPunchCardSummary: namedWorkerSummary
  };
}

CONFIG.buildForensicLedgerPayloads = buildForensicLedgerPayloads;

function createForensicAirtableWriter(baseWriteFn, batchContext) {
  return async function forensicAirtableWriter(tableName, payload, recordId = null, retries = 2) {
    if (!payload || typeof payload !== 'object') {
      return await baseWriteFn(tableName, payload, recordId, retries);
    }

    const enrichedPayload = { ...payload };
    const targetSite = batchContext?.site || null;

    // 1. Enhance Sites updates with Named Milestones, Lights-Aware Completion %, English Last Note, Latest Video Link, and ACTIVE status transition
    if (tableName === 'Sites' || tableName === airtableSchemaCache.sitesTable) {
      const gateStr = String(enrichedPayload['Current Gate'] || '');
      const singleGateMatch = gateStr.match(/Gate\s*(\d+)/i);
      const ratioMatch = gateStr.match(/(\d+)\s*\/\s*(\d+)/);

      if (singleGateMatch) {
        const gNum = parseInt(singleGateMatch[1], 10);
        const progress = computeSiteGateProgress(targetSite, gNum);
        const colType = airtableSchemaCache.sitesFieldTypes['Completion %'];

        enrichedPayload['Current Gate'] = progress.currentGateLabel;
        if (enrichedPayload['Completion %'] === undefined) {
          enrichedPayload['Completion %'] = colType === 'number'
            ? progress.percentInt
            : Number(progress.ratio.toFixed(2));
        }

        if (
          progress.verifiedActiveCount >= 1 &&
          targetSite?.fields?.['Workflow Mode'] === 'INSTALLATION' &&
          targetSite?.fields?.['Site Status'] === 'PLANNING' &&
          !enrichedPayload['Site Status']
        ) {
          enrichedPayload['Site Status'] = 'ACTIVE';
        }
      } else if (ratioMatch) {
        const verifiedCount = parseInt(ratioMatch[1], 10);
        const totalCount = parseInt(ratioMatch[2], 10) || 9;
        const ratio = Math.min(1, Math.max(0, verifiedCount / totalCount));
        const colType = airtableSchemaCache.sitesFieldTypes['Completion %'];

        enrichedPayload['Current Gate'] = replaceGateNumbersWithNames(gateStr, 'en', targetSite);
        if (enrichedPayload['Completion %'] === undefined) {
          enrichedPayload['Completion %'] = colType === 'number'
            ? Math.round(ratio * 100)
            : Number(ratio.toFixed(2));
        }
      } else if (gateStr) {
        enrichedPayload['Current Gate'] = replaceGateNumbersWithNames(gateStr, 'en', targetSite);
      }

      if (enrichedPayload['Latest Video Link']) {
        const formattedSiteMedia = formatAirtableMediaValue(
          enrichedPayload['Latest Video Link'],
          airtableSchemaCache.sitesFieldTypes['Latest Video Link']
        );
        if (formattedSiteMedia) {
          enrichedPayload['Latest Video Link'] = formattedSiteMedia;
        }
      }

      if (typeof enrichedPayload['Last Note'] === 'string') {
        let noteText = enrichedPayload['Last Note'];
        if (looksNonEnglish(noteText)) {
          const prefixMatch = noteText.match(/^(\[[^\]]+\]\s*[^:]+:\s*(?:Gate\s*\d+\s*\([^)]+\)\.\s*)?)(.*)$/s);
          if (prefixMatch && prefixMatch[2]) {
            const translatedBody = await translateTextToEnglish(prefixMatch[2]);
            noteText = `${prefixMatch[1]}${translatedBody}`;
          } else {
            noteText = await translateTextToEnglish(noteText);
          }
        }
        enrichedPayload['Last Note'] = replaceGateNumbersWithNames(noteText, 'en', targetSite);
      }
    }

    // 2. Dynamically map Reports 2 fields to exact Airtable schema columns (Verified Image, Client Milestone Title, Joy Cannon Update, Worker Summary, Worker)
    if (tableName === 'Reports 2' || tableName === airtableSchemaCache.reportsTable) {
      const rCols = airtableSchemaCache.reportsFields || [];
      const rTypes = airtableSchemaCache.reportsFieldTypes || {};

      const rawGate = enrichedPayload['Active Gate'] || enrichedPayload['Current Gate'] || enrichedPayload['Last Note'] || '';
      const extractedMilestoneTitle = extractMilestoneTitleFromText(rawGate);
      if (extractedMilestoneTitle && rCols.includes('Client Milestone Title') && !enrichedPayload['Client Milestone Title']) {
        enrichedPayload['Client Milestone Title'] = extractedMilestoneTitle;
      }
      if (enrichedPayload['Active Gate']) {
        enrichedPayload['Active Gate'] = replaceGateNumbersWithNames(String(enrichedPayload['Active Gate']), 'en', targetSite);
      }

      const rawNote = enrichedPayload['Last Note'] || enrichedPayload['Joy Cannon Update'] || enrichedPayload['Worker Summary'];
      if (rawNote) {
        const translatedNote = await translateTextToEnglish(rawNote);
        const namedEnglishNote = replaceGateNumbersWithNames(translatedNote, 'en', targetSite);
        delete enrichedPayload['Last Note'];
        if (rCols.includes('Joy Cannon Update')) {
          enrichedPayload['Joy Cannon Update'] = namedEnglishNote;
        }
        if (rCols.includes('Worker Summary')) {
          enrichedPayload['Worker Summary'] = namedEnglishNote;
        }
      }

      if (typeof enrichedPayload['Joy Cannon Update'] === 'string') {
        const translatedJC = await translateTextToEnglish(enrichedPayload['Joy Cannon Update']);
        enrichedPayload['Joy Cannon Update'] = replaceGateNumbersWithNames(translatedJC, 'en', targetSite);
      }
      if (typeof enrichedPayload['Worker Summary'] === 'string') {
        const translatedWS = await translateTextToEnglish(enrichedPayload['Worker Summary']);
        enrichedPayload['Worker Summary'] = replaceGateNumbersWithNames(translatedWS, 'en', targetSite);
      }

      const rawMedia = enrichedPayload['Media Links'] || enrichedPayload['Verified Image'] || enrichedPayload['Video Link'];
      if (rawMedia) {
        delete enrichedPayload['Media Links'];
        const mediaCol = rCols.find(c => ['Verified Image', 'Media Links', 'Video Link', 'Media URL', 'Latest Video Link'].includes(c));
        if (mediaCol) {
          const formattedReportMedia = formatAirtableMediaValue(rawMedia, rTypes[mediaCol]);
          if (formattedReportMedia) {
            enrichedPayload[mediaCol] = formattedReportMedia;
          }
        }
      }

      if (enrichedPayload['Worker'] !== undefined) {
        const val = enrichedPayload['Worker'];
        if (rTypes['Worker'] === 'multipleRecordLinks') {
          if (Array.isArray(val) && val[0]?.startsWith?.('rec')) {
            enrichedPayload['Worker'] = val;
          } else if (batchContext?.worker?.id) {
            enrichedPayload['Worker'] = [batchContext.worker.id];
          } else {
            delete enrichedPayload['Worker'];
          }
        } else {
          enrichedPayload['Worker'] = Array.isArray(val)
            ? (batchContext?.callerIdentity?.name || val.join(', '))
            : String(val);
        }
      }
    }

    return await baseWriteFn(tableName, enrichedPayload, recordId, retries);
  };
}

// Wrap outbound WhatsApp messages so:
// 1. Joy Cannon broadcasts are always English, show named milestones, include a Milestone header,
//    and compute progress against the site's Lights Y/N active gate count (excluding passive Gate 5).
// 2. Installer punch cards replace raw "Gate N" labels with named milestones in the installer's
//    native language (Spanish for Yeikol, English for English techs) and omit Lighting up if Lights=No.
if (whatsapp && typeof whatsapp.sendWhatsAppMessage === 'function' && !whatsapp.__milestoneNamingWrapped) {
  const originalSendWhatsAppMessage = whatsapp.sendWhatsAppMessage.bind(whatsapp);
  whatsapp.sendWhatsAppMessage = async function wrappedSendWhatsAppMessage(cfg, target, messageText, ...rest) {
    try {
      if (typeof messageText === 'string') {
        const cleanTarget = String(target || '').replace(/\D/g, '');
        const recipientWorker = Array.isArray(memoryCache.workers)
          ? memoryCache.workers.find(w => {
              const rawNum = String(w.fields['WhatsApp Number'] || w.fields['Phone E164'] || w.fields['Phone'] || w.fields['Mobile'] || '').replace(/\D/g, '');
              return rawNum && (rawNum === cleanTarget || cleanTarget.endsWith(rawNum) || rawNum.endsWith(cleanTarget));
            })
          : null;
        const recipientLang = String(recipientWorker?.fields?.['Language'] || 'English').toLowerCase().startsWith('span') ? 'es' : 'en';

        if (messageText.includes('BUILD MILESTONE UPDATE')) {
          const projectMatch = messageText.match(/Project:\*?\s*([^\n]+)/i);
          const projectName = projectMatch ? projectMatch[1].trim() : '';
          const matchedSite = (projectName && Array.isArray(memoryCache.sites))
            ? memoryCache.sites.find(s => getSiteDisplayName(s).toLowerCase() === projectName.toLowerCase())
            : null;

          const gateMatch = messageText.match(/\b(?:Gate|Puerta|Fase)\s*#?\s*(\d{1,2})\b/i);
          const milestoneTitle = gateMatch
            ? getGateName(parseInt(gateMatch[1], 10), 'en')
            : extractMilestoneTitleFromText(messageText);

          const lines = messageText.split('\n');
          const captureIdx = lines.findIndex(l => l.includes('Latest Site Capture'));
          const dividerIndices = lines.reduce((acc, l, idx) => (l.startsWith('━━') || l.startsWith('──') ? [...acc, idx] : acc), []);
          const bodyStart = dividerIndices.length >= 2 ? dividerIndices[1] + 1 : 4;
          const bodyEnd = captureIdx > bodyStart ? captureIdx : lines.length;

          const headerLines = lines.slice(0, bodyStart).map(line => {
            if (gateMatch && matchedSite && line.includes('Progress:')) {
              const prog = computeSiteGateProgress(matchedSite, parseInt(gateMatch[1], 10));
              const filled = Math.round(prog.ratio * 10);
              const bar = `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${prog.percentInt}%`;
              return `📊 *Progress:* ${bar}`;
            }
            return replaceGateNumbersWithNames(line, 'en', matchedSite);
          });

          if (milestoneTitle && !headerLines.some(l => l.includes('Milestone:'))) {
            const projIdx = headerLines.findIndex(l => l.includes('Project:'));
            const insertAt = projIdx >= 0 ? projIdx + 1 : 2;
            headerLines.splice(insertAt, 0, `🏁 *Milestone:* ${milestoneTitle}`);
          }

          const narrativeLines = lines.slice(bodyStart, bodyEnd).filter(l => l.trim().length > 0);
          let processedNarrative = '';
          if (narrativeLines.length > 0) {
            const englishNarrative = await translateTextToEnglish(narrativeLines.join('\n'));
            processedNarrative = replaceGateNumbersWithNames(englishNarrative, 'en', matchedSite);
          }

          const rebuiltLines = [
            ...headerLines,
            ...(processedNarrative ? [processedNarrative] : []),
            ...(captureIdx >= 0 ? ['', ...lines.slice(captureIdx)] : [])
          ];
          messageText = rebuiltLines.join('\n');
        } else if (/\b(?:Gate|Puerta|Fase)\s*#?\s*\d{1,2}\b/i.test(messageText)) {
          const boundId = whatsapp.getUserBoundSiteId ? whatsapp.getUserBoundSiteId(cleanTarget) : null;
          const boundSite = (boundId && Array.isArray(memoryCache.sites))
            ? memoryCache.sites.find(s => s.id === boundId)
            : null;
          messageText = replaceGateNumbersWithNames(messageText, recipientLang, boundSite);
        }
      }
    } catch (e) {
      console.warn('[Milestone Formatter] Fallback to original message:', e.message);
    }
    return await originalSendWhatsAppMessage(cfg, target, messageText, ...rest);
  };
  whatsapp.__milestoneNamingWrapped = true;
}

async function runForensicMediaBatch(batchObj) {
  const forensicWriter = createForensicAirtableWriter(airtableWriteWithAutoDrop, batchObj);
  await whatsapp.processMediaBatch(CONFIG, batchObj, forensicWriter, getActiveOracleURIs());
  await getCachedSites(true);
}

async function replayPendingUnboundMediaBatch(speakerPhone, boundSite, dispatchTarget) {
  const pending = pendingUnboundMediaBatches.get(speakerPhone);
  if (!pending) return;

  pendingUnboundMediaBatches.delete(speakerPhone);
  if (Date.now() - pending.timestamp > UNBOUND_MEDIA_TTL_MS) return;

  const siteName = getSiteDisplayName(boundSite);
  console.log(`[Be Water Recovery] Replaying ${pending.batch.items.length} buffered media file(s) from ${speakerPhone} against bound site "${siteName}"...`);

  try {
    await whatsapp.sendWhatsAppMessage(
      CONFIG,
      dispatchTarget,
      `🔄 *Be Water Auto-Recovery:* Applying your recent site video/photo upload (${pending.batch.items.length} file(s)) to *${siteName}* now...`
    );
    const hydratedBatch = {
      ...pending.batch,
      site: boundSite
    };
    await runForensicMediaBatch(hydratedBatch);
  } catch (err) {
    console.error('[Be Water Recovery Error]:', err.message);
  }
}

// ====================================================================
// 3. LINKED RECORD ENRICHMENT, SMART SITE RESOLVER & FULL-LEDGER ANALYST
// ====================================================================

function buildRecordLookupMaps(sites = [], workers = [], contacts = []) {
  const sitesById = new Map();
  sites.forEach(s => sitesById.set(s.id, getSiteDisplayName(s)));

  const workersById = new Map();
  workers.forEach(w => {
    const f = w.fields || {};
    workersById.set(w.id, String(f['Full Name'] || f['Worker Name'] || f['Name'] || w.id).trim());
  });

  const contactsById = new Map();
  contacts.forEach(c => {
    const f = c.fields || {};
    const label = String(f['Full Name'] || f['Contact Name'] || f['Name'] || f['Company'] || f['Email'] || c.id).trim();
    contactsById.set(c.id, label);
  });

  return { sitesById, workersById, contactsById };
}

function enrichRecordFields(record, lookupMaps) {
  const f = record?.fields || {};
  const excludedKeys = new Set([
    'WhatsApp Group ID',
    'Client Whatsapp Group ID',
    'Client WhatsApp Group ID',
    'Subscribed Phones',
    'Summary (Subscribed Phones)',
    'Headline (Subscribed Phones)',
    'Map Cache'
  ]);
  const enriched = { record_id: record.id };

  for (const [key, val] of Object.entries(f)) {
    if (excludedKeys.has(key) || val === null || val === undefined || val === '') continue;

    if (Array.isArray(val)) {
      const resolvedArr = val.map(item => {
        if (typeof item === 'string' && item.startsWith('rec')) {
          return lookupMaps?.contactsById?.get(item) ||
                 lookupMaps?.workersById?.get(item) ||
                 lookupMaps?.sitesById?.get(item) ||
                 item;
        }
        return item;
      });
      enriched[key] = resolvedArr;
    } else if (typeof val === 'string' && val.startsWith('rec')) {
      enriched[key] = lookupMaps?.contactsById?.get(val) ||
                      lookupMaps?.workersById?.get(val) ||
                      lookupMaps?.sitesById?.get(val) ||
                      val;
    } else {
      enriched[key] = val;
    }
  }
  return enriched;
}

function levenshteinDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const dp = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i++) dp[i][0] = i;
  for (let j = 0; j <= t.length; j++) dp[0][j] = j;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[s.length][t.length];
}

function normalizePhoneticToken(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^w/, 'v')
    .replace(/ei|ie|ey|y/g, 'i')
    .replace(/ck/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/([a-z])\1+/g, '$1');
}

function findMatchingSite(allSites, queryText, fallbackBoundSite = null, lookupMaps = null) {
  if (!Array.isArray(allSites) || allSites.length === 0) return fallbackBoundSite || null;

  const rawQuery = String(queryText || '').trim();
  if (!rawQuery) return fallbackBoundSite || null;

  const qClean = rawQuery
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = new Set([
    'what', 'which', 'where', 'when', 'who', 'how', 'does', 'do', 'did', 'is', 'are', 'was', 'were',
    'can', 'could', 'would', 'should', 'have', 'has', 'had', 'the', 'a', 'an', 'for', 'to', 'of',
    'in', 'on', 'at', 'with', 'about', 'me', 'my', 'i', 'get', 'give', 'show', 'tell', 'please',
    'court', 'courts', 'site', 'sites', 'details', 'detail', 'config', 'configuration', 'specs',
    'specifications', 'directions', 'direction', 'location', 'map', 'lights', 'light', 'turf',
    'steel', 'color', 'colour', 'supplier', 'manufacturer', 'status', 'gate', 'address', 'info'
  ]);

  const queryTokens = qClean
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w));

  let bestSite = null;
  let bestScore = 0;

  for (const site of allSites) {
    const enriched = enrichRecordFields(site, lookupMaps);
    const primaryDisplayName = getSiteDisplayName(site).toLowerCase();

    const searchableChunks = [];
    for (const [k, v] of Object.entries(enriched)) {
      if (k === 'record_id') continue;
      if (typeof v === 'string' && !v.startsWith('http') && !v.startsWith('rec')) {
        searchableChunks.push(v);
      } else if (Array.isArray(v)) {
        v.forEach(item => {
          if (typeof item === 'string' && !item.startsWith('http') && !item.startsWith('rec')) {
            searchableChunks.push(item);
          }
        });
      }
    }

    const fullBlobLower = searchableChunks.join(' ').toLowerCase();
    let score = 0;

    if (primaryDisplayName && primaryDisplayName === qClean) score += 130;
    else if (primaryDisplayName && primaryDisplayName.length >= 3 && (qClean.includes(primaryDisplayName) || primaryDisplayName.includes(qClean))) score += 95;

    for (const chunk of searchableChunks) {
      const cLower = chunk.toLowerCase().trim();
      if (cLower.length >= 4 && (qClean.includes(cLower) || cLower.includes(qClean))) {
        score += 80;
        break;
      }
    }

    const siteWords = fullBlobLower
      .replace(/['’]s\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    for (const qTok of queryTokens) {
      if (qTok.length < 3 && !/^\d+$/.test(qTok)) continue;

      if (siteWords.includes(qTok)) {
        score += 50;
        continue;
      }

      if (qTok.length >= 4 && siteWords.some(sw => sw.includes(qTok) || qTok.includes(sw))) {
        score += 35;
        continue;
      }

      if (qTok.length >= 4) {
        const qPhon = normalizePhoneticToken(qTok);
        for (const sw of siteWords) {
          if (sw.length < 4) continue;
          const swPhon = normalizePhoneticToken(sw);
          if (qPhon === swPhon) {
            score += 42;
            break;
          }
          const dist = levenshteinDistance(qTok, sw);
          if (dist === 1 || (qTok.length >= 6 && dist <= 2)) {
            score += 30;
            break;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSite = site;
    }
  }

  if (bestScore >= 30) {
    return bestSite;
  }

  return fallbackBoundSite || null;
}

async function handleCourtSpecsQuery(config, rawQuestion, siteHint, boundSite, dispatchTarget) {
  let [allSites, workers, contacts] = await Promise.all([
    getCachedSites(),
    getCachedWorkers(),
    getCachedContacts()
  ]);

  if (!allSites || allSites.length === 0) {
    allSites = await getCachedSites(true);
  }

  if (!allSites || allSites.length === 0) {
    return await whatsapp.sendWhatsAppMessage(
      config,
      dispatchTarget,
      `⚠️ Airtable connection returned 0 sites (check \`AIRTABLE_API_KEY\` authorization in Render).`
    );
  }

  const lookupMaps = buildRecordLookupMaps(allSites, workers, contacts);
  const targetSite = findMatchingSite(allSites, siteHint || rawQuestion, boundSite, lookupMaps);

  if (!targetSite) {
    return await whatsapp.sendWhatsAppMessage(
      config,
      dispatchTarget,
      `⚠️ I couldn't match "${siteHint || rawQuestion}" across the ${allSites.length} records in the Airtable ledger. Try specifying the court name or street address.`
    );
  }

  const enrichedRecord = enrichRecordFields(targetSite, lookupMaps);
  const siteName = getSiteDisplayName(targetSite);

  const prompt = `You are Titan OS, the head court operations assistant for Bounce Padel.
The user asked: "${rawQuestion}"

Here is the complete Airtable record for "${siteName}" (with linked Contacts/Workers resolved):
${JSON.stringify(enrichedRecord, null, 2)}

Instructions:
1. Answer the user's question directly and accurately using ONLY the record above.
2. If the user asks for general court configuration or court details, present a crisp WhatsApp summary covering:
  - Site Name, Client Name / Partner, & Site Location
  - Model Type, Manufacturer, & Court Classification
  - Steel Color, Turf Color, & Turf Supplier
  - Foundation Type & Lights (from the "Lights" field)
  - Current Milestone (from "Current Gate"), Completion %, Site Status, Workflow Mode, Year Installed, & Deposit Status (if populated)
3. If a specific field requested (such as Lights, Turf Supplier, or Steel Color) is not populated in the record, clearly state that it is not documented in the Airtable ledger yet.
4. Keep formatting concise, scannable, and WhatsApp-friendly (use *bold* bullets, no tables).`;

  try {
    const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.0 }
      })
    }, 2);

    if (res && res.ok) {
      const data = await res.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (answer) {
        return await whatsapp.sendWhatsAppMessage(
          config,
          dispatchTarget,
          `🏟️ *TITAN OS | ${siteName.toUpperCase()}*\n──────────────────────────────\n${replaceGateNumbersWithNames(answer, 'en', targetSite)}`
        );
      }
    }
  } catch (err) {
    console.warn('[Court Specs Query] Gemini fallback triggered:', err.message);
  }

  const f = enrichedRecord;
  const fallbackCard =
    `🏟️ *TITAN OS | ${siteName.toUpperCase()}*\n` +
    `──────────────────────────────\n` +
    `• *Client / Venue:* ${f['Client Name'] || f['Parent Venue / Complex'] || 'Not specified'}\n` +
    `• *Site Location:* ${f['Site Location'] || 'Not specified'}\n` +
    `• *Status / Milestone:* ${f['Site Status'] || 'Active'} (${replaceGateNumbersWithNames(f['Current Gate'] || 'Unset', 'en', targetSite)})\n` +
    `• *Manufacturer / Model:* ${f['Manufacturer'] || 'Unspecified'} — ${f['Model Type'] || 'Standard'}\n` +
    `• *Steel Color:* ${f['Steel Color'] || 'Unspecified'}\n` +
    `• *Turf:* ${f['Turf Color'] || 'Unspecified'} (${f['Turf Supplier'] || 'Unspecified'})\n` +
    `• *Lights / Foundation:* Lights: ${f['Lights'] || 'Unspecified'} | Foundation: ${f['Foundation Type'] || 'Unspecified'}\n` +
    `• *Deposit / Year:* ${f['Deposit Status'] || 'Unspecified'} | Year: ${f['Year Installed'] || 'Unspecified'}`;

  return await whatsapp.sendWhatsAppMessage(config, dispatchTarget, fallbackCard);
}

async function executeLedgerQuery(config, queryText, dispatchTarget) {
  await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⏳ Querying Airtable ledgers...`);
  try {
    let [sites, workers, contacts, openAssignments] = await Promise.all([
      getCachedSites(),
      getCachedWorkers(),
      getCachedContacts(),
      getCachedOpenAssignments()
    ]);

    if (!sites || sites.length === 0) {
      sites = await getCachedSites(true);
    }

    if (!sites || sites.length === 0) {
      return await whatsapp.sendWhatsAppMessage(
        config,
        dispatchTarget,
        `⚠️ Airtable connection returned 0 sites (check \`AIRTABLE_API_KEY\` authorization in Render).`
      );
    }

    console.log(`[Ledger Query] Analyzing ${sites.length} Sites, ${openAssignments.length} Open Assignments, ${workers.length} Workers, ${contacts.length} Contacts`);

    const lookupMaps = buildRecordLookupMaps(sites, workers, contacts);
    const fullSites = sites.map(s => enrichRecordFields(s, lookupMaps));
    const fullAssignments = openAssignments.map(a => {
      const enriched = enrichRecordFields(a, lookupMaps);
      if (typeof enriched['Notes'] === 'string' && enriched['Notes'].length > 300) {
        enriched['Notes'] = enriched['Notes'].slice(0, 300);
      }
      return enriched;
    });
    const fullWorkers = workers.map(w => enrichRecordFields(w, lookupMaps));
    const fullContacts = contacts.slice(0, 150).map(c => enrichRecordFields(c, lookupMaps));

    const systemPrompt = `You are Titan OS, the enterprise data analyst for Bounce Padel.
Current Date: ${new Date().toISOString().split('T')[0]}
The user asked: "${queryText}"

Calculate the exact answer strictly from the live Airtable JSON tables provided below.
Rules:
1. Count and list matching records accurately (inspect all fields on every record, including 'Deposit Status', 'Year Installed', 'Total Courts', 'Site Status', 'Workflow Mode', 'Slab Pour Date', 'Install Started', 'Install Completed', 'Current Gate', 'Manufacturer', 'Model Type', 'Steel Color', 'Turf Color', 'Turf Supplier', 'Lights', 'Site Location', 'Client Name', 'Partner', 'Parent Venue / Complex', and any date/year strings).
2. If 'Total Courts' is specified on a site record, report both the site record count and the sum of courts.
3. Never hallucinate numbers or records. If a specific year (like 2027 or 2024) does not appear on any record, list what deposit statuses or installation years ARE currently documented in the ledger so the user has full clarity.
4. Format concisely for WhatsApp with *bold* highlights and bullet points.

AIRTABLE SITES (${fullSites.length} records):
${JSON.stringify(fullSites)}

OPEN DAILY ASSIGNMENTS / TICKETS (${fullAssignments.length} records):
${JSON.stringify(fullAssignments)}

WORKERS (${fullWorkers.length} records):
${JSON.stringify(fullWorkers)}

CONTACTS (${fullContacts.length} records):
${JSON.stringify(fullContacts)}`;

    const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.0 }
      })
    }, 2);

    if (res && res.ok) {
      const data = await res.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) {
        return await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `📊 *TITAN OS | LEDGER ANALYTICS*\n──────────────────────────────\n${replaceGateNumbersWithNames(answer.trim(), 'en')}`);
      }
    }
    throw new Error('Gemini returned an empty query result.');
  } catch (err) {
    console.error('[Ledger Query Error]', err.message);
    await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⚠️ Failed to execute ledger query: ${err.message}`);
  }
}

async function fetchDadJoke() {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://icanhazdadjoke.com/', { headers: { 'Accept': 'application/json' }, signal: controller.signal });
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
    if (current.wind_gusts_10m > 25) issues.push(`🔴 HIGH WIND HOLD: Gusts at ${current.wind_gusts_10m} mph. Suction cup glass installation suspended.`);
    if (current.temperature_2m < 10) issues.push(`🔴 LOW TEMP HOLD: Ambient temperature is ${current.temperature_2m}°C. Polyurethane turf glue curing suspended.`);
    const dewPointDelta = current.temperature_2m - current.dew_point_2m;
    if (dewPointDelta < 3.0 && current.relative_humidity_2m > 85) issues.push(`🔴 CONDENSATION HOLD: Dew point delta is ${dewPointDelta.toFixed(1)}°C (Humidity: ${current.relative_humidity_2m}%). Substrate moisture will ruin turf adhesive bond.`);
    if (current.precipitation > 0 || (current.weather_code >= 51 && current.weather_code <= 99)) issues.push(`🌧️ RAIN HOLD: Active precipitation detected. Silica sand infill and adhesive operations suspended.`);
    return { safe: issues.length === 0, telemetry: current, warnings: issues };
  } catch (error) {
    clearTimeout(timeoutId);
    return { safe: true, warnings: ['⚠️ Meteorological telemetry offline. Proceed with visual caution.'] };
  }
}

async function evaluateVirtualSiteReadiness(config, siteNameStr, dispatchTarget) {
  await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⏳ Computing virtual readiness matrix for ${siteNameStr}...`);
  if (metrics && metrics.incrementMetric) metrics.incrementMetric('readiness_checks');

  let [allSites, workers, contacts] = await Promise.all([
    getCachedSites(),
    getCachedWorkers(),
    getCachedContacts()
  ]);
  if (!allSites || allSites.length === 0) {
    allSites = await getCachedSites(true);
  }
  const lookupMaps = buildRecordLookupMaps(allSites, workers, contacts);
  const site = findMatchingSite(allSites, siteNameStr, null, lookupMaps);

  if (!site) return await whatsapp.sendWhatsAppMessage(config, dispatchTarget, `⚠️ Could not locate site matching "${siteNameStr}".`);

  const siteId = site.id;
  const siteName = getSiteDisplayName(site);

  let coords = null;
  try {
    coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, site, airtableWriteWithAutoDrop);
  } catch (e) {}

  const openAssignments = await getCachedOpenAssignments();
  const siteAssignments = openAssignments.filter(a => {
    const sIds = a.fields['Sites'] || a.fields['Site'] || [];
    return Array.isArray(sIds) && sIds.includes(siteId);
  });
  const hasCrew = siteAssignments.some(a => a.fields['Worker'] && a.fields['Worker'].length > 0) ||
                  Boolean(site.fields['Assigned Crew']) ||
                  Boolean(site.fields['Assigned Workers']?.length);
  const crewStatus = hasCrew ? `✅ Crew Assigned` : `❌ No Crew Assigned`;
  let confidenceScore = 100;

  let weatherStatus = `❓ Unknown Weather`;
  if (coords && coords.lat && coords.lon) {
    const weather = await evaluateWeatherTripwires(coords.lat, coords.lon);
    weatherStatus = weather.safe ? `✅ Weather Clear` : `❌ Active Weather Holds`;
    if (!weather.safe) confidenceScore -= 20;
  } else {
    confidenceScore -= 10;
  }

  let financeStatus = `❓ Deposit Pending`;
  try {
    const depositField = String(site.fields['Deposit Status'] || '');
    if (/50%|40%|paid/i.test(depositField)) {
      financeStatus = `✅ ${depositField}`;
    } else {
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
    }
  } catch (e) { confidenceScore -= 10; }

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

// ====================================================================
// 3B. EXECUTIVE DRAFTING MODE & NATIVE GMAIL OAUTH2 DISPATCH
// ====================================================================

async function sendGmailViaOAuth(config, toEmail, subject, bodyText) {
  if (gmail && typeof gmail.sendOutboundEmail === 'function') {
    return await gmail.sendOutboundEmail(config, toEmail, subject, bodyText);
  }

  const clientId = config?.gmail?.clientId || process.env.GMAIL_CLIENT_ID;
  const clientSecret = config?.gmail?.clientSecret || process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = config?.gmail?.refreshToken || process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken || !toEmail) {
    console.warn('[Gmail Dispatch] Missing Gmail OAuth2 credentials or target recipient.');
    return false;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenRes.ok) {
      console.error('[Gmail Dispatch] OAuth token exchange failed:', await tokenRes.text());
      return false;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return false;

    const cleanSubject = String(subject || 'Re: Bounce Padel Commercial Inquiry').replace(/[\r\n]+/g, ' ').trim();
    const utf8Subject = `=?utf-8?B?${Buffer.from(cleanSubject).toString('base64')}?=`;

    const mimeLines = [
      `To: ${toEmail}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      bodyText
    ];

    const rawEncoded = Buffer.from(mimeLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawEncoded })
    });

    if (!sendRes.ok) {
      console.error('[Gmail Dispatch] Gmail API send rejected:', await sendRes.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Gmail Dispatch] Exception:', err.message);
    return false;
  }
}

async function executeDraftingMode(config, rawText, audioBuffer, mimeType, existingSession, speakerPhone, dispatchTarget) {
  await whatsapp.sendWhatsAppMessage(config, dispatchTarget, "⏳ Structuring professional executive response...");

  const draftContext = existingSession?.context || '';
  const prompt = `You are a professional executive assistant for Bob Burk, Founder of Bounce Padel.
The user has provided a raw dictation (via voice or text) intended to reply to a specific message or email.
Your task is to transcribe and meticulously clean it up into a highly professional, decisive reply.
- Remove all filler words.
- Fix grammar and conversational flow.
- Sign off warmly as "Best regards,\nBob Burk" if it is an email reply.
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
    const res = await fetchWithExponentialBackoff(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2 }
      })
    }, 2);

    if (!res || !res.ok) throw new Error(`Gemini Draft failed: ${res ? res.status : 'Network timeout'}`);
    const data = await res.json();
    const draftedText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    const updatedSession = {
      ...(existingSession || {}),
      active: false,
      draftedBody: draftedText
    };
    draftingSessions.set(speakerPhone, updatedSession);

    const finalMsg = `✅ *Drafted Response:*\n──────────────────────────────\n${draftedText}\n──────────────────────────────\n_Ready to review or forward._`;

    if (updatedSession.targetEmail) {
      const buttons = [{ id: `SEND_DRAFTED_EMAIL`, title: 'Dispatch via Email' }];
      await whatsapp.sendWhatsAppButtons(config, dispatchTarget, finalMsg, buttons);
    } else {
      await whatsapp.sendWhatsAppMessage(config, dispatchTarget, finalMsg);
    }
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

          const aiRes = await fetchWithExponentialBackoff(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: radarPrompt }] }],
              generationConfig: { temperature: 0.2 }
            })
          }, 2);

          if (aiRes && aiRes.ok) {
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

  try {
    const body = req.body;
    if (!body) return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    if (changes?.statuses) return;

    const message = changes?.messages?.[0];
    if (!message) return;

    const rawFrom = message.from || '';
    const rawParticipant = message.participant || '';
    const messageId = message.id || `msg_${Date.now()}`;

    const dispatchTarget = String(rawFrom).replace(/\D/g, '');
    const speakerPhone = rawParticipant
      ? String(rawParticipant).replace(/\D/g, '')
      : dispatchTarget;
    const isGroupMessage = Boolean(rawParticipant) || dispatchTarget.length > 13;

    const displayBotPhone = String(changes?.metadata?.display_phone_number || CONFIG.meta.botPhoneNumber || '').replace(/\D/g, '');
    if (displayBotPhone && speakerPhone === displayBotPhone) {
      console.log(`[Meta Ingress] 🛡️ Ignored self-authored message from ${speakerPhone}`);
      return;
    }

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

    console.log(`[Meta Ingress] Processing message ${messageId} | Thread: ${dispatchTarget} | Speaker: ${speakerPhone} | Group: ${isGroupMessage} | Type: ${message.type || 'text'}`);

    const callerIdentity = await resolveIdentity(speakerPhone);
    const userRoles = callerIdentity.roles.map(r => String(r).toLowerCase());
    console.log(`[Bouncer] Resolved Speaker ${speakerPhone}: ${callerIdentity.type} (${callerIdentity.name}) | Lang: ${callerIdentity.language} | Roles: [${userRoles.join(', ')}]`);

    // MASTER ADMIN OVERRIDE: Bob Burk is never denied access
    const isMasterAdmin = speakerPhone === CONFIG.meta.targetVerifiedPhone || speakerPhone === '14379287172';
    const hasFinanceAccess = userRoles.some(r => r.includes('admin') || r.includes('finance') || r.includes('executive')) || isMasterAdmin;
    const hasInventoryAccess = userRoles.some(r => r.includes('admin') || r.includes('fabrication') || r.includes('warehouse') || r.includes('supervisor') || r.includes('executive')) || isMasterAdmin;

    const sessionSiteId = whatsapp.getUserBoundSiteId
      ? (whatsapp.getUserBoundSiteId(dispatchTarget) || whatsapp.getUserBoundSiteId(speakerPhone))
      : null;
    let site = null;
    let allSites = [];
    let allWorkers = [];
    let allContacts = [];

    try {
      [allSites, allWorkers, allContacts] = await Promise.all([
        getCachedSites(),
        getCachedWorkers(),
        getCachedContacts()
      ]);
      if (!allSites || allSites.length === 0) {
        allSites = await getCachedSites(true);
      }
    } catch (e) {
      console.warn(`[Cache Log] Failed to retrieve caches: ${e.message}`);
    }

    const lookupMaps = buildRecordLookupMaps(allSites, allWorkers, allContacts);

    if (sessionSiteId && allSites.length > 0) {
      site = allSites.find(s => s.id === sessionSiteId) || null;
    }

    if (!site && allSites.length > 0) {
      site = allSites.find(s => {
        const gid = String(s.fields['WhatsApp Group ID'] || s.fields['Client Whatsapp Group ID'] || '').trim();
        return gid && (gid === dispatchTarget || dispatchTarget.includes(gid));
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

    // ------------------------------------------------------------------
    // ROUTE A: INTERACTIVE BUTTON CALLBACKS
    // ------------------------------------------------------------------
    const interactiveButtonId = message.interactive?.button_reply?.id || '';
    if (interactiveButtonId) {
      if (interactiveButtonId === 'DRAFT_REPLY' || interactiveButtonId.startsWith('DRAFT_REPLY_')) {
        const replyTargetEmail = interactiveButtonId.startsWith('DRAFT_REPLY_')
          ? interactiveButtonId.replace('DRAFT_REPLY_', '').trim()
          : null;
        const existingSession = draftingSessions.get(speakerPhone) || {};

        draftingSessions.set(speakerPhone, {
          active: true,
          context: existingSession.context || null,
          subject: existingSession.subject || null,
          targetEmail: replyTargetEmail || existingSession.targetEmail || null
        });

        await whatsapp.sendWhatsAppMessage(
          CONFIG,
          dispatchTarget,
          `🎙️ *Drafting Mode Active*\nSend a voice note or text message now to draft your reply${replyTargetEmail ? ` to ${replyTargetEmail}` : ''}. I will remove filler words and format it professionally.`
        );
        return;
      }

      if (interactiveButtonId === 'SEND_DRAFTED_EMAIL') {
        const session = draftingSessions.get(speakerPhone);
        if (session && session.draftedBody && session.targetEmail) {
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⏳ Dispatching email to ${session.targetEmail}...`);
          const success = await sendGmailViaOAuth(
            CONFIG,
            session.targetEmail,
            session.subject || 'Re: Bounce Padel Commercial Inquiry',
            session.draftedBody
          );
          if (success) {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ *Email Dispatched Successfully* to ${session.targetEmail}.`);
            draftingSessions.delete(speakerPhone);
          } else {
            await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Failed to send email via Gmail API. Check GMAIL_CLIENT_ID / GMAIL_REFRESH_TOKEN in Render.`);
          }
        } else {
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Drafting session expired or target email missing.`);
        }
        return;
      }

      // SWARM LOGISTICS PUSH & CLAIM / COMPLETION HANDLER
      if (interactiveButtonId.startsWith('CLAIM_LOG_') || interactiveButtonId.startsWith('DONE_LOG_')) {
        const ticketId = interactiveButtonId.split('_').pop();
        const btnTitle = message.interactive?.button_reply?.title || 'Updated Status';
        const isDone = interactiveButtonId.startsWith('DONE_LOG_');
        const statusUpdate = isDone ? 'Complete' : 'In Progress';

        try {
          let existingNotes = '';
          let directionsStr = '';
          let targetSiteName = 'the site';
          const openAssignments = await fetchAllAirtableRecords(airtableSchemaCache.assignmentsTable, `RECORD_ID()='${ticketId}'`);

          if (openAssignments.length > 0) {
            existingNotes = String(openAssignments[0].fields['Notes'] || '');
            const siteArr = openAssignments[0].fields['Sites'] || openAssignments[0].fields['Site'];
            if (Array.isArray(siteArr) && siteArr.length > 0) {
              const boundSite = allSites.find(s => s.id === siteArr[0]);
              if (boundSite) {
                targetSiteName = getSiteDisplayName(boundSite);
                const coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, boundSite, airtableWriteWithAutoDrop);
                if (coords) {
                  directionsStr = `\n\n🚗 *Tap to Navigate:*\nhttps://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}&dir_action=navigate`;
                }
              }
            }
          }

          const stampLine = `[${new Date().toISOString()}] ${callerIdentity.name} clicked: ${btnTitle}`;
          const updatedNotes = existingNotes ? `${existingNotes}\n${stampLine}` : stampLine;

          const patchFields = {
            'Status': statusUpdate,
            'Notes': updatedNotes
          };
          if (worker && worker.id) {
            patchFields['Worker'] = [worker.id];
            patchFields['Worker Claim'] = [worker.id];
          }

          await airtableWriteWithAutoDrop('Daily Assignments', patchFields, ticketId);

          const updateMsg = isDone
            ? `✅ *Dispatch Completed*\nTicket for *${targetSiteName}* sealed as Complete by ${callerIdentity.name}. Great job.`
            : `✅ *Dispatch Claimed*\n${callerIdentity.name} is now assigned to the run for *${targetSiteName}*. Drive safe.${directionsStr}`;

          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, updateMsg);
        } catch (e) {
          console.warn('[Swarm Logistics Claim Error]', e.message);
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Failed to update logistics ticket status on the ledger.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('CLAIM_DISPATCH_')) {
        const parts = interactiveButtonId.split('_');
        const assignmentId = parts[2];
        const requesterPhone = parts[3];

        try {
          await airtableWriteWithAutoDrop('Daily Assignments', {
            'Worker': worker ? [worker.id] : [],
            'Status': 'In Progress'
          }, assignmentId);

          let directionsStr = "";
          let targetSiteName = "the site";
          const openAssignments = await fetchAllAirtableRecords(airtableSchemaCache.assignmentsTable, `RECORD_ID()='${assignmentId}'`);

          if (openAssignments.length > 0) {
            const siteArr = openAssignments[0].fields['Sites'] || openAssignments[0].fields['Site'];
            if (siteArr && siteArr.length > 0) {
              const boundSite = allSites.find(s => s.id === siteArr[0]);
              if (boundSite) {
                targetSiteName = getSiteDisplayName(boundSite);
                const coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, boundSite, airtableWriteWithAutoDrop);
                if (coords) {
                  directionsStr = `\n\n🚗 *Tap to Navigate:*\nhttps://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}&dir_action=navigate`;
                }
              }
            }
          }

          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ *Dispatch Claimed*\n${callerIdentity.name} is now the owner of this logistics ticket for ${targetSiteName}. Drive safe.${directionsStr}`);

          if (requesterPhone && requesterPhone !== dispatchTarget) {
            await whatsapp.sendWhatsAppMessage(CONFIG, requesterPhone, `🚚 *Logistics Update:*\n${callerIdentity.name} has accepted your logistics request and is en route to ${targetSiteName}.`);
          }
        } catch (e) {
          console.warn('[Logistics Claim Error]', e);
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Failed to claim dispatch on the ledger.`);
        }
        return;
      }

      if (interactiveButtonId.startsWith('BIND_SITE_')) {
        const selectedSiteId = interactiveButtonId.replace('BIND_SITE_', '');
        const selectedSite = allSites.find(s => s.id === selectedSiteId);
        if (selectedSite) {
          const userLat = whatsapp.lastDroppedCoordinates?.get(speakerPhone)?.lat;
          const userLon = whatsapp.lastDroppedCoordinates?.get(speakerPhone)?.lon;

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

          try {
            await whatsapp.bindSiteContext(CONFIG, selectedSite, worker, callerIdentity, dispatchTarget, speakerPhone, dist, userLat, userLon, airtableWriteWithAutoDrop, fetchDadJoke, weatherStr);
            await replayPendingUnboundMediaBatch(speakerPhone, selectedSite, dispatchTarget);
          } catch (e) {
            console.error('[Context Binding Error]:', e.message);
          }
        }
        return;
      }

      if (interactiveButtonId.startsWith('QBO_EMAIL_EST_')) {
        if (!hasFinanceAccess) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
        }
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
        if (!hasFinanceAccess) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
        }
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
        if (!hasFinanceAccess) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
        }
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
          if (inv && metrics && metrics.incrementMetric) metrics.incrementMetric('invoices_generated');

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
        if (!hasFinanceAccess) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
        }
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

    // ------------------------------------------------------------------
    // ROUTE B: WHATSAPP LOCATION PIN CHECK-IN
    // ------------------------------------------------------------------
    if (message.type === 'location') {
      console.log(`[Location Triage] Received pin from ${speakerPhone} in thread ${dispatchTarget}. Triggering reaction...`);

      try {
        await whatsapp.sendWhatsAppReaction(CONFIG, dispatchTarget, messageId, '📍');
      } catch (e) {
        console.error('[Meta API] Reaction Error:', e.message);
      }

      const userLat = message.location?.latitude;
      const userLon = message.location?.longitude;

      if (userLat && userLon) {
        whatsapp.lastDroppedCoordinates.set(speakerPhone, { lat: userLat, lon: userLon, timestamp: Date.now() });

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
              const dist = whatsapp.haversineDistanceKm(userLat, userLon, coords.lat, coords.lon) * 1000;
              if (dist <= 800) nearby.push({ site: s, distance: dist });
            }
          } catch (geocodeError) {
            console.warn(`[Geocoding Error] Failed to resolve coordinates for site ${s.id}:`, geocodeError.message);
          }
        }

        nearby.sort((a, b) => a.distance - b.distance);

        if (nearby.length === 1) {
          console.log(`[Location Triage] Single site found (${getSiteDisplayName(nearby[0].site)}). Binding context.`);

          let weatherStr = '';
          try {
            const weatherCheck = await evaluateWeatherTripwires(userLat, userLon);
            if (!weatherCheck.safe) {
              weatherStr = `⚠️ *METEOROLOGICAL TRIPWIRE TRIGGERED*\n${weatherCheck.warnings.join('\n')}\n_Certain physical workflows may be suspended._`;
            } else if (weatherCheck.telemetry) {
              weatherStr = `🟢 *Conditions Clear:* Wind (${weatherCheck.telemetry.wind_gusts_10m} mph), Temp (${weatherCheck.telemetry.temperature_2m}°C).`;
            }
          } catch (weatherError) {
            console.warn(`[Meteorology Error] Failed to evaluate weather for ${speakerPhone}:`, weatherError.message);
          }

          try {
            await whatsapp.bindSiteContext(CONFIG, nearby[0].site, worker, callerIdentity, dispatchTarget, speakerPhone, nearby[0].distance, userLat, userLon, airtableWriteWithAutoDrop, fetchDadJoke, weatherStr);
            await replayPendingUnboundMediaBatch(speakerPhone, nearby[0].site, dispatchTarget);
          } catch (e) {
            console.error('[Context Binding Error]:', e.message);
          }
        } else if (nearby.length > 1) {
          console.log(`[Location Triage] Multiple sites found. Dispatching selector buttons.`);

          const buttons = nearby.slice(0, 3).map((n) => {
            let safeTitle = getSiteDisplayName(n.site).trim();
            if (safeTitle.length > 20) {
              safeTitle = safeTitle.substring(0, 20).trim();
            }
            return {
              id: `BIND_SITE_${n.site.id}`,
              title: safeTitle
            };
          });

          await whatsapp.sendWhatsAppButtons(CONFIG, dispatchTarget, `📍 Multiple courts detected within 800m. Please select your active zone:`, buttons);
        } else {
          console.log(`[Site Engine] Unmapped location pin dropped at (${userLat.toFixed(5)}, ${userLon.toFixed(5)}) by ${speakerPhone}`);

          pendingNewSiteRequests.set(speakerPhone, {
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

          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, promptMsg);
        }
      }
      return;
    }

    // ------------------------------------------------------------------
    // ROUTE C: MEDIA BURST DEBOUNCER (VIDEO / IMAGE / DOCUMENT)
    // ------------------------------------------------------------------
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

              const checkRes = await fetchWithExponentialBackoff(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
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
              }, 2);

              if (checkRes && checkRes.ok) {
                const checkData = await checkRes.json();
                const parsedCheck = JSON.parse(checkData.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
                if (parsedCheck.is_receipt === true) isReceipt = true;
                if (parsedCheck.is_message_screenshot === true) isScreenshot = true;

                if (isScreenshot) {
                  draftingSessions.set(speakerPhone, { active: false, context: parsedCheck.ocr_text });

                  // Autonomously create a Daily Assignment for the Sales Lead
                  try {
                    const assignmentPayload = {
                      'Assignment Type': 'Sales',
                      'Status': 'Open',
                      'Priority': 'High',
                      'Notes': `[COMMERCIAL LEAD - SCREENSHOT INGESTION] Follow up required.\n\nExtracted Text:\n${String(parsedCheck.ocr_text || '').slice(0, 500)}...`
                    };

                    if (worker && worker.id) {
                      assignmentPayload['Worker'] = [worker.id];
                    }

                    await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
                    console.log(`[Sales Engine] Autonomous Sales Assignment created from screenshot ingestion by ${speakerPhone}.`);
                  } catch (assignErr) {
                    console.error('[Sales Engine] Failed to create Daily Assignment from screenshot:', assignErr.message);
                  }

                  const buttons = [{ id: 'DRAFT_REPLY', title: "Draft Reply" }];
                  await whatsapp.sendWhatsAppButtons(CONFIG, dispatchTarget, `📸 *TITAN OS | MESSAGE SCREENSHOT DETECTED*\n──────────────────────────────\nWould you like to draft a professional reply to this message?\n\n_Note: A Sales ticket has been autonomously generated on the ledger._`, buttons);
                  return;
                }
              }
            } catch (e) {
              console.warn('[Batch Triage] Fast visual classifier bypassed:', e.message);
            }
          }

          if (!hasVideo && isReceipt && finance && finance.handleReceiptUpload) {
            await finance.handleReceiptUpload(CONFIG, currentBatch, dispatchTarget, (t, m) => whatsapp.sendWhatsAppMessage(CONFIG, t, m), callerIdentity, airtableWriteWithAutoDrop);
            return;
          }

          // Re-check live session site binding in case worker pinned while debounce timer ran
          const liveBoundId = whatsapp.getUserBoundSiteId
            ? (whatsapp.getUserBoundSiteId(dispatchTarget) || whatsapp.getUserBoundSiteId(speakerPhone))
            : null;
          if (!currentBatch.site && liveBoundId) {
            const freshSites = await getCachedSites();
            currentBatch.site = freshSites.find(s => s.id === liveBoundId) || null;
          }

          // "Be Water" Retroactive Buffer: if worker uploaded media before dropping pin,
          // hold a copy in RAM for 10 minutes so dropping a pin auto-replays the sweep.
          if (!currentBatch.site) {
            const existingPending = pendingUnboundMediaBatches.get(speakerPhone);
            const mergedItems = existingPending && (Date.now() - existingPending.timestamp <= UNBOUND_MEDIA_TTL_MS)
              ? [...existingPending.batch.items, ...currentBatch.items]
              : [...currentBatch.items];

            pendingUnboundMediaBatches.set(speakerPhone, {
              timestamp: Date.now(),
              batch: {
                ...currentBatch,
                items: mergedItems
              }
            });
          }

          await runForensicMediaBatch(currentBatch);
        } catch (batchErr) {
          console.error('[Batch Engine Failure]:', batchErr);
          await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Error processing media submission: ${batchErr.message}`);
        }
      }, 3500);
      return;
    }

    // ------------------------------------------------------------------
    // ROUTE D: SPOKEN VOICE MEMOS (AUDIO / VOICE)
    // ------------------------------------------------------------------
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
        if (draftingSessions.has(speakerPhone) && draftingSessions.get(speakerPhone).active) {
          const activeDraftSession = draftingSessions.get(speakerPhone);
          await executeDraftingMode(CONFIG, null, audioBuffer, mimeType, activeDraftSession, speakerPhone, dispatchTarget);
          return;
        }

        const registeredSiteNames = allSites.map(s => getSiteDisplayName(s)).filter(Boolean);
        const boundSiteId = whatsapp.getUserBoundSiteId
          ? (whatsapp.getUserBoundSiteId(dispatchTarget) || whatsapp.getUserBoundSiteId(speakerPhone))
          : null;
        const activeBoundSite = boundSiteId ? allSites.find(s => s.id === boundSiteId) : site;

        console.log(`[Audio Ingress] Parsing spoken voice memo via Gemini 2.5 Pro from ${callerIdentity.name} (${speakerPhone}) in ${dispatchTarget}...`);

        const spokenTriage = await whatsapp.triageSpokenOrTextNLP(CONFIG, '', registeredSiteNames, true, [{ buffer: audioBuffer, mimeType }], speakerPhone, activeBoundSite);

        console.log(`[Audio Ingress] Spoken Intent: ${spokenTriage?.intent || 'UNKNOWN'} | Site: ${spokenTriage?.referenced_site_name || 'None'} | Client: ${spokenTriage?.qbo_customer_name || 'None'}`);

        if (spokenTriage) {
          const dM = (t, m) => whatsapp.sendWhatsAppMessage(CONFIG, t, m);
          const dB = (t, m, b) => whatsapp.sendWhatsAppButtons(CONFIG, t, m, b);
          const transcript = spokenTriage.transcript_en || '';
          const transcriptLower = transcript.toLowerCase();

          if (spokenTriage.intent === 'LEDGER_QUERY') {
            return await executeLedgerQuery(CONFIG, transcript, dispatchTarget);
          }

          if (spokenTriage.intent === 'COURT_SPECS_QUERY') {
            return await handleCourtSpecsQuery(CONFIG, transcript, spokenTriage.referenced_site_name, activeBoundSite, dispatchTarget);
          }

          if (spokenTriage.intent === 'CREATE_ESTIMATE' && finance?.handleEstimateCreation) {
            if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
            return await finance.handleEstimateCreation(CONFIG, spokenTriage, dispatchTarget, getActiveOracleURIs(), dM, dB);
          }

          if (spokenTriage.intent === 'CONVERT_ESTIMATE' && finance?.handleInvoiceApproval) {
            if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
            return await finance.handleInvoiceApproval(CONFIG, spokenTriage, dispatchTarget, dM, dB);
          }

          if (spokenTriage.intent === 'CREATE_INVOICE' && finance?.handleInvoiceCreation) {
            if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
            return await finance.handleInvoiceCreation(CONFIG, spokenTriage, dispatchTarget, getActiveOracleURIs(), dM, dB);
          }

          if (spokenTriage.intent === 'CHANGE_ORDER' && finance?.handleConversationalChangeOrder) {
            if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
            return await finance.handleConversationalChangeOrder(CONFIG, spokenTriage, dispatchTarget, getActiveOracleURIs(), dM, dB, callerIdentity);
          }

          // VOICE NLP SWARM BROADCASTER
          if (spokenTriage.intent === 'LOGISTICS_DISPATCH') {
            const requestedItem = spokenTriage.structured_payload?.item || spokenTriage.transcript_en || transcript || 'Logistics Items';
            const siteId = activeBoundSite ? activeBoundSite.id : null;
            const targetSiteName = activeBoundSite ? getSiteDisplayName(activeBoundSite) : 'Unknown Field Site';

            const assignment = await airtableWriteWithAutoDrop('Daily Assignments', {
              'Assignment Type': 'Logistics',
              'Status': 'Open',
              'Priority': 'High',
              'Sites': siteId ? [siteId] : [],
              'Notes': `[FIELD REQUEST] ${callerIdentity.name} at ${targetSiteName}: ${requestedItem}`
            });

            if (!assignment.success || !assignment.record?.id) {
              return await dM(dispatchTarget, `⚠️ Failed to log logistics request to the ledger.`);
            }
            if (metrics && metrics.incrementMetric) metrics.incrementMetric('logistics_dispatches');

            const ticketId = assignment.record.id;
            await dM(dispatchTarget, `✅ *TITAN OS | LOGISTICS*\nTicket logged. Dispatching to local swarm and production team...`);

            const runnerRoles = ['delivery', 'logistics', 'supervisor', 'fabrication', 'production'];
            const swarmRunners = allWorkers.filter(w => {
              if (w.fields['Active'] === false) return false;
              const wPhone = String(w.fields['WhatsApp Number'] || w.fields['Phone E164'] || w.fields['Phone'] || w.fields['Mobile'] || '').replace(/\D/g, '');
              const e164 = wPhone.length === 10 ? '1' + wPhone : wPhone;
              const wRole = String(w.fields['Role'] || '').toLowerCase();

              const isRunner = runnerRoles.some(r => wRole.includes(r));
              const isPinnedToSite = Boolean(siteId && whatsapp.getUserBoundSiteId && (whatsapp.getUserBoundSiteId(e164) === siteId || whatsapp.getUserBoundSiteId(wPhone) === siteId));
              const isNotRequester = Boolean(e164 && e164 !== speakerPhone && e164 !== displayBotPhone);

              return (isRunner || isPinnedToSite) && isNotRequester;
            });

            let mapLink = 'Coordinates pending';
            if (activeBoundSite) {
              try {
                const c = await whatsapp.resolveCoordinates(CONFIG, memoryCache, activeBoundSite, airtableWriteWithAutoDrop);
                if (c) mapLink = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`;
              } catch (e) {}
            }

            const broadcastMsg = `🚚 *LOCAL LOGISTICS DISPATCH*\n━━━━━━━━━━━━━━━━━━━━\n📍 *Site:* ${targetSiteName}\n🗺️ *Routing:* ${mapLink}\n\n🗣️ *Requested By:* ${callerIdentity.name}\n📦 *Items:* "${requestedItem}"\n━━━━━━━━━━━━━━━━━━━━\nTap below to claim this run:`;

            const buttons = [
              { id: `CLAIM_LOG_${ticketId}`, title: 'Claim Run' },
              { id: `DONE_LOG_${ticketId}`, title: 'Mark Completed' }
            ];

            const uniqueTargets = [...new Set(swarmRunners.map(r => {
              const p = String(r.fields['WhatsApp Number'] || r.fields['Phone E164'] || r.fields['Phone'] || r.fields['Mobile'] || '').replace(/\D/g, '');
              return p.length === 10 ? '1' + p : p;
            }).filter(Boolean))];

            for (const runnerPhone of uniqueTargets) {
              await whatsapp.sendWhatsAppButtons(CONFIG, runnerPhone, broadcastMsg, buttons);
            }
            return;
          }

          if (spokenTriage.intent === 'AR_LOOKUP') {
            if (!hasFinanceAccess) {
              return await dM(dispatchTarget, `⚠️ Access Denied. Financial ledger queries are restricted to Admin or Finance roles.`);
            }
            if (finance?.handleARLookup) {
              return await finance.handleARLookup(CONFIG, dispatchTarget, dM, callerIdentity, spokenTriage);
            }
          }

          if (spokenTriage.intent === 'ORACLE_QUERY' && oracle?.handleOracleQuery) {
            return await oracle.handleOracleQuery(CONFIG, spokenTriage, dispatchTarget, getActiveOracleURIs(), dM);
          }

          if (spokenTriage.intent === 'INVENTORY_QUERY' && inventory?.handleSpokenInventorySnapshot) {
            if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Inventory queries require Fabrication, Warehouse, or Admin roles.`);
            if (metrics && metrics.incrementMetric) metrics.incrementMetric('inventory_queries');
            return await inventory.handleSpokenInventorySnapshot(CONFIG, transcript, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
          }

          if (spokenTriage.intent === 'INVENTORY_UPDATE' && inventory?.handleSpokenInventoryUpdate) {
            if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Inventory mutations require Fabrication, Warehouse, or Admin roles.`);
            return await inventory.handleSpokenInventoryUpdate(CONFIG, transcript, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
          }

          if (spokenTriage.intent === 'EQUIPMENT_QUERY' && inventory?.handleSpokenEquipmentQuery) {
            if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Equipment queries require Fabrication, Warehouse, or Admin roles.`);
            return await inventory.handleSpokenEquipmentQuery(CONFIG, transcript, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
          }

          if (spokenTriage.intent === 'EQUIPMENT_UPDATE' && inventory?.handleSpokenEquipmentUpdate) {
            if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Equipment mutations require Fabrication, Warehouse, or Admin roles.`);
            return await inventory.handleSpokenEquipmentUpdate(CONFIG, transcript, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
          }

          if (spokenTriage.intent === 'READINESS_QUERY') {
            const targetSiteName = spokenTriage.qbo_customer_name || spokenTriage.referenced_site_name || (activeBoundSite ? getSiteDisplayName(activeBoundSite) : null);
            if (!targetSiteName) return await dM(dispatchTarget, `⚠️ Please specify a court name.`);
            return await evaluateVirtualSiteReadiness(CONFIG, targetSiteName, dispatchTarget);
          }

          if (spokenTriage.intent === 'NAVIGATION_QUERY' || /directions to|direction to|location for|map of|how do i get to/i.test(transcriptLower)) {
            let targetSiteName = spokenTriage.referenced_site_name;
            if (!targetSiteName) {
              targetSiteName = transcriptLower
                .replace(/^(can i get |can i have |i need |give me |show me )?(site )?(directions to|direction to|location for|map of|how do i get to)\s*/i, '')
                .replace(/\?/g, '')
                .trim();
            }

            const activeTargetSite = findMatchingSite(allSites, targetSiteName, activeBoundSite, lookupMaps);

            if (activeTargetSite) {
              let coords = null;
              try { coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, activeTargetSite, airtableWriteWithAutoDrop); } catch (e) {}

              let mapsUrl, satUrl, locDisp;
              if (coords && coords.lat && coords.lon) {
                mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}&dir_action=navigate`;
                satUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${coords.lat},${coords.lon}&zoom=19&basemap=satellite`;
                locDisp = `🌐 *Coordinates:* \`${Number(coords.lat).toFixed(5)}, ${Number(coords.lon).toFixed(5)}\``;
              } else {
                const rawLoc = activeTargetSite.fields['Site Location'] || activeTargetSite.fields['Site location'] || activeTargetSite.fields['Address'];
                if (rawLoc) {
                  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawLoc)}`;
                  satUrl = `_Satellite view unavailable for text addresses._`;
                  locDisp = `📍 *Address:* ${rawLoc}`;
                }
              }

              if (mapsUrl) {
                const navCard = `🧭 *TITAN OS | DIGITAL SITE PASS*\n` +
                                `──────────────────────────────\n` +
                                `🏟️ *Destination:* ${getSiteDisplayName(activeTargetSite)}\n` +
                                `${locDisp}\n` +
                                `──────────────────────────────\n` +
                                `🚗 *Driving Directions:*\n${mapsUrl}\n\n` +
                                `🛰️ *Logistics View:*\n${satUrl}`;
                return await dM(dispatchTarget, navCard);
              }
            }
            return await dM(dispatchTarget, `⚠️ Could not locate coordinates or address for "${targetSiteName || 'that site'}".`);
          }

          // DYNAMIC SITE UPDATE OR QUESTION FOR SPOKEN MEMOS
          const isFleetAnalytical = /\b(how many|count|total|list all|which sites|which courts|2024|2025|2026|2027|deposits?)\b/i.test(transcriptLower);
          if (isFleetAnalytical) {
            return await executeLedgerQuery(CONFIG, transcript, dispatchTarget);
          }

          const isUpdate = /\b(update site|change site|set site|update)\b/i.test(transcriptLower) || spokenTriage?.intent === 'DYNAMIC_SITE_UPDATE';
          const isQuestion = /\b(what|who|when|where|which|how|does|do|is|are|tell me|details|config|lights?)\b/i.test(transcriptLower) || transcript.includes('?');

          if (isUpdate) {
            const activeTargetSite = findMatchingSite(allSites, spokenTriage.referenced_site_name || transcript, activeBoundSite, lookupMaps);
            if (!activeTargetSite) {
              if (whatsapp.updateSessionContext) whatsapp.updateSessionContext(speakerPhone, { pendingText: transcript });
              return await dM(dispatchTarget, `Got it. Which site does this update apply to?`);
            }

            try {
              const protectedColumns = [
                'Current Gate', 'Gate Number', 'Current Gate Rank', 'Completion %',
                'Workflow Mode', 'Site Mode', 'Site Status', 'Deposit Status',
                'WhatsApp Group ID', 'Client Whatsapp Group ID', 'Subscribed Phones',
                'Last Note', 'Last Intent', 'Last Report Time', 'Worker', 'Assigned Workers',
                'Assignment ID', 'Daily Assignments', 'Open Tickets', 'Site Record ID',
                'Current Task ID', 'Current Pulse Report ID', 'Site Location', 'Map Cache',
                'Cleared Milestones', 'Verified Milestones', 'Milestone Timestamps',
                'Milestone Timestamps JSON', 'Reports 2', 'Reports 2 (2)', 'Inbound Messages 2',
                'Technical Docs', 'Latest Video Link', 'ToolKit URL', 'Finance & AR'
              ];
              const knownColumns = new Set();
              allSites.forEach(s => {
                if (s.fields) {
                  Object.keys(s.fields).forEach(k => {
                    if (!protectedColumns.includes(k) && !/^(Summary|Headline|Title)\s*\(/i.test(k)) {
                      knownColumns.add(k);
                    }
                  });
                }
              });

              const extractionPrompt = `You are an AI extracting database patches for the 'Sites' table.
Transcript: "${transcript}"
Known Airtable Columns: ${JSON.stringify(Array.from(knownColumns))}

Extract any fields the user wants updated. Match extracted keys EXACTLY to the 'Known Airtable Columns' above.
DO NOT hallucinate or extract financial status, milestones, or system configuration columns.
Format Single Select dropdowns in Title Case (e.g. "Green", "Mondo", "Yes").
Format Checkboxes as strictly boolean true or false.
Return ONLY valid JSON mapping exact field names to values.
Do not wrap in markdown quotes. Return empty JSON {} if no columns identified.`;

              const geminiRes = await fetchWithExponentialBackoff(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
                  generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
                })
              }, 2);

              if (geminiRes && geminiRes.ok) {
                const data = await geminiRes.json();
                const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (rawJson) {
                  const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                  const parsed = JSON.parse(cleanJson);
                  const normalized = whatsapp.normalizeSitePayload ? whatsapp.normalizeSitePayload(parsed, activeTargetSite) : parsed;

                  const englishTranscript = await translateTextToEnglish(transcript);
                  const payload = { 'Last Note': `[VOICE UPDATE] ${callerIdentity.name}: "${englishTranscript}"`, 'Last Intent': 'DYNAMIC_SITE_UPDATE' };
                  for (const [key, value] of Object.entries(normalized)) {
                    if (!protectedColumns.includes(key) && !/^(Summary|Headline|Title)\s*\(/i.test(key)) {
                      payload[key] = value;
                    }
                  }

                  const writeResult = await airtableWriteWithAutoDrop('Sites', payload, activeTargetSite.id);
                  await getCachedSites(true);
                  if (metrics && metrics.incrementMetric) metrics.incrementMetric('sites_updated');

                  if (writeResult && writeResult.success) {
                    const writtenKeys = Object.keys(writeResult.writtenFields).filter(k => k !== 'Last Note' && k !== 'Last Intent');
                    if (writtenKeys.length > 0) {
                      const writtenSummary = writtenKeys.map(k => `${k}: *${writeResult.writtenFields[k]}*`).join('\n• ');
                      return await dM(dispatchTarget, `✅ Logged to the *${getSiteDisplayName(activeTargetSite)}* ledger.\n\n*Successfully Updated:*\n• ${writtenSummary}`);
                    }
                    return await dM(dispatchTarget, `⚠️ Logged to the *${getSiteDisplayName(activeTargetSite)}* ledger, but Airtable rejected the specific column updates (Schema mismatch).`);
                  }
                  return await dM(dispatchTarget, `❌ Failed to update the *${getSiteDisplayName(activeTargetSite)}* ledger.`);
                }
              }
            } catch (e) {
              console.error('[Dynamic Extraction Failure]', e.message);
            }
          }

          if (isQuestion) {
            const matchedSite = findMatchingSite(allSites, spokenTriage.referenced_site_name || transcript, activeBoundSite, lookupMaps);
            if (matchedSite) {
              return await handleCourtSpecsQuery(CONFIG, transcript, getSiteDisplayName(matchedSite), matchedSite, dispatchTarget);
            }
            return await executeLedgerQuery(CONFIG, transcript, dispatchTarget);
          }

          if (transcript) {
            return await dM(dispatchTarget, `🎙️ *Heard:* "${transcript}"\n\nReply with a specific court name, \`/help\` for commands, or ask any question about your sites, AR, inventory, or blueprints.`);
          }
        }
      }
      return;
    }

    // ------------------------------------------------------------------
    // ROUTE E: TEXT COMMANDS & NATURAL LANGUAGE TRIAGE
    // ------------------------------------------------------------------
    const payloadText = message.text?.body || message.interactive?.button_reply?.title || '';
    if (message.type === 'text' || message.type === 'interactive' || payloadText) {
      const txt = payloadText.trim();
      const lTxt = txt.toLowerCase();

      console.log(`[Text Engine] Parsing payload: "${txt}" from ${dispatchTarget} (Caller: ${callerIdentity.name}, Roles: [${userRoles.join(', ')}])`);

      // Manual RAM Cache Buster
      if (lTxt === '/refresh') {
        if (!userRoles.some(r => r.includes('admin')) && !isMasterAdmin) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Restricted to Admin.`);
        }
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⏳ Manual cache bust initiated...`);
        try {
          memoryCache.coordinates.clear();
          await discoverAirtableBaseSchema(true);
          await getCachedSites(true);
          await getCachedWorkers(true);
          await getCachedContacts(true);
          await getCachedOpenAssignments(true);
          await hydrateQBOCache();
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `✅ *Titan OS RAM Hydrated.*\nSites (${memoryCache.sites?.length || 0}), Workers (${memoryCache.workers?.length || 0}), Contacts (${memoryCache.contacts?.length || 0}), Assignments, and QBO tokens refreshed.`);
        } catch (e) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Failed to rebuild cache: ${e.message}`);
        }
      }

      // Active Executive Drafting Mode Interceptor
      if (draftingSessions.has(speakerPhone) && draftingSessions.get(speakerPhone).active && !interactiveButtonId) {
        const activeDraftSession = draftingSessions.get(speakerPhone);
        await executeDraftingMode(CONFIG, txt, null, null, activeDraftSession, speakerPhone, dispatchTarget);
        return;
      }

      if (lTxt === '/help' || lTxt === 'help' || lTxt === '?') {
        const helpMenu = `🛠️ *TITAN OS | COMMAND CENTER*\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n` +
                         `*👷 Field Installation*\n` +
                         `• Drop a 📍 Pin to check in.\n` +
                         `• Send photos/videos/receipts to log expenses or build milestones.\n` +
                         `• Send voice notes to dynamically update court specs.\n\n` +
                         `*🏟️ Court Specs & Airtable Analytics*\n` +
                         `• "What court configuration does Weiss have?"\n` +
                         `• "Does Rosenberg's court have lights?"\n` +
                         `• "How many courts do we have deposits on for 2027?"\n\n` +
                         `*🚚 Navigation, Oracle & Telemetry*\n` +
                         `• \`/map [Site]\` or "Directions to Rosenberg"\n` +
                         `• \`/docs\` or ask any engineering/blueprint question\n` +
                         `• \`/readiness [Site Name]\` for audit matrix\n` +
                         `• \`/metrics\` for operational leverage telemetry\n\n` +
                         `*📦 Resources & 💰 Finance*\n` +
                         `• "Check inventory" or "Where is the glass mover?"\n` +
                         `• "What is my 30+ AR?"\n` +
                         `• "Create an estimate for [Client]..."`;
        return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, helpMenu);
      }

      // Direct Navigation / Map Shortcut
      if (lTxt.startsWith('/map ') || /\b(directions to|direction to|location for|map of|how do i get to)\b/i.test(lTxt)) {
        const targetSiteName = txt
          .replace(/^\/map\s*/i, '')
          .replace(/^(can i get |can i have |i need |give me |show me )?(site )?(directions to|direction to|location for|map of|how do i get to)\s*/i, '')
          .replace(/\?/g, '')
          .trim();

        const targetSite = findMatchingSite(allSites, targetSiteName, site, lookupMaps);

        if (targetSite) {
          let coords = null;
          try { coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, targetSite, airtableWriteWithAutoDrop); } catch (e) {}

          let mapsUrl, satUrl, locDisp;
          if (coords && coords.lat && coords.lon) {
            mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}&dir_action=navigate`;
            satUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${coords.lat},${coords.lon}&zoom=19&basemap=satellite`;
            locDisp = `🌐 *Coordinates:* \`${Number(coords.lat).toFixed(5)}, ${Number(coords.lon).toFixed(5)}\``;
          } else {
            const rawLoc = targetSite.fields['Site Location'] || targetSite.fields['Site location'] || targetSite.fields['Address'];
            if (rawLoc) {
              mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawLoc)}`;
              satUrl = `_Satellite view unavailable for text addresses._`;
              locDisp = `📍 *Address:* ${rawLoc}`;
            }
          }

          if (mapsUrl) {
            const navCard = `🧭 *TITAN OS | DIGITAL SITE PASS*\n` +
                            `──────────────────────────────\n` +
                            `🏟️ *Destination:* ${getSiteDisplayName(targetSite)}\n` +
                            `${locDisp}\n` +
                            `──────────────────────────────\n` +
                            `🚗 *Driving Directions:*\n${mapsUrl}\n\n` +
                            `🛰️ *Logistics View:*\n${satUrl}`;
            return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, navCard);
          }
        }
        return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Could not locate coordinates or address for "${targetSiteName}".`);
      }

      if (lTxt === '/metrics' || lTxt === '/telemetry') {
        if (!userRoles.some(r => r.includes('admin')) && !isMasterAdmin) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Restricted to Admin.`);
        }
        if (metrics && metrics.getTelemetryReport) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, metrics.getTelemetryReport());
        }
        return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ Metrics module offline.`);
      }

      if (lTxt.startsWith('/readiness')) {
        const siteNameStr = txt.replace(/^\/readiness\s*/i, '').trim();
        return await evaluateVirtualSiteReadiness(CONFIG, siteNameStr, dispatchTarget);
      }

      if (lTxt.startsWith('/docs') || lTxt.startsWith('/specs') || lTxt.startsWith('/plan')) {
        if (oracle?.handleOracleQuery) {
          return await oracle.handleOracleQuery(CONFIG, txt, dispatchTarget, getActiveOracleURIs(), (t, m) => whatsapp.sendWhatsAppMessage(CONFIG, t, m));
        }
      }

      if (lTxt.startsWith('create site') || lTxt.startsWith('new site') || (pendingNewSiteRequests.has(speakerPhone) && (lTxt.startsWith('yes') || lTxt.startsWith('site:')))) {
        const siteName = txt.replace(/^create\s+site:?/i, '').replace(/^new\s+site:?/i, '').replace(/^site:?/i, '').trim();
        const pendingGeo = pendingNewSiteRequests.get(speakerPhone) || whatsapp.lastDroppedCoordinates.get(speakerPhone);

        if (!pendingGeo) {
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `📍 Drop a WhatsApp pin first, then reply with CREATE SITE: [Name]`);
        }

        const primaryField = airtableSchemaCache.sitesPrimaryField || 'Site Name';
        const newRecord = await airtableWriteWithAutoDrop('Sites', {
          [primaryField]: siteName,
          'Workflow Mode': 'INSTALLATION',
          'Site Status': 'ACTIVE',
          'Site Location': `${pendingGeo.lat.toFixed(6)}, ${pendingGeo.lon.toFixed(6)}`
        });

        if (newRecord?.success) {
          pendingNewSiteRequests.delete(speakerPhone);
          await getCachedSites(true);
          return await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `🏟️ *NEW SITE CREATED*\nDigital twin active for *${siteName}* at \`${pendingGeo.lat.toFixed(5)}, ${pendingGeo.lon.toFixed(5)}\`.`);
        }
        return;
      }

      // Symmetric Text & Voice NLP Triage
      const registeredSiteNames = allSites.map(s => getSiteDisplayName(s)).filter(Boolean);
      const boundSiteId = whatsapp.getUserBoundSiteId
        ? (whatsapp.getUserBoundSiteId(dispatchTarget) || whatsapp.getUserBoundSiteId(speakerPhone))
        : null;
      const boundSite = boundSiteId ? allSites.find(s => s.id === boundSiteId) : site;

      const triage = await whatsapp.triageSpokenOrTextNLP(CONFIG, txt, registeredSiteNames, false, [], speakerPhone, boundSite);
      const dM = (t, m) => whatsapp.sendWhatsAppMessage(CONFIG, t, m);
      const dB = (t, m, b) => whatsapp.sendWhatsAppButtons(CONFIG, t, m, b);

      if (triage) {
        if (triage.intent === 'LEDGER_QUERY') {
          return await executeLedgerQuery(CONFIG, triage.transcript_en || txt, dispatchTarget);
        }

        if (triage.intent === 'COURT_SPECS_QUERY') {
          return await handleCourtSpecsQuery(CONFIG, txt, triage.referenced_site_name, boundSite, dispatchTarget);
        }

        if (triage.intent === 'CREATE_ESTIMATE' && finance?.handleEstimateCreation) {
          if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
          return await finance.handleEstimateCreation(CONFIG, triage, dispatchTarget, getActiveOracleURIs(), dM, dB);
        }

        if (triage.intent === 'CONVERT_ESTIMATE' && finance?.handleInvoiceApproval) {
          if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
          return await finance.handleInvoiceApproval(CONFIG, triage, dispatchTarget, dM, dB);
        }

        if (triage.intent === 'CREATE_INVOICE' && finance?.handleInvoiceCreation) {
          if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
          return await finance.handleInvoiceCreation(CONFIG, triage, dispatchTarget, getActiveOracleURIs(), dM, dB);
        }

        if (triage.intent === 'CHANGE_ORDER' && finance?.handleConversationalChangeOrder) {
          if (!hasFinanceAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Financial operations require Admin or Finance roles.`);
          return await finance.handleConversationalChangeOrder(CONFIG, triage, dispatchTarget, getActiveOracleURIs(), dM, dB, callerIdentity);
        }

        // TEXT NLP SWARM BROADCASTER
        if (triage.intent === 'LOGISTICS_DISPATCH') {
          const requestedItem = triage.structured_payload?.item || triage.transcript_en || txt || 'Logistics Items';
          const siteId = boundSite ? boundSite.id : null;
          const targetSiteName = boundSite ? getSiteDisplayName(boundSite) : 'Unknown Field Site';

          const assignment = await airtableWriteWithAutoDrop('Daily Assignments', {
            'Assignment Type': 'Logistics',
            'Status': 'Open',
            'Priority': 'High',
            'Sites': siteId ? [siteId] : [],
            'Notes': `[FIELD REQUEST] ${callerIdentity.name} at ${targetSiteName}: ${requestedItem}`
          });

          if (!assignment.success || !assignment.record?.id) {
            return await dM(dispatchTarget, `⚠️ Failed to log logistics request to the ledger.`);
          }
          if (metrics && metrics.incrementMetric) metrics.incrementMetric('logistics_dispatches');

          const ticketId = assignment.record.id;
          await dM(dispatchTarget, `✅ *TITAN OS | LOGISTICS*\nTicket logged. Dispatching to local swarm and production team...`);

          const runnerRoles = ['delivery', 'logistics', 'supervisor', 'fabrication', 'production'];
          const swarmRunners = allWorkers.filter(w => {
            if (w.fields['Active'] === false) return false;
            const wPhone = String(w.fields['WhatsApp Number'] || w.fields['Phone E164'] || w.fields['Phone'] || w.fields['Mobile'] || '').replace(/\D/g, '');
            const e164 = wPhone.length === 10 ? '1' + wPhone : wPhone;
            const wRole = String(w.fields['Role'] || '').toLowerCase();

            const isRunner = runnerRoles.some(r => wRole.includes(r));
            const isPinnedToSite = Boolean(siteId && whatsapp.getUserBoundSiteId && (whatsapp.getUserBoundSiteId(e164) === siteId || whatsapp.getUserBoundSiteId(wPhone) === siteId));
            const isNotRequester = Boolean(e164 && e164 !== speakerPhone && e164 !== displayBotPhone);

            return (isRunner || isPinnedToSite) && isNotRequester;
          });

          let mapLink = 'Coordinates pending';
          if (boundSite) {
            try {
              const c = await whatsapp.resolveCoordinates(CONFIG, memoryCache, boundSite, airtableWriteWithAutoDrop);
              if (c) mapLink = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`;
            } catch (e) {}
          }

          const broadcastMsg = `🚚 *LOCAL LOGISTICS DISPATCH*\n━━━━━━━━━━━━━━━━━━━━\n📍 *Site:* ${targetSiteName}\n🗺️ *Routing:* ${mapLink}\n\n🗣️ *Requested By:* ${callerIdentity.name}\n📦 *Items:* "${requestedItem}"\n━━━━━━━━━━━━━━━━━━━━\nTap below to claim this run:`;

          const buttons = [
            { id: `CLAIM_LOG_${ticketId}`, title: 'Claim Run' },
            { id: `DONE_LOG_${ticketId}`, title: 'Mark Completed' }
          ];

          const uniqueTargets = [...new Set(swarmRunners.map(r => {
            const p = String(r.fields['WhatsApp Number'] || r.fields['Phone E164'] || r.fields['Phone'] || r.fields['Mobile'] || '').replace(/\D/g, '');
            return p.length === 10 ? '1' + p : p;
          }).filter(Boolean))];

          for (const runnerPhone of uniqueTargets) {
            await whatsapp.sendWhatsAppButtons(CONFIG, runnerPhone, broadcastMsg, buttons);
          }
          return;
        }

        if (triage.intent === 'AR_LOOKUP') {
          if (!hasFinanceAccess) {
            return await dM(dispatchTarget, `⚠️ Access Denied. Financial ledger queries are restricted to Admin or Finance roles.`);
          }
          if (finance?.handleARLookup) {
            return await finance.handleARLookup(CONFIG, dispatchTarget, dM, callerIdentity, txt);
          }
        }

        if (triage.intent === 'ORACLE_QUERY' && oracle?.handleOracleQuery) {
          return await oracle.handleOracleQuery(CONFIG, triage, dispatchTarget, getActiveOracleURIs(), dM);
        }

        if (triage.intent === 'INVENTORY_QUERY' && inventory?.handleSpokenInventorySnapshot) {
          if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Inventory queries require Fabrication, Warehouse, or Admin roles.`);
          if (metrics && metrics.incrementMetric) metrics.incrementMetric('inventory_queries');
          return await inventory.handleSpokenInventorySnapshot(CONFIG, txt, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
        }

        if (triage.intent === 'INVENTORY_UPDATE' && inventory?.handleSpokenInventoryUpdate) {
          if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Inventory mutations require Fabrication, Warehouse, or Admin roles.`);
          return await inventory.handleSpokenInventoryUpdate(CONFIG, txt, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
        }

        if (triage.intent === 'EQUIPMENT_QUERY' && inventory?.handleSpokenEquipmentQuery) {
          if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Equipment queries require Fabrication, Warehouse, or Admin roles.`);
          return await inventory.handleSpokenEquipmentQuery(CONFIG, txt, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
        }

        if (triage.intent === 'EQUIPMENT_UPDATE' && inventory?.handleSpokenEquipmentUpdate) {
          if (!hasInventoryAccess) return await dM(dispatchTarget, `⚠️ Access Denied. Equipment mutations require Fabrication, Warehouse, or Admin roles.`);
          return await inventory.handleSpokenEquipmentUpdate(CONFIG, txt, dispatchTarget, dM, callerIdentity, airtableWriteWithAutoDrop);
        }

        if (triage.intent === 'READINESS_QUERY') {
          const targetSiteName = triage.qbo_customer_name || triage.referenced_site_name || (boundSite ? getSiteDisplayName(boundSite) : null);
          if (!targetSiteName) return await dM(dispatchTarget, `⚠️ Please specify a court name.`);
          return await evaluateVirtualSiteReadiness(CONFIG, targetSiteName, dispatchTarget);
        }

        if (triage.intent === 'NAVIGATION_QUERY') {
          let targetSiteName = triage?.referenced_site_name;
          if (!targetSiteName) {
            targetSiteName = txt
              .replace(/^\/map\s*/i, '')
              .replace(/^(can i get |can i have |i need |give me |show me )?(site )?(directions to|direction to|location for|map of|how do i get to)\s*/i, '')
              .replace(/\?/g, '')
              .trim();
          }

          const activeTargetSite = findMatchingSite(allSites, targetSiteName, boundSite, lookupMaps);

          if (activeTargetSite) {
            let coords = null;
            try { coords = await whatsapp.resolveCoordinates(CONFIG, memoryCache, activeTargetSite, airtableWriteWithAutoDrop); } catch (e) {}

            let mapsUrl, satUrl, locDisp;
            if (coords && coords.lat && coords.lon) {
              mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}&dir_action=navigate`;
              satUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${coords.lat},${coords.lon}&zoom=19&basemap=satellite`;
              locDisp = `🌐 *Coordinates:* \`${Number(coords.lat).toFixed(5)}, ${Number(coords.lon).toFixed(5)}\``;
            } else {
              const rawLoc = activeTargetSite.fields['Site Location'] || activeTargetSite.fields['Site location'] || activeTargetSite.fields['Address'];
              if (rawLoc) {
                mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawLoc)}`;
                satUrl = `_Satellite view unavailable for text addresses._`;
                locDisp = `📍 *Address:* ${rawLoc}`;
              }
            }

            if (mapsUrl) {
              const navCard = `🧭 *TITAN OS | DIGITAL SITE PASS*\n` +
                              `──────────────────────────────\n` +
                              `🏟️ *Destination:* ${getSiteDisplayName(activeTargetSite)}\n` +
                              `${locDisp}\n` +
                              `──────────────────────────────\n` +
                              `🚗 *Driving Directions:*\n${mapsUrl}\n\n` +
                              `🛰️ *Logistics View:*\n${satUrl}`;
              return await dM(dispatchTarget, navCard);
            }
          }
          return await dM(dispatchTarget, `⚠️ Could not locate coordinates or address for "${targetSiteName || 'that site'}".`);
        }

        // Fallback Site Update or Question Triage
        const isFleetAnalytical = /\b(how many|count|total|list all|which sites|which courts|2024|2025|2026|2027|deposits?)\b/i.test(lTxt);
        if (isFleetAnalytical) {
          return await executeLedgerQuery(CONFIG, txt, dispatchTarget);
        }

        const isUpdate = /\b(update site|change site|set site)\b/i.test(lTxt) || triage?.intent === 'DYNAMIC_SITE_UPDATE';
        const isQuestion = /\b(what|who|when|where|which|how|does|do|is|are|tell me|details|config|lights?)\b/i.test(lTxt) || txt.endsWith('?');

        if (isUpdate) {
          const activeTargetSite = findMatchingSite(allSites, triage?.referenced_site_name || txt, boundSite, lookupMaps);
          if (!activeTargetSite) {
            return await dM(dispatchTarget, `Got it. Which site does this update apply to?`);
          }

          const protectedColumns = [
            'Current Gate', 'Gate Number', 'Current Gate Rank', 'Completion %',
            'Workflow Mode', 'Site Mode', 'Site Status', 'Deposit Status',
            'WhatsApp Group ID', 'Client Whatsapp Group ID', 'Subscribed Phones',
            'Last Note', 'Last Intent', 'Last Report Time', 'Worker', 'Assigned Workers',
            'Assignment ID', 'Daily Assignments', 'Open Tickets', 'Site Record ID',
            'Current Task ID', 'Current Pulse Report ID', 'Site Location', 'Map Cache',
            'Cleared Milestones', 'Verified Milestones', 'Milestone Timestamps',
            'Milestone Timestamps JSON', 'Reports 2', 'Reports 2 (2)', 'Inbound Messages 2',
            'Technical Docs', 'Latest Video Link', 'ToolKit URL', 'Finance & AR'
          ];
          const knownColumns = new Set();
          allSites.forEach(s => {
            if (s.fields) {
              Object.keys(s.fields).forEach(k => {
                if (!protectedColumns.includes(k) && !/^(Summary|Headline|Title)\s*\(/i.test(k)) {
                  knownColumns.add(k);
                }
              });
            }
          });

          const extractPrompt = `Extract key-value pairs for Airtable Sites table update:\n"${txt}"\nKnown Columns: ${JSON.stringify(Array.from(knownColumns))}\nReturn JSON strictly matching Known Columns.`;
          const geminiRes = await fetchWithExponentialBackoff(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
              generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
            })
          }, 2);

          if (geminiRes && geminiRes.ok) {
            const data = await geminiRes.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
              const parsed = JSON.parse(rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
              const normalized = whatsapp.normalizeSitePayload ? whatsapp.normalizeSitePayload(parsed, activeTargetSite) : parsed;

              const englishTxt = await translateTextToEnglish(txt);
              const payload = { 'Last Note': `[TEXT UPDATE] ${callerIdentity.name}: "${englishTxt}"`, 'Last Intent': 'DYNAMIC_SITE_UPDATE' };
              for (const [key, value] of Object.entries(normalized)) {
                if (!protectedColumns.includes(key) && !/^(Summary|Headline|Title)\s*\(/i.test(key)) {
                  payload[key] = value;
                }
              }

              const writeResult = await airtableWriteWithAutoDrop('Sites', payload, activeTargetSite.id);
              await getCachedSites(true);
              if (metrics && metrics.incrementMetric) metrics.incrementMetric('sites_updated');

              if (writeResult && writeResult.success) {
                const writtenKeys = Object.keys(writeResult.writtenFields).filter(k => k !== 'Last Note' && k !== 'Last Intent');
                if (writtenKeys.length > 0) {
                  const writtenSummary = writtenKeys.map(k => `${k}: *${writeResult.writtenFields[k]}*`).join('\n• ');
                  return await dM(dispatchTarget, `✅ Logged to the *${getSiteDisplayName(activeTargetSite)}* ledger.\n\n*Successfully Updated:*\n• ${writtenSummary}`);
                }
                return await dM(dispatchTarget, `⚠️ Logged to the *${getSiteDisplayName(activeTargetSite)}* ledger, but Airtable rejected the specific column updates (Schema mismatch).`);
              }
              return await dM(dispatchTarget, `❌ Failed to update the *${getSiteDisplayName(activeTargetSite)}* ledger.`);
            }
          }
        }

        if (isQuestion) {
          const matchedSite = findMatchingSite(allSites, triage?.referenced_site_name || txt, boundSite, lookupMaps);
          if (matchedSite) {
            return await handleCourtSpecsQuery(CONFIG, txt, getSiteDisplayName(matchedSite), matchedSite, dispatchTarget);
          }
          return await executeLedgerQuery(CONFIG, txt, dispatchTarget);
        }
      }
      return;
    }
  } catch (err) {
    console.error('[Runtime Exception in /webhook]:', err.message);
    try {
      const body = req.body;
      const entry = body?.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];
      const rawFrom = message?.from || '';
      const dispatchTarget = String(rawFrom).replace(/\D/g, '');
      if (dispatchTarget && dispatchTarget.length > 5) {
        await whatsapp.sendWhatsAppMessage(CONFIG, dispatchTarget, `⚠️ System processing error or timeout. Please try your request again.`);
      }
    } catch (e) {}
  }
});

// ====================================================================
// 5. HEADLESS IN-SITU IOT TELEMETRY INGRESS
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
    const site = allSites.find(s => s.id === site_id) || findMatchingSite(allSites, site_name);

    if (!site) {
      console.warn(`[IoT Telemetry] Site not found for identifier: ${site_id || site_name}`);
      return;
    }

    const displayName = getSiteDisplayName(site);
    console.log(`[IoT Telemetry] Logging physical telemetry for ${displayName}: Moisture=${slab_moisture_pct}%, Temp=${slab_temp_c}°C`);

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
                        `🏟️ *Court:* ${displayName}\n` +
                        `📡 *Source:* Embedded Concrete Data Logger\n` +
                        `──────────────────────────────\n` +
                        holds.join('\n') + `\n\n` +
                        `_Physical turf gluing & glass seating automatically suspended on this asset._`;

      const groupTarget = site.fields['WhatsApp Group ID'] || site.fields['Client Whatsapp Group ID'] || CONFIG.meta.targetVerifiedPhone;
      await whatsapp.sendWhatsAppMessage(CONFIG, groupTarget, alertCard);
    }
  } catch (err) {
    console.error('[IoT Ingress Runtime Error]:', err.message);
  }
});

// ====================================================================
// 6. COMMERCIAL EMAIL INGRESS (AIRTABLE / MAKE / PUBSUB WEBHOOKS)
// ====================================================================
async function processInboundEmailWebhook(req, res) {
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
      console.warn('[Email Ingress] Ignored malformed empty payload.');
      return;
    }

    console.log(`[Email Ingress] Processing email from ${fromAddr}: "${subjectLine}"`);

    const emailMatch = String(fromAddr).match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    if (emailMatch && emailMatch[1]) {
      const targetEmail = emailMatch[1].toLowerCase().trim();
      draftingSessions.set(CONFIG.meta.targetVerifiedPhone, {
        active: false,
        context: `From: ${fromAddr}\nSubject: ${subjectLine}\n\n${cleanText.slice(0, 2000)}`,
        subject: subjectLine.startsWith('Re:') ? subjectLine : `Re: ${subjectLine}`,
        targetEmail: targetEmail
      });

      // TITAN OS DIRECT DISPATCH NOTIFICATION
      try {
        const buttons = [{ id: `DRAFT_REPLY_${targetEmail}`, title: "Draft Reply" }];
        const leadCard = `📧 *TITAN OS | COMMERCIAL LEAD DETECTED*\n──────────────────────────────\n*From:* ${fromAddr}\n*Subject:* ${subjectLine}\n\n${cleanText.slice(0, 300)}...\n──────────────────────────────\nWould you like to draft a professional reply?`;

        if (whatsapp && whatsapp.sendWhatsAppButtons) {
          await whatsapp.sendWhatsAppButtons(CONFIG, CONFIG.meta.targetVerifiedPhone, leadCard, buttons);
        }
      } catch(e) {
        console.error('[Email Ingress] Failed to alert admin:', e);
      }

      // AUTONOMOUS DAILY ASSIGNMENT FOR EMAIL LEAD
      try {
        await airtableWriteWithAutoDrop('Daily Assignments', {
          'Assignment Type': 'Sales',
          'Status': 'Open',
          'Priority': 'High',
          'Notes': `[COMMERCIAL LEAD - EMAIL] Follow up required with ${fromAddr}.\n\nSubject: ${subjectLine}\n\n${cleanText.slice(0, 500)}...`
        });
      } catch(e) {
        console.error('[Email Ingress] Failed to create assignment:', e);
      }
    }

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
    console.error('[Runtime Exception in Inbound Email Webhook]:', err.message);
  }
}

app.post('/api/inbound-email', processInboundEmailWebhook);
app.post('/webhook/gmail', processInboundEmailWebhook);

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
    console.error('[Titan OS Oracle] Manual Sync execution failed:', error.message);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '6.0.42',
    oracleDocsLoaded: getActiveOracleURIs().length,
    sitesCached: Array.isArray(memoryCache.sites) ? memoryCache.sites.length : 0,
    sitesTableResolved: airtableSchemaCache.sitesTable,
    sitesPrimaryField: airtableSchemaCache.sitesPrimaryField,
    reportsTableResolved: airtableSchemaCache.reportsTable
  });
});

async function resolveIdentity(speakerPhone) {
  const workers = await getCachedWorkers();
  const cleanDigits = String(speakerPhone).replace(/\D/g, '');

  const worker = workers.find(w => {
    const rawNumber = String(w.fields['WhatsApp Number'] || w.fields['Phone E164'] || w.fields['Phone'] || w.fields['Mobile'] || '').replace(/\D/g, '');
    return rawNumber && (rawNumber === cleanDigits || cleanDigits.endsWith(rawNumber) || rawNumber.endsWith(cleanDigits));
  });

  if (worker) {
    let roles = worker.fields['Role'];
    if (!roles) roles = ['Installer'];
    if (typeof roles === 'string') roles = roles.split(',').map(r => r.trim());
    if (!Array.isArray(roles)) roles = [roles];

    return {
      type: 'WORKER',
      id: worker.id,
      name: worker.fields['Full Name'] || 'Field Tech',
      roles: roles,
      workerRecord: worker,
      phone: speakerPhone,
      language: worker.fields['Language'] || 'English'
    };
  }
  return { type: 'UNKNOWN', name: 'External Caller', roles: ['Unknown'], phone: speakerPhone, language: 'English' };
}

// ====================================================================
// 7. SINGLE-THREADED ATOMIC BOOT SEQUENCE
// ====================================================================
if (!globalThis.__TITAN_SERVER_INITIALIZED__) {
  globalThis.__TITAN_SERVER_INITIALIZED__ = true;

  process.on('uncaughtException', (err) => console.error('[CRITICAL] Uncaught Exception:', err.message));
  process.on('unhandledRejection', (reason) => console.error('[CRITICAL] Unhandled Rejection:', reason));

  const keyFingerprint = CONFIG.airtable.apiKey
    ? `${CONFIG.airtable.apiKey.slice(0, 6)}...${CONFIG.airtable.apiKey.slice(-4)} (len: ${CONFIG.airtable.apiKey.length})`
    : 'MISSING';

  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V6.0.42 SINGLE-THREADED ORCHESTRATOR RUNNING`);
  console.log(`🔑 Airtable Auth: ${keyFingerprint} | Base: ${CONFIG.airtable.baseId}`);
  console.log(`====================================================================`);

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Core Engine] System online and listening on PORT ${PORT}`);
    try {
      await discoverAirtableBaseSchema(true);
      await getCachedSites(true);
      await getCachedWorkers(true);
      await getCachedContacts(true);
      await getCachedOpenAssignments(true);

      if (inventory && inventory.refreshInventoryCache) {
        await inventory.refreshInventoryCache(CONFIG);
      }

      await hydrateQBOCache();

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
      console.error('[Core Engine] Listener Error:', err.message);
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

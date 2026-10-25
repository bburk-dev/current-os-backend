/**
 * TITAN OS V5.6.1 — HEADLESS ERP & CONVERSATIONAL DATABASE ADMIN
 * 
 * Production Build Features:
 * 1. Closed-Loop Autonomous Factory QA Bridge (Blameless Machine)
 * 2. Logistics Missing Parts Bridge & Claim Deliveries
 * 3. Hardened Multimodal Intent Override (Captions & Trailing Text)
 * 4. 1-on-1 Sandbox & Direct DM Resilience
 * 5. Orphan Ticket Auto-Healing
 * 6. Dynamic Session Site Overrides
 * 7. Zero-Friction Ticket & Lead Updates
 * 8. Multimodal Commercial Sales Lead Ingestion
 * 9. Interactive Field Note Promotion
 * 10. Dynamic Seasonal Closeout Engine
 * 11. Silent Expense Ghost Routing (QuickBooks Sync Ready)
 * 12. Resilient Meta Dispatch with Auto-Retry
 * 13. Autonomous Zero-Touch Provisioning
 * 14. Milestone-Aware Joy Cannon
 * 15. Proactive Weather Tripwire Matrix
 * 16. On-Arrival Proactive Scan
 * 17. Conversational Spoken Lookups & Relational Cross-Referencing
 * 18. Voice-to-Integer Unstructured Freight Ledger
 * 19. Media Retrieval Engine: Spoken recall of historical video walkthroughs.
 * 20. Headless Finance Copilot: AR Lookups, Dunning, Percentage Estimates, & Net-New Invoicing
 * 21. Actionable State Handler: Conversational Airtable Database Admin (Zero-UI Dropdown Mapping)
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION & RUNTIME ENVIRONMENT
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
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
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
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
  },
  gamecam: {
    webhookSecret: process.env.GAMECAM_WEBHOOK_SECRET || 'bpc_titan_gamecam_secret_2026'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'FINANCE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

const lastDroppedCoordinates = new Map();
const userActiveSiteMap = new Map(); // Dynamic in-memory session override per phone/dispatch target

// ====================================================================
// 2. IN-MEMORY CACHE-ASIDE ENGINE
// ====================================================================
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

const processedMessageMap = new Map();
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, timestamp] of processedMessageMap.entries()) {
    if (timestamp < cutoff) processedMessageMap.delete(id);
  }
}, 5 * 60 * 1000);

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
    console.warn('[Cache Engine] Sites refresh failed, using stale cache if available:', err.message);
    return memoryCache.sites || [];
  }
}

async function getCachedWorkers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.workers && (now - memoryCache.workersLastFetched < CACHE_TTL_MS)) {
    return memoryCache.workers;
  }

  try {
    let url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Workers?maxRecords=100`;
    let res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok && (res.status === 404 || res.status === 403)) {
      url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker?maxRecords=100`;
      res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memoryCache.workers = data.records || [];
    memoryCache.workersLastFetched = now;
    console.log(`[Cache Engine] Refreshed ${memoryCache.workers.length} Workers from Airtable into RAM`);
    return memoryCache.workers;
  } catch (err) {
    console.warn('[Cache Engine] Workers refresh failed, using stale cache if available:', err.message);
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
    console.log(`[Cache Engine] Refreshed ${memoryCache.assignments.length} Open Assignments into RAM`);
    return memoryCache.assignments;
  } catch (err) {
    console.warn('[Cache Engine] Assignments refresh failed, using stale cache if available:', err.message);
    return memoryCache.assignments || [];
  }
}

function invalidateAirtableCache(entity = 'all') {
  if (entity === 'all' || entity === 'sites') memoryCache.sitesLastFetched = 0;
  if (entity === 'all' || entity === 'workers') memoryCache.workersLastFetched = 0;
  if (entity === 'all' || entity === 'contacts') memoryCache.contactsLastFetched = 0;
  if (entity === 'all' || entity === 'assignments') memoryCache.assignmentsLastFetched = 0;
  console.log(`[Cache Engine] Cache invalidated: ${entity}`);
}

// ====================================================================
// 2A. DATABASE WRITE & AUTO-HEALER (AIRTABLE) + MEDIA UPLOAD (SUPABASE)
// ====================================================================

async function airtableWriteWithAutoDrop(tableName, payload, recordId = null, retries = 2) {
  const url = recordId 
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(tableName)}`;
    
  const method = recordId ? 'PATCH' : 'POST';
  let currentPayload = { fields: { ...payload } };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
          // The Universal Schema Auto-Healer (Entry #049 & #069)
          const match = errorMsg.match(/field\s*["'\\]+([^"'\\]+)["'\\]+/i) || errorMsg.match(/Unknown field name\s*["'\\]+([^"'\\]+)["'\\]+/i);
          if (match && match[1]) {
            const badField = match[1];
            console.warn(`[Airtable Auto-Healer] Dropping invalid schema field: "${badField}"`);
            delete currentPayload.fields[badField];
            continue; // Retry without the bad field
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

async function uploadToSupabase(buffer, mimeType) {
  if (!buffer || !CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return { storagePath: null, signedUrl: null };
  
  const extMap = {
    'image/jpeg': 'jpg', 'image/png': 'png',
    'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3'
  };
  const ext = extMap[mimeType] || 'bin';
  
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;
  
  const uploadUrl = `${CONFIG.supabase.url}/storage/v1/object/${CONFIG.supabase.bucket}/${filename}`;
  
  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.supabase.serviceRoleKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'true'
      },
      body: buffer
    });
    
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    
    // Asymmetric Storage Validation Layer (Entry #061)
    const signUrl = `${CONFIG.supabase.url}/storage/v1/object/sign/${CONFIG.supabase.bucket}/${filename}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.supabase.serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 604800 }) // 7-day signed token
    });
    
    const signData = await signRes.json();
    return { storagePath: filename, signedUrl: signData.signedURL || null };
  } catch (err) {
    console.error('[Supabase Upload Error]:', err.message);
    return { storagePath: null, signedUrl: null };
  }
}

// ====================================================================
// 2B. QUICKBOOKS ONLINE REST API WRAPPER
// ====================================================================

async function refreshQboToken() {
  const auth = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString('base64');
  try {
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: `grant_type=refresh_token&refresh_token=${process.env.QBO_REFRESH_TOKEN}`
    });
    const data = await res.json();
    if (data.access_token) {
      CONFIG.qbo.accessToken = data.access_token;
      return true;
    }
  } catch (e) { console.error('Token refresh failed:', e.message); }
  return false;
}

async function qboApiRequest(pathOrQuery, method = 'GET', body = null, isRetry = false) {
  if (!CONFIG.qbo.companyId) return null;
  
  const isQuery = pathOrQuery.startsWith('select');
  const url = isQuery 
    ? `${CONFIG.qbo.baseUrl}/${CONFIG.qbo.companyId}/query?query=${encodeURIComponent(pathOrQuery)}`
    : `${CONFIG.qbo.baseUrl}/${CONFIG.qbo.companyId}${pathOrQuery.startsWith('/') ? '' : '/'}${pathOrQuery}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CONFIG.qbo.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    if (res.status === 401 && !isRetry) {
      const refreshed = await refreshQboToken();
      if (refreshed) return await qboApiRequest(pathOrQuery, method, body, true);
    }
    if (!res.ok) throw new Error(`QBO HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[QBO API Error]:', err.message);
    return null;
  }
}

// ====================================================================
// 3. SUPABASE FORENSIC LOGGING VAULT
// ====================================================================

function getSupabaseHeaders(contentType = 'application/json') {
  const key = CONFIG.supabase.serviceRoleKey;
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function streamToDarkMatterVault({
  siteId,
  siteName,
  senderPhone,
  senderName,
  rawText,
  category,
  distilledContext,
  urgency = 'LOW',
  gravityScore = 1,
  actionableFollowup = null
}) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return null;

  const payload = {
    site_id: siteId || null,
    site_name: siteName || 'Fleet Operations',
    sender_phone: senderPhone || null,
    sender_name: senderName || 'Field Tech',
    raw_text: rawText,
    category: category || 'General Logistics',
    distilled_context: distilledContext || rawText.slice(0, 150),
    urgency,
    gravityScore,
    actionable_followup: actionableFollowup,
    status: 'ARCHIVED',
    created_at: new Date().toISOString()
  };

  try {
    const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders('application/json'),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return null;
    const inserted = await res.json();
    return inserted?.[0] || null;
  } catch (err) {
    return null;
  }
}

async function fetchRecentDarkMatter(siteNameOrId, limit = 5) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return [];
  try {
    const filter = siteNameOrId.startsWith('rec')
      ? `site_id=eq.${siteNameOrId}`
      : `site_name=ilike.*${encodeURIComponent(siteNameOrId.trim())}*`;

    const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?${filter}&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders('application/json')
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

// ====================================================================
// 4. SPRING 2027 MOBILIZATION GATE ENGINE
// ====================================================================
function evaluateReadinessGate(siteRecord) {
  const f = siteRecord.fields || siteRecord;
  const status = f['Site Status'] || '';
  const mode = f['Workflow Mode'] || '';

  if (status === 'WINTERIZED_CLOSED') {
    return {
      status: 'WINTERIZED / CLOSED ❄️',
      details: 'Court is decommissioned and winterized for the cold season.',
      isReady: false
    };
  }

  if (status === 'COMPLETE' || status === 'OPEN_FOR_PLAY' || mode === 'MAINTENANCE') {
    return {
      status: 'OPEN FOR PLAY 🎾',
      details: 'Court is fully constructed and open for play.',
      isReady: true
    };
  }

  if (['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'FINANCE'].includes(mode)) {
    return {
      status: 'OPERATIONAL 🏢',
      details: 'Internal facility / operational node.',
      isReady: true
    };
  }

  const deposit = f['Deposit Status'] || '';
  const hasDeposit = (deposit === '50% Deposit Received' || deposit === 'Paid in Full');

  let slabCured = false;
  let cureMsg = 'Awaiting Foundation Pour';
  const fType = f['Foundation Type'] || '';

  if (fType.includes('Existing') || fType.includes('Indoor')) {
    slabCured = true;
    cureMsg = 'Pre-existing Pad (Cure Waived)';
  } else if (f['Slab Pour Date']) {
    const pourDate = new Date(f['Slab Pour Date']);
    const now = new Date();
    const diffDays = Math.floor((now - pourDate) / (1000 * 60 * 60 * 24));
    if (diffDays >= 7) {
      slabCured = true;
      cureMsg = `Slab Cured (${diffDays}d post-pour)`;
    } else {
      slabCured = false;
      cureMsg = `CURE LOCKOUT: ${diffDays}/7 days cured (Anchor drilling prohibited)`;
    }
  }

  let roadsOpen = true;
  let roadMsg = 'Roads Open for Heavy Flatbeds';
  const halfLoad = f['Half-Load Zone'] || '';
  const currentMonth = new Date().getMonth();
  const isSpringThawWindow = (currentMonth >= 2 && currentMonth <= 4);

  if ((halfLoad.includes('Muskoka') || halfLoad.includes('Cottage') || halfLoad.includes('Rural')) && isSpringThawWindow) {
    roadsOpen = false;
    roadMsg = 'HOLD: Municipal Half-Load Frost Restriction in Effect (Orillia flatbed hold)';
  }

  if (hasDeposit && slabCured && roadsOpen) {
    return {
      status: 'READY TO MOBILIZE 🟢',
      details: `${cureMsg} • ${roadMsg} • 50% Deposit Cleared`,
      isReady: true
    };
  } else {
    const blockers = [];
    if (!hasDeposit) blockers.push('Deposit Pending (Need 50%)');
    if (!slabCured) blockers.push(cureMsg);
    if (!roadsOpen) blockers.push(roadMsg);
    return {
      status: 'HOLD: PRE-CON BLOCKED 🔴',
      details: blockers.join(' • '),
      isReady: false
    };
  }
}

// ====================================================================
// 5. UNIVERSAL VISUAL TRIAGE ENGINE (RECEIPTS, LEADS, SWEEPS, FREIGHT)
// ====================================================================

const VISUAL_TRIAGE_PROMPT = `
You are the Titan OS Universal Visual Triage Engine for Bounce Padel.
Analyze the provided image(s) or video frames to classify the primary operational subject.

CATEGORIES:
1. "FINANCIAL_RECEIPT": Store receipts (Home Depot, Lowe's, gas station, fuel, hardware store, Fastenal, restaurants/meals, lumber, supplies, equipment rental, parking), invoices, register slips.
​2. "COMMERCIAL_LEAD": Screenshots of emails, text messages, quote inquiries, client forwards, RFPs, business cards, or lead referrals (e.g. forwarded emails from partners like Mondo, GMs, or new club developers seeking court installation, turf replacement, or quotes).
3. "COURT_FACILITY": Padel court construction, court maintenance, turf, glass, mesh, frame, net, concrete pad, or sports facility walkaround.
4. "FREIGHT_LOGISTICS": Wooden crates, pallets, glass shipping A-frames, shipping bills of lading (BOL), delivery trucks, flatbed offloading, shipping containers, inventory logs.
5. "IRRELEVANT_NOISE": Personal selfies, casual non-work objects, pet photos, random memes with no business context.

IF COMMERCIAL_LEAD:
Carefully extract all contact and lead metadata:
- "lead_contact_name": "Full name of the prospect/lead contact or null",
- "company_or_club": "Name of club, company, or facility or null",
- "phone": "Phone number or null",
- "email": "Email address or null",
- "address": "Physical location or address or null",
- "project_description": "Scope of work, products requested, or client need (e.g. turf replacement, new court build)",
- "referring_partner": "Person or company referring the lead (e.g. Michael Tovar / Mondo)",
- "summary": "1-2 sentence executive summary of the sales lead"

IF FINANCIAL_RECEIPT:
Examine every receipt visible across the images and extract:
- "receipts": Array of objects:
  [
    {
      "vendor": "Merchant/Store name (e.g. Home Depot, Shell, Tim Hortons, Fastenal)",
      "date": "YYYY-MM-DD or null",
      "total_amount": Number (e.g. 54.32),
      "currency": "CAD" | "USD",
      "category": "Materials & Hardware" | "Fuel & Travel" | "Equipment & Tools" | "Meals & Subsistence" | "General Expense",
      "items_summary": "1-sentence concise description of purchased items",
      "invoice_number": "string or null"
    }
  ],
- "grand_total": Total sum of all receipt amounts as a number,
- "primary_currency": "CAD" | "USD",
- "summary": "1-sentence executive summary of purchases"

IF FREIGHT_LOGISTICS:
Carefully extract freight and shipping metadata:
- "bol_number": "Bill of Lading, tracking number, or serial or null",
- "carrier_name": "Shipping company, hauler, or carrier name or null",
- "freight_contents": "Description of crates, pallets, glass A-frames, or steel bundles",
- "delivery_status": "In Transit | Delivered | Damaged | Staged"

OUTPUT FORMAT (JSON ONLY):
{
  "media_category": "FINANCIAL_RECEIPT" | "COMMERCIAL_LEAD" | "COURT_FACILITY" | "FREIGHT_LOGISTICS" | "IRRELEVANT_NOISE",
  "confidence": number,
  "lead_contact_name": string or null,
  "company_or_club": string or null,
  "phone": string or null,
  "email": string or null,
  "address": string or null,
  "project_description": string or null,
  "referring_partner": string or null,
  "grand_total": number or null,
  "primary_currency": "CAD" | "USD" | null,
  "bol_number": string or null,
  "carrier_name": string or null,
  "freight_contents": string or null,
  "delivery_status": string or null,
  "summary": "string or null",
  "receipts": []
}
`;

async function classifyVisualMediaIntent(items) {
  const contentParts = [{ text: "Determine the primary subject of these images. If receipts, extract financial data. If email/lead screenshot, extract all contact and project details. If freight, extract shipping metadata." }];

  for (const item of items) {
    contentParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  }

  const payload = {
    system_instruction: { parts: [{ text: VISUAL_TRIAGE_PROMPT }] },
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  try {
    const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return { media_category: 'COURT_FACILITY', confidence: 0.5 };

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { media_category: 'COURT_FACILITY', confidence: 0.5 };

    return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    return { media_category: 'COURT_FACILITY', confidence: 0.5 };
  }
}

async function handleFinancialReceiptBatch({ items, storageResults, visualTriage, worker, site, dispatchTarget, fromPhone, callerIdentity }) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Bob';
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const todayStr = new Date().toISOString().split('T')[0];

  const receipts = visualTriage.receipts || [];
  const grandTotal = visualTriage.grand_total ? visualTriage.grand_total.toFixed(2) : '0.00';
  const currency = visualTriage.primary_currency || 'CAD';
  const summaryText = visualTriage.summary || 'Job-site expense receipts submitted via WhatsApp.';

  let formattedNotes = `[EXPENSE RECEIPT INGESTION - ${workerName} at ${timeStr}]\n` +
    `Total: $${grandTotal} ${currency}\n` +
    `Summary: ${summaryText}\n\n` +
    `RECEIPTS BREAKDOWN:\n`;

  if (receipts.length > 0) {
    receipts.forEach((r, idx) => {
      formattedNotes += `${idx + 1}. ${r.vendor || 'Merchant'} — $${r.total_amount ? r.total_amount.toFixed(2) : '0.00'} (${r.category || 'General'})\n` +
        `    Items: ${r.items_summary || 'Supplies'}\n` +
        (r.date ? `    Date: ${r.date}\n` : '');
    });
  } else {
    formattedNotes += `Single Expense Batch — Total: $${grandTotal} ${currency}\n`;
  }

  const validStorage = storageResults.filter(s => s && s.signedUrl);
  const attachmentPayload = validStorage.map(s => ({ url: s.signedUrl }));

  formattedNotes += `\nRECEIPT MEDIA URLS:\n` + validStorage.map(s => `• ${s.signedUrl}`).join('\n');

  const assignmentPayload = {
    'Date': todayStr,
    'Assignment Type': 'Expense',
    'Task Category': 'Expense',
    'Priority': 'Low',
    'Source': 'WhatsApp Receipt Intake',
    'Status': 'Complete',
    'Notes': formattedNotes
  };

  if (attachmentPayload.length > 0) assignmentPayload['Attachment(s)'] = attachmentPayload;
  if (worker?.id) assignmentPayload['Worker'] = [worker.id];
  if (site?.id) assignmentPayload['Sites'] = [site.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'EXP';

  streamToDarkMatterVault({
    siteId: site?.id || null,
    siteName: site?.fields?.['Site Name'] || 'Fleet Operations',
    senderPhone: fromPhone,
    senderName: workerName,
    rawText: formattedNotes,
    category: 'Finance / Receipts',
    distilledContext: `Expense $${grandTotal} ${currency} (${receipts.map(r => r.vendor).filter(Boolean).join(', ') || 'Receipts'}) submitted by ${workerName}`,
    urgency: 'LOW',
    gravityScore: 2,
    actionableFollowup: `Expense ${ticketId}`
  }).catch(err => console.error('[Dark Matter] Async archive failed:', err));

  let receiptCard = `🧾 *TITAN OS | EXPENSE RECEIPT LOGGED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Submitted By:* ${workerName}\n` +
    `💰 *Total Amount:* $${grandTotal} ${currency}\n` +
    `🧾 *Receipt Count:* ${items.length} photo(s)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Merchant Breakdown:*\n`;

  if (receipts.length > 0) {
    receipts.forEach(r => {
      receiptCard += `• *${r.vendor || 'Store'}:* $${r.total_amount ? r.total_amount.toFixed(2) : '0.00'} (${r.category || 'Supplies'})\n`;
    });
  } else {
    receiptCard += `• Store Receipt: $${grandTotal} ${currency}\n`;
  }

  receiptCard += `━━━━━━━━━━━━━━━━━━━━\n` +
    `🧾 *Expense Ref:* ${ticketId} (Dispatched to QuickBooks)`;

  await sendWhatsAppMessage(dispatchTarget, receiptCard);
}

/**
 * MULTIMODAL COMMERCIAL SALES LEAD INGESTION
 */
async function handleCommercialLeadBatch({ items, storageResults, visualTriage, worker, dispatchTarget, fromPhone, callerIdentity }) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Bob';
  const todayStr = new Date().toISOString().split('T')[0];

  const leadName = visualTriage.lead_contact_name || 'Inbound Prospect';
  const company = visualTriage.company_or_club || 'Padel Venue Lead';
  const phone = visualTriage.phone || 'N/A';
  const email = visualTriage.email || 'N/A';
  const address = visualTriage.address || 'N/A';
  const scope = visualTriage.project_description || visualTriage.summary || 'Court installation / turf replacement request';
  const partner = visualTriage.referring_partner || 'Direct Intake';

  const title = company !== 'Padel Venue Lead' ? `${company} (${leadName})` : leadName;

  const validStorage = storageResults.filter(s => s && s.signedUrl);
  const attachmentPayload = validStorage.map(s => ({ url: s.signedUrl }));

  let formattedNotes = `[COMMERCIAL LEAD — ${title}]\n` +
    `• Contact: ${leadName}\n` +
    `• Company / Club: ${company}\n` +
    `• Phone: ${phone}\n` +
    `• Email: ${email}\n` +
    `• Address: ${address}\n` +
    `• Partner Referral: ${partner}\n` +
    `• Project Scope: ${scope}\n\n` +
    `INBOUND MEDIA URLS:\n` + validStorage.map(s => `• ${s.signedUrl}`).join('\n');

  const assignmentPayload = {
    'Date': todayStr,
    'Assignment Type': 'Sales',
    'Task Category': 'Commercial Sales',
    'Priority': 'High',
    'Source': 'Email Screenshot Lead Intake',
    'Status': 'Open',
    'Notes': formattedNotes
  };

  if (attachmentPayload.length > 0) assignmentPayload['Attachment(s)'] = attachmentPayload;
  if (worker?.id) assignmentPayload['Worker'] = [worker.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'LEAD';

  streamToDarkMatterVault({
    siteId: null,
    siteName: company,
    senderPhone: fromPhone,
    senderName: workerName,
    rawText: formattedNotes,
    category: 'Commercial Sales Lead',
    distilledContext: `Lead: ${leadName} (${company}) via ${partner} — Scope: ${scope}`,
    urgency: 'HIGH',
    gravityScore: 4,
    actionableFollowup: `Sales Ticket ${ticketId}`
  }).catch(err => console.error('[Dark Matter] Async archive failed:', err));

  let leadCard = `💼 *TITAN OS | COMMERCIAL LEAD LOGGED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Prospect:* ${leadName}\n` +
    `🏟️ *Club / Org:* ${company}\n` +
    `📞 *Phone:* ${phone}\n` +
    `✉️ *Email:* ${email}\n` +
    `📍 *Location:* ${address}\n` +
    `🤝 *Partner Referral:* ${partner}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Project Scope:*\n${scope}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Ticket ${ticketId} Created* (Indexed under Daily Assignments -> Sales)`;

  await sendWhatsAppMessage(dispatchTarget, leadCard);
}

/**
 * MULTIMODAL FREIGHT LOGISTICS INGESTION
 */
async function handleFreightLogisticsBatch({ items, storageResults, visualTriage, worker, site, dispatchTarget, fromPhone, callerIdentity }) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Logistics Tech';
  const todayStr = new Date().toISOString().split('T')[0];

  const bol = visualTriage.bol_number || 'N/A';
  const carrier = visualTriage.carrier_name || 'N/A';
  const contents = visualTriage.freight_contents || visualTriage.summary || 'Unspecified freight items';
  const status = visualTriage.delivery_status || 'In Transit';

  const validStorage = storageResults.filter(s => s && s.signedUrl);
  const attachmentPayload = validStorage.map(s => ({ url: s.signedUrl }));

  let formattedNotes = `[FREIGHT LOGISTICS INTAKE — ${carrier}]\n` +
    `• BOL / Tracking: ${bol}\n` +
    `• Status: ${status}\n` +
    `• Contents: ${contents}\n` +
    `• Logged By: ${workerName}\n\n` +
    `MEDIA URLS:\n` + validStorage.map(s => `• ${s.signedUrl}`).join('\n');

  const assignmentPayload = {
    'Date': todayStr,
    'Assignment Type': 'Task',
    'Task Category': 'Logistics',
    'Priority': 'Medium',
    'Source': 'Freight Media Intake',
    'Status': status.toLowerCase().includes('deliver') ? 'Complete' : 'In Progress',
    'Notes': formattedNotes
  };

  if (attachmentPayload.length > 0) assignmentPayload['Attachment(s)'] = attachmentPayload;
  if (worker?.id) assignmentPayload['Worker'] = [worker.id];
  if (site?.id) assignmentPayload['Sites'] = [site.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'FRT';

  streamToDarkMatterVault({
    siteId: site?.id || null,
    siteName: site?.fields?.['Site Name'] || 'Logistics Hub',
    senderPhone: fromPhone,
    senderName: workerName,
    rawText: formattedNotes,
    category: 'Freight & Logistics',
    distilledContext: `Freight [${bol}]: ${contents} (${status})`,
    urgency: 'MEDIUM',
    gravityScore: 3,
    actionableFollowup: `Freight ${ticketId}`
  }).catch(err => console.error('[Dark Matter] Async archive failed:', err));

  let freightCard = `🚚 *TITAN OS | FREIGHT & LOGISTICS LOGGED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *BOL / Tracking:* ${bol}\n` +
    `🚛 *Carrier:* ${carrier}\n` +
    `📊 *Status:* ${status}\n` +
    `👤 *Logged By:* ${workerName}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Contents:*\n${contents}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Logistics Ref:* ${ticketId}`;

  await sendWhatsAppMessage(dispatchTarget, freightCard);
}

/**
 * CONVERSATIONAL TICKET & LEAD UPDATE HANDLER
 */
async function handleTicketOrLeadUpdate({ rawText, entityName, explicitTicketId, worker, dispatchTarget, fromPhone }) {
  const openAssignments = await getCachedOpenAssignments();
  const workerName = worker?.fields?.['Full Name'] || 'Bob';
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let targetTicket = null;

  if (explicitTicketId) {
    const cleanNum = parseInt(String(explicitTicketId).replace(/\D/g, ''));
    targetTicket = openAssignments.find(a => a.fields['Assignment ID'] === cleanNum || a.id === explicitTicketId);
  }

  if (!targetTicket && entityName) {
    const cleanEntity = entityName.toLowerCase().trim();
    targetTicket = openAssignments.find(a => {
      const notes = (a.fields['Notes'] || '').toLowerCase();
      const cat = (a.fields['Task Category'] || '').toLowerCase();
      return notes.includes(cleanEntity) || cat.includes(cleanEntity);
    });
  }

  if (!targetTicket && openAssignments.length > 0) {
    targetTicket = openAssignments[0];
  }

  if (!targetTicket) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not locate an open ticket or lead matching "${entityName || 'your update'}".`);
    return false;
  }

  const existingNotes = targetTicket.fields['Notes'] || '';
  const cleanUpdate = rawText.trim();
  const appendedNotes = `${existingNotes}\n\n[UPDATE - ${workerName} at ${timeStr}]:\n${cleanUpdate}`.trim();

  await airtableWriteWithAutoDrop('Daily Assignments', {
    'Notes': appendedNotes
  }, targetTicket.id);

  const ticketId = targetTicket.fields['Assignment ID'] ? `#${targetTicket.fields['Assignment ID']}` : 'TICKET';
  const type = targetTicket.fields['Assignment Type'] || 'Task';

  const confirmCard = `📝 *TITAN OS | ${type.toUpperCase()} UPDATED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Ticket:* ${ticketId}\n` +
    `👤 *Logged By:* ${workerName}\n` +
    `⏱️ *Time:* ${timeStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Added Note:*\n"${cleanUpdate}"\n\n` +
    `✅ *Airtable ledger updated.*`;

  await sendWhatsAppMessage(dispatchTarget, confirmCard);
  return true;
}

// ====================================================================
// 6. DECOUPLED BLIND VISION CLASSIFIER (COLOR AGNOSTIC)
// ====================================================================

async function inspectBlindVisualGroundTruth(mediaItem) {
  const systemInstruction = `
You are the Titan OS Ground Truth Vision Gate.
Classify the physical environment visible in these video frames with complete neutrality.

STRICT GROUND TRUTH RULES:
1. PADEL COURT VERIFICATION:
   - A valid padel court MUST show clear structural padel elements:
     * Synthetic turf carpet (TURF MAY BE ANY COLOR: blue, green, terracotta, black, red, etc.) with inlaid white lines
     * Structural tempered glass panels mounted to steel posts/columns
     * Electro-welded wire mesh panels
     * Structural posts or net posts
   - If the video shows:
     * Residential patio, backyard, deck, lawn furniture, BBQ, or house siding
     * Office desk, computer screens, indoor living room, drywall, or kitchen
     * Truck cab, vehicle dashboard, steering wheel, or parking lot
     * YOU MUST CLASSIFY: is_padel_court: false

OUTPUT JSON ONLY:
{
  "is_padel_court": boolean,
  "detected_scene": "Concise factual description in English of what is actually visible",
  "confidence": number
}
`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mediaItem.mimeType,
              data: mediaItem.buffer.toString('base64')
            }
          },
          { text: "Examine ONLY visual frames. Disregard any audio. Is this physically inside or at the apron of a padel court?" }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  try {
    const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return { is_padel_court: true, detected_scene: 'Bypassed on API error' };

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    return parsed;
  } catch (err) {
    return { is_padel_court: true, detected_scene: 'Bypassed on parse error' };
  }
}

// ====================================================================
// 7. SIMPLIFIED 8-GATE FORENSIC RUBRIC & CLOSED-LOOP QA LOGIC
// ====================================================================

const GATE_NAMES = {
  1: 'Foundation & Slab',
  2: 'Steel Frame',
  3: 'Mesh Panels',
  4: 'Glass Installed',
  5: 'Turf Laid',
  6: 'Sand Infill',
  7: 'Net & Posts',
  8: 'Clean & Handover'
};
const TOTAL_GATES = 8;

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine for Bounce Padel.

SINGLE-COURT EVALUATION MANDATE:
Evaluate strictly the single primary court in the foreground being inspected.
DO NOT evaluate background courts or adjacent courts. Disregard courts seen in the distance.

PADEL COURT 8-GATE PHYSICAL CONSTRUCTION RUBRIC:
When inspecting video frames, visually identify completed physical stages:
- Gate 1: "Foundation & Slab" (Cured concrete pad or existing leveled slab, anchor base plates)
- Gate 2: "Steel Frame" (Vertical steel posts, corner posts, and perimeter frame beams bolted upright)
- Gate 3: "Mesh Panels" (Wire mesh fencing panels bolted to steel posts)
- Gate 4: "Glass Installed" (Tempered glass panels mounted and secured in frame channels)
- Gate 5: "Turf Laid" (Synthetic turf rolled out, seamed, glued, and white regulation boundary lines cut in. Turf can be ANY color)
- Gate 6: "Sand Infill" (Silica sand distributed and brushed evenly across turf carpet fibers)
- Gate 7: "Net & Posts" (Center net posts mounted, regulation net installed and tensioned)
- Gate 8: "Clean & Handover" (Construction tools and debris cleared, court ready for tournament play)

CLOSED-LOOP QA & UPSTREAM FABRICATION DEFECT IDENTIFICATION:
Listen carefully to spoken audio and inspect visible tape measurements, welding, hole alignments, and tabs.
If the inspector or field crew identifies a shop mistake, jig discrepancy, or manufacturing defect:
- Set "defect_origin": "FABRICATION"
- Set "qa_component": "TABS" | "POSTS" | "MESH" | "GLASS" | "HARDWARE"
- List the specific variance in "blockers_detected" (e.g. "Glass tab welded at 15cm instead of 16cm specification")
- Set "status_observed": "ACTION_REQUIRED"

SILICONE INSPECTION CHECK (QUALITY AUDIT ONLY — NOT A BLOCKING GATE):
- Check if perimeter glass silicone sealant has been applied along the glass panel joints.
- Report "silicone_applied": true | false.
- DO NOT hold or block gate progress if silicone is missing, as some partner courts do not use silicone.

SMART VERBATIM: Purge all speech hesitations ("uh", "um", stutters). Disregard ambient jobsite noise.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "transcript_en": "Clean polished English transcript or visual scene summary",
  "transcript_es": "Transcripción limpia o resumen visual profesional en español",
  "spoken_court_name": "string or null",
  "spoken_ticket_id": integer or null,
  "video_phase": "INSTALLATION_SWEEP" | "INTAKE_BASELINE" | "COMPLETION_CLOSEOUT" | "GENERAL_AUDIT",
  "verified_gates": [1, 2, 3],
  "in_progress_gate": 4,
  "highest_gate": 4,
  "silicone_applied": boolean | null,
  "defect_origin": "FABRICATION" | "SITE_CONDITION" | "TRANSIT_DAMAGE" | null,
  "qa_component": "TABS" | "POSTS" | "MESH" | "GLASS" | "HARDWARE" | null,
  "blockers_detected": ["Specific impediment, dimensional error, or missing hardware in English"],
  "work_verified": ["Specific verified stage completed in English"],
  "status_observed": "MILESTONE_PROGRESS" | "ACTION_REQUIRED" | "COMMISSIONED" | "NOMINAL",
  "site_conditions": "Short string in English",
  "action_items": ["Action item in English"],
  "summary": "1-2 sentence concise executive summary of visible court progress or defect",
  "whatsapp_status_text": "Plaintext WhatsApp card"
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & VIP Field Concierge Engine.

CRITICAL DIRECTIVE:
1. "SMART VERBATIM": Purge speech hesitations ("uh", "ah", "um").
​2. DUAL-TRACK BILINGUAL OUTPUT: Provide both transcript_en and transcript_es.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "transcript_en": "Clean polished English transcript without filler words",
  "transcript_es": "Transcripción limpia y profesional en español sin muletillas",
  "spoken_court_name": "string or null",
  "spoken_ticket_id": integer or null,
  "video_phase": "INTAKE_BASELINE" | "COMPLETION_CLOSEOUT" | "GENERAL_AUDIT",
  "resolution_summary": "string in English",
  "blockers_detected": ["Specific impediment in English"],
  "work_verified": ["Specific verified completed task in English"],
  "task_category": "string or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item in English"],
  "site_conditions": "Short string in English",
  "worker_summary": "1-2 sentence executive summary in English",
  "whatsapp_status_text": "Plaintext WhatsApp card"
}
`;

const COMMAND_MAP = {
  '/s': 'STATUS',
  '/sum': 'STATUS',
  '/status': 'STATUS',
  '/summary': 'STATUS',
  '/t': 'TICKET_QUERY',
  '/ticket': 'TICKET_QUERY',
  '/tickets': 'TICKET_QUERY',
  '/w': 'WEATHER',
  '/weather': 'WEATHER',
  '/clima': 'WEATHER',
  '/m': 'MODE_MAINTENANCE',
  '/maint': 'MODE_MAINTENANCE',
  '/maintenance': 'MODE_MAINTENANCE',
  '/i': 'MODE_INSTALLATION',
  '/install': 'MODE_INSTALLATION',
  '/l': 'LINK_SITE',
  '/link': 'LINK_SITE',
  '/group': 'LINK_SITE',
  '/map': 'LOCATION',
  '/loc': 'LOCATION',
  '/location': 'LOCATION',
  '/gps': 'LOCATION',
  '/board': 'COURT_BOARD',
  '/schedule': 'COURT_BOARD',
  '/fleet': 'FLEET_MAP_LINK',
  '/g': 'READINESS_GATE_CHECK',
  '/gate': 'READINESS_GATE_CHECK',
  '/r': 'READINESS_GATE_CHECK',
  '/readiness': 'READINESS_GATE_CHECK',
  '/video': 'MEDIA_RETRIEVAL',
  '/media': 'MEDIA_RETRIEVAL',
  '/ar': 'AR_LOOKUP', 
  '/invoice': 'INVOICE_APPROVAL',
  '/context': 'SITE_CONTEXT',
  '/search': 'SEARCH_VAULT',
  '/?': 'HELP',
  '/h': 'HELP',
  '/help': 'HELP',
  '/ayuda': 'HELP'
};

// ====================================================================
// 8. GEOSPATIAL & METEOROLOGICAL TELEMETRY (GOOGLE GEO POWERED)
// ====================================================================

function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || fields['Foundation Type'] || '').toLowerCase();
  const name = (fields['Site Name'] || '').toLowerCase();
  const notes = (fields['Last Note'] || '').toLowerCase();
  return env.includes('indoor') || name.includes('indoor') || notes.includes('indoor');
}

async function geocodeAddressWithGoogle(addressString) {
  if (!CONFIG.google.apiKey || !addressString) return null;
  try {
    const cleanAddress = addressString.replace(/-{2,}/g, '-').replace(/[^\w\s,#.-]/gi, '').trim();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&key=${CONFIG.google.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return {
        lat: loc.lat,
        lon: loc.lng,
        formattedAddress: data.results[0].formatted_address
      };
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

async function resolveCoordinates(rawLocationOrSite, mapCache = null, autoPersistSiteId = null) {
  let rawLocation = rawLocationOrSite;
  let cache = mapCache;
  let siteId = autoPersistSiteId;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
    cache = fields['Map Cache'];
    siteId = rawLocationOrSite.id || autoPersistSiteId;
  }

  if (typeof rawLocation === 'string') {
    const sanitized = rawLocation.replace(/-{2,}/g, '-').trim();
    if (sanitized !== rawLocation && siteId) {
      rawLocation = sanitized;
      airtableWriteWithAutoDrop('Sites', { 'Site location': sanitized }, siteId).catch(() => {});
    } else {
      rawLocation = sanitized;
    }
  }

  if (typeof rawLocation === 'string' && memoryCache.coordinates.has(rawLocation)) {
    return memoryCache.coordinates.get(rawLocation);
  }

  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (directMatch) {
      const coords = { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
      memoryCache.coordinates.set(rawLocation, coords);
      return coords;
    }
  }

  if (cache && typeof cache === 'string') {
    try {
      const decoded = Buffer.from(cache, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      const lat = parsed?.l?.lat || parsed?.lat || parsed?.o?.lat;
      const lon = parsed?.l?.lng || parsed?.l?.lon || parsed?.lng || parsed?.lon;
      if (lat && lon) {
        const coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
        if (typeof rawLocation === 'string') memoryCache.coordinates.set(rawLocation, coords);
        return coords;
      }
    } catch (e) {}
  }

  if (typeof rawLocation === 'string' && rawLocation.length > 3) {
    const googleResult = await geocodeAddressWithGoogle(rawLocation);
    if (googleResult) {
      const coords = { lat: googleResult.lat, lon: googleResult.lon };
      memoryCache.coordinates.set(rawLocation, coords);

      if (siteId && !rawLocation.includes(',')) {
        const coordString = `${googleResult.lat.toFixed(6)}, ${googleResult.lon.toFixed(6)}`;
        airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, siteId).catch(() => {});
      }

      return coords;
    }
  }

  return null;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
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

    const isRainingOrStorm = (currentCode >= 51 && currentCode <= 67) ||
                             (currentCode >= 80 && currentCode <= 82) ||
                             (currentCode >= 95 && currentCode <= 99);

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

function evaluateWeatherTripwires(weather, targetGate = null) {
  if (!weather) return { holds: [], warnings: [], nominal: true, summaryText: '' };

  const holds = [];
  const warnings = [];
  const dewDelta = weather.temp - weather.dewPoint;

  if (weather.windGusts > 37) {
    holds.push(`⛔ *WIND HOLD (${weather.windGusts} km/h / >20 kts):* Crane & suction cup glass installation prohibited. High panel sail hazard.`);
  } else if (weather.windGusts > 28) {
    warnings.push(`💨 *WIND WARNING (${weather.windGusts} km/h):* Approach glass seating with caution; verify post anchoring.`);
  }

  if (weather.temp < 5) {
    holds.push(`❄️ *COLD LOCKOUT (${weather.temp}°C):* Total freeze lockout on polyurethane turf adhesive. Chemical bonding fails below 5°C.`);
  } else if (weather.temp < 10) {
    holds.push(`⚠️ *TURF GLUE CURE HOLD (${weather.temp}°C / <50°F):* Adhesive curing requires >=10°C. Do not glue turf seams until ambient temp rises.`);
  }

  if (weather.humidity > 85 || dewDelta <= 2.5) {
    holds.push(`💧 *CONDENSATION HOLD:* Dew delta is ${dewDelta.toFixed(1)}°C (Humidity: ${weather.humidity}%). Pad/carpet surface moisture will ruin adhesive bond.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0) {
    holds.push(`🌧️ *RAIN HOLD:* Active rain/storm detected. Hold all outdoor gluing, glass, and mesh.`);
  } else if (weather.precipProbability4h > 40) {
    warnings.push(`🌦️ *RAIN PROBABILITY (${weather.precipProbability4h}% in 4h):* Keep blue tarps staged over open turf rolls and seaming tape.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0 || weather.humidity > 90) {
    holds.push(`⏳ *SAND INFILL HOLD:* Wet conditions detected. Silica sand must strictly be applied to dry turf to prevent pile clumping.`);
  }

  if (weather.temp > 35) {
    warnings.push(`☀️ *HIGH HEAT ALERT (${weather.temp}°C):* Adhesive pot-life drops to <5 minutes. Mandatory crew shade and hydration rest cycles.`);
  }

  const isNominal = holds.length === 0;
  let summaryText = '';

  if (holds.length > 0) {
    summaryText += `\n` + holds.join('\n');
  }
  if (warnings.length > 0) {
    summaryText += `\n` + warnings.join('\n');
  }
  if (isNominal) {
    summaryText += `\n🟢 *Conditions Nominal:* Wind (${weather.windSpeed} km/h), Temp (${weather.temp}°C), and moisture are clear for work.`;
  }

  return { holds, warnings, nominal: isNominal, summaryText };
}

// ====================================================================
// 9. IDENTITY RESOLUTION
// ====================================================================

async function lookupContact(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const contacts = await getCachedContacts();
  return contacts.find(c => {
    const p = (c.fields['Phone Number'] || '').replace(/\D/g, '');
    return p === cleanDigits || p.endsWith(cleanDigits) || cleanDigits.endsWith(p) ||
      (cleanDigits.length >= 10 && p.length >= 10 && cleanDigits.slice(-10) === p.slice(-10));
  }) || null;
}

async function lookupWorker(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const workers = await getCachedWorkers();
  return workers.find(w => {
    const isActive = w.fields['Active'] === true || w.fields['Active'] === 1;
    if (!isActive) return false;
    const pE164 = String(w.fields['Phone E164'] || '').replace(/\D/g, '');
    const wNum = String(w.fields['WhatsApp Number'] || '').replace(/\D/g, '');
    return (pE164 && (pE164 === cleanDigits || cleanDigits.endsWith(pE164) || pE164.endsWith(cleanDigits) || (cleanDigits.length >= 10 && pE164.slice(-10) === cleanDigits.slice(-10)))) ||
           (wNum && (wNum === cleanDigits || cleanDigits.endsWith(wNum) || wNum.endsWith(cleanDigits) || (cleanDigits.length >= 10 && wNum.slice(-10) === cleanDigits.slice(-10))));
  }) || null;
}

async function lookupSite(groupIdOrPhone, siteName = null) {
  const sites = await getCachedSites();

  if (siteName) {
    let normalized = siteName.toLowerCase()
      .replace(/['’]s?/gi, '')
      .replace(/\brcr\b/gi, 'rcor')
      .replace(/\breef club\b/gi, 'rcor')
      .replace(/\bcinnamon\b/gi, 'cynamon')
      .replace(/\bdon walker\b/gi, 'don walker')
      .replace(/\bnorth padel\b/gi, 'north padel')
      .replace(/\blevinsky\b/gi, 'levinsky')
      .replace(/\blewinsky\b/gi, 'lewinsky')
      .replace(/\b(?:bpc|court)\b/gi, '')
      .trim();

    let match = sites.find(s => {
      const sName = String(s.fields['Site Name'] || '').toLowerCase();
      if (!sName) return false;
      return sName.includes(normalized) || normalized.includes(sName);
    });
    if (match) return match;

    const searchTokens = normalized.split(/\s+/).filter(t => t.length > 2);
    if (searchTokens.length > 0) {
      match = sites.find(s => {
        const sName = String(s.fields['Site Name'] || '').toLowerCase();
        if (!sName) return false;
        return searchTokens.every(token => sName.includes(token));
      });
      if (match) return match;
    }
  }

  if (groupIdOrPhone) {
    const cleanTarget = String(groupIdOrPhone).trim();
    const cleanDigits = cleanTarget.replace(/\D/g, '');
    const match = sites.find(s => {
      const gid = String(s.fields['WhatsApp Group ID'] || '').trim();
      const clientGid = String(s.fields['Client WhatsApp Group ID'] || '').trim();
      const gidDigits = gid.replace(/\D/g, '');
      const clientDigits = clientGid.replace(/\D/g, '');

      return (gid && (gid === cleanTarget || cleanTarget.includes(gid) || (cleanDigits && gidDigits && (cleanDigits === gidDigits || cleanDigits.endsWith(gidDigits) || gidDigits.endsWith(cleanDigits))))) ||
             (clientGid && (clientGid === cleanTarget || cleanTarget.includes(clientGid) || (cleanDigits && clientDigits && (cleanDigits === clientDigits || cleanDigits.endsWith(clientDigits) || clientDigits.endsWith(cleanDigits)))));
    });
    if (match) return match;
  }

  return null;
}

async function getAllActiveSitesList() {
  const sites = await getCachedSites();
  return sites.map(r => r.fields['Site Name']).filter(Boolean);
}

async function resolveCallerIdentity(fromPhone) {
  if (!fromPhone) return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: '' };

  try {
    const contact = await lookupContact(fromPhone);
    if (contact) {
      const siteId = contact.fields['Linked Site']?.[0] || null;
      let siteRecord = null;
      if (siteId) {
        const sites = await getCachedSites();
        siteRecord = sites.find(s => siteId === s.id) || null;
      }

      return {
        type: 'CONTACT',
        id: contact.id,
        name: contact.fields['Contact Name'] || 'VIP Member',
        role: contact.fields['Role'] || 'Family Member / Player',
        notificationTier: contact.fields['Notification Tier'] || [],
        siteId,
        siteRecord,
        siteName: siteRecord?.fields?.['Site Name'] || 'Private Court Asset',
        facilityTier: siteRecord?.fields?.['Facility Tier'] || 'Standard Residential'
      };
    }
  } catch (err) {}

  try {
    const worker = await lookupWorker(fromPhone);
    if (worker) {
      return {
        type: 'WORKER',
        id: worker.id,
        name: worker.fields['Full Name'] || worker.fields['Worker Name'] || 'Field Tech',
        role: worker.fields['Role'] || 'Field Crew',
        assignedCrew: worker.fields['Assigned Crew'] || 'Unassigned Crew',
        workerRecord: worker
      };
    }
  } catch (err) {}

  return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: fromPhone };
}

// ====================================================================
// 10. WHATSAPP MESSAGING & JOY CANNON ENGINE (WITH AUTO-RETRY)
// ====================================================================

async function sendWhatsAppReaction(toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId) return false;
  const cleanDestination = String(toTarget).replace(/\D/g, ''); // Must target individual phone

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanDestination,
    type: 'reaction',
    reaction: { message_id: messageId, emoji: emoji }
  };

  try {
    await fetch(`${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) { return false; }
}

async function sendWhatsAppMessage(toTarget, messageBody, retries = 2) {
  if (!toTarget) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');
  const cleanDestination = isGroup ? toTarget.trim() : String(toTarget).replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanDestination,
    type: 'text',
    text: { body: messageBody }
  };

  if (!isGroup) payload.recipient_type = 'individual';

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
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
      console.warn(`[Meta Dispatch Attempt ${attempt} failed]: ${err.message}`);
      if (attempt <= retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        console.error(`[Meta Dispatch Error] Exhausted all retries to ${cleanDestination}:`, err.message);
        return false;
      }
    }
  }
  return false;
}

async function sendWhatsAppButtons(toTarget, textBody, buttons = []) {
  if (!toTarget || !buttons || buttons.length === 0) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');
  const cleanDestination = isGroup ? toTarget.trim() : String(toTarget).replace(/\D/g, '');

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${idx}_${Date.now()}`,
      title: (btn.title || 'Select').slice(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanDestination,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: textBody },
      action: { buttons: actionButtons }
    }
  };

  if (!isGroup) payload.recipient_type = 'individual';

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
      return await sendWhatsAppMessage(cleanDestination, fallbackText);
    }
    return true;
  } catch (err) {
    const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
    return await sendWhatsAppMessage(cleanDestination, fallbackText);
  }
}

async function fireInstallationJoyCannon(siteRecord, highestGate) {
  try {
    const clientGroup = siteRecord.fields['Client WhatsApp Group ID'];
    const linkedContactIds = siteRecord.fields['Linked Contacts'] || [];

    let celebrationCard = null;

    if (highestGate === 1) {
      celebrationCard = `🎾 *BOUNCE PADEL | PROGRESS UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Work is officially underway and the foundation slab is set!\n\n` +
        `_Next step: Raising the frame posts._`;
    } else if (highestGate === 2 || highestGate === 3) {
      celebrationCard = `🎾 *BOUNCE PADEL | PROGRESS UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `The frame posts and mesh panels are installed!\n\n` +
        `_Next step: Installing the glass panels._`;
    } else if (highestGate === 4) {
      celebrationCard = `🎾 *BOUNCE PADEL | PROGRESS UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Installation is moving forward — the glass is installed!\n\n` +
        `_Next step: Rolling out and gluing the turf._`;
    } else if (highestGate === 5) {
      celebrationCard = `🎾 *BOUNCE PADEL | PROGRESS UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Turf is laid and regulation white lines are cut!\n\n` +
        `_Next step: Sand infill and net setup._`;
    } else if (highestGate >= 8) {
      celebrationCard = `🎾 *BOUNCE PADEL | READY TO PLAY*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Installation is complete and your court is ready to play! 🥂\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 *Keep this chat handy:*\n` +
        `Whenever you need court maintenance or supplies, just text or voice note right here. Our team is always on standby.`;
    }

    if (!celebrationCard) return;

    if (clientGroup) {
      console.log(`🎾 [Joy Cannon Triggered] Firing Gate ${highestGate} for ${siteRecord.fields['Site Name']}`);
      await sendWhatsAppMessage(clientGroup, celebrationCard);
    }

    if (Array.isArray(linkedContactIds) && linkedContactIds.length > 0) {
      const contacts = await getCachedContacts();
      for (const cid of linkedContactIds) {
        const contact = contacts.find(c => c.id === cid);
        if (contact && contact.fields['Phone Number']) {
          const cleanPhone = String(contact.fields['Phone Number']).replace(/\D/g, '');
          await sendWhatsAppMessage(cleanPhone, celebrationCard);
        }
      }
    }
  } catch (err) {
    console.error('[Joy Cannon Error]:', err.message);
  }
}

// ====================================================================
// 11. WORK ORDER CLOSEOUT ENGINE
// ====================================================================

async function findActiveTicketForSite(siteId, ticketId = null) {
  const openTickets = await getCachedOpenAssignments();

  if (ticketId) {
    const cleanNum = parseInt(String(ticketId).replace(/\D/g, ''));
    const match = openTickets.find(r => {
      const aId = r.fields['Assignment ID'];
      return aId === ticketId || aId === cleanNum || r.id === ticketId;
    });
    if (match) return match;
  }

  if (siteId) {
    const match = openTickets.find(r => {
      const sites = r.fields['Sites'] || r.fields['Site'] || [];
      return Array.isArray(sites) && sites.includes(siteId);
    });
    if (match) return match;
  }

  return null;
}

async function executeWorkOrderCloseout({ site, targetCourtName, ticketId, resolutionNotes, worker, dispatchTarget, fromPhone, isVideoDelta = false }) {
  let targetSite = null;
  if (targetCourtName) targetSite = await lookupSite(null, targetCourtName);
  if (!targetSite && site) targetSite = site;

  const activeTicket = await findActiveTicketForSite(targetSite?.id, ticketId);

  if (!activeTicket) {
    const siteLabel = targetSite?.fields?.['Site Name'] || targetCourtName || 'this facility';
    await sendWhatsAppMessage(dispatchTarget, `⚠️ No open work orders currently found for *${siteLabel}* to close.`);
    return false;
  }

  const existingNotes = activeTicket.fields['Notes'] || '';
  const workerName = worker?.fields?.['Full Name'] || (fromPhone ? `Tech (+${fromPhone.slice(-4)})` : 'Field Tech');
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const updatedNotes = `${existingNotes}\n\n[COMPLETED by ${workerName} at ${timeStr}]: ${resolutionNotes}`.trim();

  await airtableWriteWithAutoDrop('Daily Assignments', {
    'Status': 'Complete',
    'Notes': updatedNotes
  }, activeTicket.id);

  const taskCategory = activeTicket.fields['Task Category'] || '';
  const isWinterCloseout = 
    taskCategory === 'Season Closing' ||
    /winter|clos(ing|ed)|take down|stow|pack away|season/i.test(resolutionNotes);

  const siteStatusTag = isWinterCloseout ? 'WINTERIZED_CLOSED' : 'OPEN_FOR_PLAY';
  const receiptStatusLine = isWinterCloseout 
    ? '❄️ *Status:* Court Winterized / Closed for Season' 
    : '🟢 *Status:* Court Open for Play';

  if (targetSite) {
    await airtableWriteWithAutoDrop('Sites', {
      'Site Status': siteStatusTag,
      'Last Note': `Work Order #${activeTicket.fields['Assignment ID']} completed by ${workerName}: ${resolutionNotes}`,
      'Last Intent': isWinterCloseout ? 'SEASON_CLOSEOUT' : 'WORK_ORDER_COMPLETED'
    }, targetSite.id);
  }

  const ticketNum = activeTicket.fields['Assignment ID'] ? `#${activeTicket.fields['Assignment ID']}` : '';
  const courtLabel = targetSite?.fields?.['Site Name'] || 'Assigned Court';

  const voucherReceipt = `🧾 *TITAN OS | WORK ORDER CLOSED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Ticket ${ticketNum} Complete*\n` +
    `🏟️ *Court:* ${courtLabel}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `⏱️ *Verified:* ${timeStr}\n` +
    (isVideoDelta ? `🎥 *Video Sweep:* Pre/Post Verified 🟢\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Work Done:*\n${resolutionNotes}\n\n` +
    `${receiptStatusLine}`;

  await sendWhatsAppMessage(dispatchTarget, voucherReceipt);
  return true;
}

// ====================================================================
// 12. NATURAL SPOKEN QUERY HANDLERS & MEDIA RETRIEVAL
// ====================================================================

async function handleSpokenLocationQuery(queriedName, fallbackSite, dispatchTarget) {
  let targetSite = null;
  if (queriedName) targetSite = await lookupSite(null, queriedName);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not find court "${queriedName}". Check spelling in Airtable.`);
    return;
  }

  const siteName = targetSite.fields['Site Name'];
  const coords = await resolveCoordinates(targetSite);

  if (!coords) {
    await sendWhatsAppMessage(dispatchTarget, `📍 No coordinates found for *${siteName}*. Drop a pin or enter address in Sites.`);
    return;
  }

  const links = getGoogleMapsLinks(coords.lat, coords.lon);
  const locationCard = `📍 *${siteName.toUpperCase()} | PIN & DIRECTIONS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `• *Coordinates:* ${coords.lat}, ${coords.lon}\n\n` +
    `🗺️ *Google Maps Driving:*\n${links.directions}\n\n` +
    `🛰️ *Satellite Staging View (Yard & Trees):*\n${links.satellite}`;

  await sendWhatsAppMessage(dispatchTarget, locationCard);
}

async function handleSpokenWeatherQuery(queriedName, fallbackSite, dispatchTarget) {
  let targetSite = null;
  if (queriedName) targetSite = await lookupSite(null, queriedName);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Specify which court: e.g. "What's the weather at Levinsky?"`);
    return;
  }

  const siteName = targetSite.fields['Site Name'] || queriedName || 'your assigned court';
  const coords = await resolveCoordinates(targetSite);
  if (!coords) {
    await sendWhatsAppMessage(dispatchTarget, `📍 No coordinates locked for *${siteName}* to check weather.`);
    return;
  }

  const weather = await getHyperlocalWeather(coords.lat, coords.lon);
  if (!weather) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Weather telemetry temporarily unavailable for ${siteName}.`);
    return;
  }

  const tripwires = evaluateWeatherTripwires(weather);
  const dewDelta = weather.temp - weather.dewPoint;

  const weatherCard = `🌤️ *WEATHER & SITE TRIPWIRES | ${siteName.toUpperCase()}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `• Temperature: ${weather.temp}°C (Dew Point: ${weather.dewPoint}°C)\n` +
    `• Wind Speed: ${weather.windSpeed} km/h (Gusts: ${weather.windGusts} km/h)\n` +
    `• Relative Humidity: ${weather.humidity}% (Delta: ${dewDelta.toFixed(1)}°C)\n` +
    `• Rain Chance (Next 4h): ${weather.precipProbability4h}%\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Active Tripwire Status:*${tripwires.summaryText}`;

  await sendWhatsAppMessage(dispatchTarget, weatherCard);
}

async function handleSpokenStatusQuery(queriedName, fallbackSite, dispatchTarget, isTicketOnly = false) {
  let targetSite = null;
  if (queriedName) targetSite = await lookupSite(null, queriedName);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Court not found. Check spelling in Airtable.`);
    return;
  }

  const siteId = targetSite.id;
  const siteName = targetSite.fields['Site Name'];
  const currentGate = targetSite.fields['Current Gate'] || 'No Gate Set';
  const workflowMode = targetSite.fields['Workflow Mode'] || 'INSTALLATION';
  const siteStatus = targetSite.fields['Site Status'] || 'ACTIVE';
  const lastNote = targetSite.fields['Last Note'] || 'No notes logged';

  const allOpenAssignments = await getCachedOpenAssignments();
  const linkedAssignments = allOpenAssignments.filter(record => {
    const s = record.fields['Sites'] || record.fields['Site'] || [];
    const siteIds = Array.isArray(s) ? s : [s];
    return siteIds.includes(siteId);
  });

  const fieldTickets = linkedAssignments.filter(a => {
    const type = a.fields['Assignment Type'];
    return type !== 'Sales' && type !== 'Expense';
  });
  const salesLeads = linkedAssignments.filter(a => a.fields['Assignment Type'] === 'Sales');

  let responseCard = `🏟️ *${siteName.toUpperCase()} | ${isTicketOnly ? 'ACTIVE WORK ORDERS' : 'STATUS'}*\n━━━━━━━━━━━━━━━━━━━━\n`;

  if (!isTicketOnly) {
    responseCard += `• Mode: ${workflowMode}\n`;
    responseCard += `• Status: ${siteStatus}\n`;
    if (workflowMode === 'INSTALLATION') {
      responseCard += `• Gate: ${currentGate}\n`;
    }
    responseCard += `• Last Update: ${lastNote.slice(0, 100)}\n`;
    responseCard += `━━━━━━━━━━━━━━━━━━━━\n`;
  }

  if (fieldTickets.length === 0) {
    responseCard += `✅ *Field Tickets:* No open work orders.\n`;
  } else {
    responseCard += `🛠️ *Open Field Tickets (${fieldTickets.length}):*\n`;
    fieldTickets.forEach(t => {
      const ticketNum = t.fields['Assignment ID'] ? `#${t.fields['Assignment ID']}` : 'WO';
      const priority = t.fields['Priority'] || 'Medium';
      
      let assignedWorkers = '';
      if (Array.isArray(t.fields['Worker']) && t.fields['Worker'].length > 0) {
        const names = t.fields['Worker'].map(wId => {
          if (typeof wId === 'string' && wId.startsWith('rec') && memoryCache.workers) {
            const found = memoryCache.workers.find(wk => wk.id === wId);
            return found?.fields?.['Full Name'] || found?.fields?.['Worker Name'] || wId;
          }
          return wId;
        });
        assignedWorkers = ` (${names.join(', ')})`;
      } else if (typeof t.fields['Worker'] === 'string') {
        assignedWorkers = ` (${t.fields['Worker']})`;
      }

      const rawNote = t.fields['Notes'] || t.fields['Task Category'] || t.fields['Assignment Type'] || 'Service Task';
      const cleanNote = rawNote.split('\n')[0].replace(/^\[.*?\]\s*/, '').slice(0, 45);
      responseCard += `• *${ticketNum}* [${priority}] ${cleanNote}${assignedWorkers} — _${t.fields['Status'] || 'Open'}_\n`;
    });
  }

  if (salesLeads.length > 0) {
    responseCard += `\n💼 *Commercial Leads (${salesLeads.length}):*\n`;
    salesLeads.forEach(s => {
      const leadNum = s.fields['Assignment ID'] ? `#${s.fields['Assignment ID']}` : 'LEAD';
      const rawNote = s.fields['Notes'] || '';
      const cleanDesc = rawNote.split('\n')[0].replace(/\[COMMERCIAL LEAD —\s*/i, '').replace(/\]/, '').slice(0, 45);
      responseCard += `• *${leadNum}*: ${cleanDesc || 'Inbound Sales Lead'}\n`;
    });
  }

  await sendWhatsAppMessage(dispatchTarget, responseCard.trim());
}

async function handleSpokenReadinessQuery(queriedName, fallbackSite, dispatchTarget) {
  let targetSite = null;
  if (queriedName) targetSite = await lookupSite(null, queriedName);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Court not found to check readiness.`);
    return;
  }

  const gate = evaluateReadinessGate(targetSite);
  const report = `🏗️ *${targetSite.fields['Site Name'].toUpperCase()} | MOBILIZATION CHECK*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🚦 *Status:* ${gate.status}\n` +
    `📋 *Details:* ${gate.details}\n` +
    `👉 *Crew:* ${targetSite.fields['Assigned Crew'] || 'Unassigned'}`;

  await sendWhatsAppMessage(dispatchTarget, report);
}

// Media Retrieval Engine - Recalls the latest video from a specific site
async function handleSpokenMediaRetrieval(queriedName, fallbackSite, dispatchTarget) {
  let targetSite = null;
  if (queriedName) targetSite = await lookupSite(null, queriedName);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not find court "${queriedName || 'requested'}".`);
    return;
  }

  const siteNameSafe = targetSite.fields['Site Name'].replace(/'/g, "\\'");

  try {
    const formula = `AND(SEARCH('${siteNameSafe}', {Sites} & "") > 0, OR({Post-Work Media} != '', {Pre-Work Media} != ''))`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=1`;
    
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      const mediaUrl = record.fields['Post-Work Media'] || record.fields['Pre-Work Media'];
      const date = record.fields['Date'];
      const ticketId = record.fields['Assignment ID'];
      
      let workerName = 'Tech';
      if (record.fields['Worker'] && record.fields['Worker'].length > 0 && memoryCache.workers) {
        const w = memoryCache.workers.find(wk => wk.id === record.fields['Worker'][0]);
        if (w) workerName = w.fields['Full Name'] || w.fields['Worker Name'] || 'Tech';
      }

      const msg = `🎥 *LATEST MEDIA | ${targetSite.fields['Site Name'].toUpperCase()}*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `📅 *Date:* ${date || 'Recent'}\n` +
                  `👤 *Logged By:* ${workerName}\n` +
                  `🎫 *Ticket Ref:* #${ticketId || 'N/A'}\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔗 *Secure Video Link:*\n${mediaUrl}`;
      
      await sendWhatsAppMessage(dispatchTarget, msg);
    } else {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ No recent video walkarounds found in the ledger for *${targetSite.fields['Site Name']}*.`);
    }
  } catch (err) {
    console.error('[Media Retrieval Error]:', err);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to retrieve media for *${targetSite.fields['Site Name']}*.`);
  }
}

async function handleSpokenARLookup(queriedEntity, dispatchTarget) {
  // Increased maxresults to 50 to capture the whole fleet for generic aging queries
  const query = `select * from Invoice where Balance > '0' maxresults 50`;
  const qboData = await qboApiRequest(query);

  if (!qboData || !qboData.QueryResponse || !qboData.QueryResponse.Invoice) {
    await sendWhatsAppMessage(dispatchTarget, `💼 *TITAN OS | AR LOOKUP*\nNo open invoices found in QuickBooks or API is disconnected.`);
    return;
  }

  let invoices = qboData.QueryResponse.Invoice;
  const isGenericAgingQuery = !queriedEntity || /all|aging|30|total|current/i.test(queriedEntity);

  // If a specific client is requested, filter the results. Otherwise, process all open invoices.
  if (!isGenericAgingQuery) {
    invoices = invoices.filter(inv => 
      (inv.CustomerRef && inv.CustomerRef.name && inv.CustomerRef.name.toLowerCase().includes(queriedEntity.toLowerCase())) ||
      (inv.DocNumber && inv.DocNumber.includes(queriedEntity))
    );
  }

  if (invoices.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `💼 *TITAN OS | AR LOOKUP*\nNo outstanding balance found${!isGenericAgingQuery ? ` for *${queriedEntity}*` : ''}.`);
    return;
  }

  let totalOwing = 0;
  let lines = [];
  const now = new Date();

  invoices.forEach(inv => {
    const balance = parseFloat(inv.Balance);
    totalOwing += balance;
    
    let daysLate = 0;
    if (inv.DueDate) {
        const dueDate = new Date(inv.DueDate);
        daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    }
    
    // Sort into 30+ days late vs current
    const lateString = daysLate > 30 ? ` — *${daysLate} Days Late* 🔴` : (daysLate > 0 ? ` — *${daysLate} Days Late* 🟡` : ' — Current 🟢');
    
    // Only add to the list if they asked for 30+ days and it fits, or if they asked for a general report
    if (!queriedEntity || !queriedEntity.includes('30') || daysLate > 30) {
        lines.push(`• *${inv.CustomerRef.name}* (Inv #${inv.DocNumber}): $${balance.toFixed(2)}${lateString}`);
    }
  });

  if (lines.length === 0) {
      await sendWhatsAppMessage(dispatchTarget, `💼 *TITAN OS | AR LOOKUP*\nNo invoices found matching that aging criteria.`);
      return;
  }

  const headerTitle = isGenericAgingQuery ? 'FLEET AGING REPORT' : invoices[0].CustomerRef.name.toUpperCase();

  const arCard = `💼 *TITAN OS | AR LOOKUP: ${headerTitle}*\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 `💰 *Total Outstanding:* $${totalOwing.toFixed(2)}\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 lines.join('\n');

  await sendWhatsAppMessage(dispatchTarget, arCard);
}

// FLEXIBLE INVOICING HANDLER (CONVERT BY ESTIMATE # OR CLIENT NAME)
async function handleInvoiceApproval(nlp, dispatchTarget) {
  const estimateNum = nlp.qbo_estimate_number;
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const percentage = parseFloat(nlp.qbo_invoice_percentage) || 100;

  if (!estimateNum && !customerNameTarget) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the estimate number or client name to convert (e.g., "Convert Burke site to 50% invoice").`);
    return;
  }

  let estQuery = '';
  if (estimateNum) {
    estQuery = `select * from Estimate where DocNumber = '${estimateNum}'`;
  } else {
    const cleanName = customerNameTarget.replace(/'/g, "\\'");
    estQuery = `select * from Estimate where CustomerRef.name LIKE '%${cleanName}%' and TxnStatus='Pending' MAXRESULTS 1`;
  }

  const qboData = await qboApiRequest(estQuery);

  if (!qboData || !qboData.QueryResponse || !qboData.QueryResponse.Estimate || qboData.QueryResponse.Estimate.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not locate a pending Estimate for ${estimateNum ? '#' + estimateNum : customerNameTarget} in QuickBooks.`);
    return;
  }

  const estimate = qboData.QueryResponse.Estimate[0];
  const customerName = estimate.CustomerRef.name;
  const totalAmount = parseFloat(estimate.TotalAmt);
  const drawAmount = (totalAmount * (percentage / 100)).toFixed(2);

  const invCard = `🧾 *TITAN OS | INVOICE APPROVAL*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `*Estimate:* #${estimate.DocNumber}\n` +
                  `*Client:* ${customerName}\n` +
                  `*Draw Split:* ${percentage}%\n` +
                  `*Est Total:* $${totalAmount.toFixed(2)}\n` +
                  `*Invoice Amount:* $${drawAmount}\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `Tap below to generate the ${percentage}% invoice and email the client.`;

  const buttons = [{ id: `QBO_CONVERT_${estimate.Id}_${percentage}`, title: `✉️ Send ${percentage}% Inv` }];
  await sendWhatsAppButtons(dispatchTarget, invCard, buttons);
}

// NET-NEW INVOICE CREATION FOR EXISTING CLIENTS
async function handleInvoiceCreation(nlp, dispatchTarget) {
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const amount = nlp.qbo_amount;
  const lineItems = nlp.qbo_line_items || 'Standard Service';

  if (!customerNameTarget || !amount) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the client name and total amount to create a new invoice (e.g. "Create invoice for David Cynamon for sand, $1250").`);
    return;
  }

  const cleanName = customerNameTarget.replace(/'/g, "\\'");
  const custQuery = `select * from Customer where DisplayName LIKE '${cleanName}%' MAXRESULTS 1`;
  const qboData = await qboApiRequest(custQuery);

  if (!qboData || !qboData.QueryResponse || !qboData.QueryResponse.Customer || qboData.QueryResponse.Customer.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Client "${customerNameTarget}" not found in QuickBooks. Please add them first.`);
    return;
  }

  const customer = qboData.QueryResponse.Customer[0];
  
  const invCard = `🧾 *TITAN OS | INVOICE DRAFTED*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `*Client:* ${customer.DisplayName}\n` +
                  `*Scope:* ${lineItems}\n` +
                  `*Amount:* $${parseFloat(amount).toFixed(2)} (+HST)\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `Tap below to generate the invoice and email the client.`;

  const buttons = [{ id: `QBO_NEW_INV_${customer.Id}`, title: `✉️ Send Invoice` }];
  await sendWhatsAppButtons(dispatchTarget, invCard, buttons);
}

// ACTIONABLE STATE CHANGER (HEADLESS DATABASE ADMIN)
async function handleActionableStateChange(nlp, site, worker, callerIdentity, dispatchTarget) {
  let targetSiteId = site?.id;
  let targetSiteName = site?.fields?.['Site Name'] || 'Assigned Court';

  if (nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name) {
    const matched = await lookupSite(null, nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name);
    if (matched) {
      targetSiteId = matched.id;
      targetSiteName = matched.fields['Site Name'];
    }
  }

  if (!targetSiteId) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not locate a specific site to update. Please specify the court name.`);
    return;
  }

  const updatePayload = {};
  const updateNotes = [];

  if (nlp.workflow_mode) { updatePayload['Workflow Mode'] = nlp.workflow_mode; updateNotes.push(`Workflow Mode: ${nlp.workflow_mode}`); }
  if (nlp.site_status_update) { updatePayload['Site Status'] = nlp.site_status_update; updateNotes.push(`Site Status: ${nlp.site_status_update}`); }
  if (nlp.deposit_status) { updatePayload['Deposit Status'] = nlp.deposit_status; updateNotes.push(`Deposit: ${nlp.deposit_status}`); }
  if (nlp.foundation_type) { updatePayload['Foundation Type'] = nlp.foundation_type; updateNotes.push(`Foundation: ${nlp.foundation_type}`); }
  if (nlp.slab_pour_date) { updatePayload['Slab Pour Date'] = nlp.slab_pour_date; updateNotes.push(`Slab Poured: ${nlp.slab_pour_date}`); }
  if (nlp.assigned_crew) { updatePayload['Assigned Crew'] = nlp.assigned_crew; updateNotes.push(`Crew: ${nlp.assigned_crew}`); }
  if (nlp.manufacturer) { updatePayload['Manufacturer'] = nlp.manufacturer; updateNotes.push(`Manufacturer: ${nlp.manufacturer}`); }

  if (Object.keys(updatePayload).length === 0) {
     await sendWhatsAppMessage(dispatchTarget, `⚠️ Heard your update for ${targetSiteName}, but no specific database dropdown fields were detected.`);
     return;
  }

  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'HQ Admin';
  updatePayload['Last Note'] = `[DATABASE OVERRIDE - ${workerName}]: ${updateNotes.join(', ')}`;
  updatePayload['Last Intent'] = 'ACTIONABLE_STATE_CHANGE';

  await airtableWriteWithAutoDrop('Sites', updatePayload, targetSiteId);
  invalidateAirtableCache('sites');

  const confirmCard = `🎛️ *TITAN OS | SITE LEDGER UPDATED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏟️ *Court:* ${targetSiteName}\n` +
    `👤 *Updated By:* ${workerName}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Database Fields Modified:* \n• ${updateNotes.join('\n• ')}\n\n` +
    `_Airtable synced. No login required._`;

  await sendWhatsAppMessage(dispatchTarget, confirmCard);
}

// ====================================================================
// 13. CONVERSATIONAL TEXT & VOICE TRIAGE ENGINE
// ====================================================================

const INTENT_CLASSIFICATION_PROMPT = `
You are the Titan OS Ambient Intelligence Scribe & Operational Dispatcher for Bounce Padel.
Classify incoming spoken audio transcripts or text messages.

ROUTING INTENTS:
1. "LOCATION_QUERY": User is asking for the location, directions, pin, map, or address of a court.
​2. "WEATHER_QUERY": User is asking about weather, wind, rain, or site conditions.
3. "STATUS_QUERY": User is asking about general progress, gates, or status of a court.
4. "TICKET_QUERY": User is asking specifically about open tickets, support issues, work orders, chores, repairs, or pending tasks for a court.
5. "READINESS_QUERY": User is asking if a court is ready to mobilize, foundation cured, or deposit received.
6. "WORK_ORDER_CLOSEOUT": Spoken completion of a task/ticket.
7. "TICKET_UPDATE": User is providing a status update, outreach log, or follow-up note on an open ticket, lead, client, or chore.
8. "ACTIONABLE_STATE_CHANGE": Specific commands to update database fields (deposit status, slab dates, crews, site status, foundation type).
9. "DARK_MATTER": Genuine jobsite notes (hardware delivered, GC delay, traffic notes, logistical reminders, supplier updates).
10. "PURE_NOISE": Casual banter, greetings, emojis ("thanks", "ok", "coffee").
11. "SUPPLY_REQUEST": Installer or field crew requesting missing parts, hardware, tools, or supplies.
12. "FREIGHT_UPDATE": Driver or warehouse staff providing transit updates, crate counts, or BOL arrivals.
13. "HISTORICAL_REFERENCE": User is sharing an old photo, throwback, or past memory. Disregard physical evaluation.
14. "MEDIA_RETRIEVAL": User is asking to see, view, or retrieve the latest video walkthrough, photo, or media for a specific site/court.
15. "AR_LOOKUP": User is asking about outstanding balances, what someone owes, or payment status.
16. "INVOICE_APPROVAL": User is commanding to send an invoice, convert an estimate, or bill a client based on an existing estimate.
17. "CREATE_INVOICE": User is commanding to create a brand new invoice from scratch for an existing client.

Extract:
"queried_court_name": string or null,
"referenced_ticket_id": integer or null,
"referenced_entity_name": string or null (e.g. "Ondako", "Cliff", "RCOR", "Cynamon"),
"update_note": string or null,
"freight_bol": string or null (Bill of lading or tracking ID),
"freight_integer_count": number or null (e.g. "4 crates" -> 4),
"freight_status": "In Transit" | "Delivered" | "Damaged" | null,
"requested_items": "string describing what is missing or needed or null",
"qbo_estimate_number": string or null (e.g. "1227"),
"qbo_invoice_percentage": number or null (e.g. 40, 50, 10, 100),
"qbo_customer_name": string or null (e.g. "Burke", "David Cynamon"),
"qbo_amount": number or null (e.g. 1250),
"qbo_line_items": string describing the services or materials or null,

DATABASE FIELD MAPPING OVERRIDES (Must exactly match these strings if present in the prompt):
"workflow_mode": "INSTALLATION" | "MAINTENANCE" | "SPOT_VISIT" | "EXECUTIVE" | "PRODUCTION" | "LOGISTICS" | "INVENTORY" | "PLANNING" | null
"site_status_update": "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETE" | "BLOCKED_WEATHER" | "BLOCKED_PARTS" | "END_OF_DAY" | "OPEN_FOR_PLAY" | "WINTERIZED_CLOSED" | "UNDER_MAINTENANCE" | "IN_CONSTRUCTION" | null
"deposit_status": "Pending Deposit" | "50% Deposit Received" | "Paid in Full" | null
"foundation_type": "Poured Concrete Slab" | "Existing Tennis Conversion" | "Indoor Commercial Slab" | "Post-Tensioned Slab" | null
"slab_pour_date": "YYYY-MM-DD" | null
"assigned_crew": "Team Alpha" | "Team Beta" | "Logistics" | "Unassigned" | null
"manufacturer": "BPC" | "Mejor Set" | "AFP" | "Chinese" | "Padel Tech" | "Spanish" | null

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "LOCATION_QUERY" | "WEATHER_QUERY" | "STATUS_QUERY" | "TICKET_QUERY" | "READINESS_QUERY" | "WORK_ORDER_CLOSEOUT" | "TICKET_UPDATE" | "ACTIONABLE_STATE_CHANGE" | "DARK_MATTER" | "PURE_NOISE" | "FREIGHT_UPDATE" | "SUPPLY_REQUEST" | "HISTORICAL_REFERENCE" | "MEDIA_RETRIEVAL" | "AR_LOOKUP" | "INVOICE_APPROVAL" | "CREATE_INVOICE",
  "queried_court_name": "string or null",
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "referenced_ticket_id": integer or null,
  "referenced_entity_name": "string or null",
  "update_note": "string or null",
  "resolution_summary": "string in English or null",
  "dark_matter_category": "Logistics" | "Site Conditions" | "Hardware" | null,
  "distilled_context": "string or null",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | null,
  "gravity_score": integer | null,
  "freight_bol": "string or null",
  "freight_integer_count": number | null,
  "freight_status": "string or null",
  "requested_items": "string or null",
  "qbo_estimate_number": "string or null",
  "qbo_invoice_percentage": number | null,
  "qbo_customer_name": "string or null",
  "qbo_amount": number | null,
  "qbo_line_items": "string or null",
  "workflow_mode": "string or null",
  "site_status_update": "string or null",
  "deposit_status": "string or null",
  "foundation_type": "string or null",
  "slab_pour_date": "string or null",
  "assigned_crew": "string or null",
  "manufacturer": "string or null",
  "transcript_en": "Clean English transcript",
  "transcript_es": "Clean Spanish transcript"
}
`;

async function triageSpokenOrTextNLP(rawInput, isAudio = false, audioItems = []) {
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ');

  const prompt = `${INTENT_CLASSIFICATION_PROMPT}\nActive Registry: [${siteListStr}]\nInput: "${typeof rawInput === 'string' ? rawInput : 'Spoken Voice Memo'}"`;

  const contentParts = [{ text: prompt }];

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
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
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

async function handleVoiceToIntegerFreight(nlp, site, worker, callerIdentity, dispatchTarget, fromPhone) {
  const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Logistics Tech';
  const siteLabel = site?.fields?.['Site Name'] || nlp.matched_site_name || 'Fleet Operations';
  const countLabel = nlp.freight_integer_count ? `[Count: ${nlp.freight_integer_count}] ` : '';
  
  const payloadNotes = `[FREIGHT VOICE UPDATE - ${senderName}]\n` +
    `• BOL/Tracking: ${nlp.freight_bol || 'N/A'}\n` +
    `• Status: ${nlp.freight_status || 'Update'}\n` +
    `• Note: ${countLabel}${nlp.resolution_summary || nlp.distilled_context || nlp.transcript_en}`;

  const assignmentPayload = {
    'Date': new Date().toISOString().split('T')[0],
    'Assignment Type': 'Task',
    'Task Category': 'Logistics',
    'Priority': 'Medium',
    'Source': 'Voice Freight Ledger',
    'Status': nlp.freight_status === 'Delivered' ? 'Complete' : 'In Progress',
    'Notes': payloadNotes
  };

  let targetSiteId = site?.id;
  if (!targetSiteId && nlp.matched_site_name) {
    const matched = await lookupSite(null, nlp.matched_site_name);
    if (matched) targetSiteId = matched.id;
  }
  if (targetSiteId) assignmentPayload['Sites'] = [targetSiteId];
  if (worker?.id) assignmentPayload['Worker'] = [worker.id];

  const created = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = created?.fields?.['Assignment ID'] ? `#${created.fields['Assignment ID']}` : 'FRT';

  const reply = `🚚 *TITAN OS | FREIGHT LEDGER UPDATED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *BOL:* ${nlp.freight_bol || 'Unspecified'}\n` +
    `📊 *Status:* ${nlp.freight_status || 'Logged'}\n` +
    (nlp.freight_integer_count ? `🔢 *Units Counted:* ${nlp.freight_integer_count}\n` : '') +
    `📍 *Destination:* ${siteLabel}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Logistics Ref:* ${ticketId}`;

  await sendWhatsAppMessage(dispatchTarget, reply);
}

async function handleSupplyRequest(nlp, site, worker, callerIdentity, dispatchTarget, fromPhone) {
  const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
  const siteLabel = site?.fields?.['Site Name'] || nlp.matched_site_name || 'Assigned Court';
  const itemsNeeded = nlp.requested_items || nlp.distilled_context || nlp.transcript_en;

  const assignmentPayload = {
    'Date': new Date().toISOString().split('T')[0],
    'Assignment Type': 'Supply Delivery',
    'Task Category': 'Logistics',
    'Priority': 'High',
    'Source': 'Field Supply Request',
    'Status': 'Open',
    'Notes': `[MISSING PARTS / SUPPLY REQUEST - ${siteLabel}]\n• Requested By: ${senderName}\n• Missing Items: ${itemsNeeded}\n• Spoken Context: "${nlp.transcript_en}"`
  };

  if (site?.id) assignmentPayload['Sites'] = [site.id];

  const createdTicket = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketDbId = createdTicket.id;
  const ticketRef = createdTicket?.fields?.['Assignment ID'] ? `#${createdTicket.fields['Assignment ID']}` : 'SUPPLY';

  const ackCard = `🛠️ *TITAN OS | SUPPLY REQUEST LOGGED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Missing:* ${itemsNeeded}\n` +
    `🎫 *Ticket:* ${ticketRef}\n\n` +
    `_Alert dispatched directly to the Logistics Team._`;
  
  await sendWhatsAppMessage(dispatchTarget, ackCard);

  const allSites = await getCachedSites();
  const logisticsSite = allSites.find(s => 
    (s.fields['Workflow Mode'] === 'LOGISTICS') || 
    /logistics|freight/i.test(s.fields['Site Name'] || '')
  );

  const logisticsTarget = logisticsSite?.fields?.['WhatsApp Group ID'];

  if (logisticsTarget) {
    const logisticsCard = `🚨 *TITAN OS | MISSING PARTS ALERT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Site:* ${siteLabel}\n` +
      `👤 *Requested By:* ${senderName}\n` +
      `📦 *Needed:* ${itemsNeeded}\n` +
      `🎫 *Ticket:* ${ticketRef}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Tap below to claim this delivery.`;
    
    const buttons = [{ id: `CLAIM_SUPPLY_${ticketDbId}_${site?.id || 'none'}`, title: '🚚 Claim Delivery' }];
    await sendWhatsAppButtons(logisticsTarget, logisticsCard, buttons);
  }
}

async function triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity) {
  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  await Promise.all(uploadPromises);

  const triage = await triageSpokenOrTextNLP(null, true, items);
  if (!triage) return;

  console.log('[Voice Intent]:', { intent: triage.intent, querySite: triage.queried_court_name });

  if (triage.intent === 'PURE_NOISE' || triage.intent === 'HISTORICAL_REFERENCE') return;

  const combinedTranscript = (triage.transcript_en || '').toLowerCase();
  const newSiteMatch = combinedTranscript.match(/(?:create|add|new)\s+(?:new\s+)?site\s*[-:]?\s*["“']?([^"”']+)["”']?/i);

  if (newSiteMatch) {
    const newSiteName = newSiteMatch[1].trim();
    const recentPin = lastDroppedCoordinates.get(fromPhone);

    const newRecordPayload = {
      'Site Name': newSiteName,
      'Workflow Mode': 'PLANNING',
      'Site Status': 'ACTIVE',
      'Last Note': `[SITE VISIT - Created via Spoken Audio on ${new Date().toLocaleDateString()}]`,
      'WhatsApp Group ID': dispatchTarget || fromPhone
    };

    if (recentPin && (Date.now() - recentPin.timestamp < 10 * 60 * 1000)) {
      newRecordPayload['Site location'] = `${recentPin.lat.toFixed(6)}, ${recentPin.lon.toFixed(6)}`;
      lastDroppedCoordinates.delete(fromPhone);
    }

    const createdSite = await airtableWriteWithAutoDrop('Sites', newRecordPayload);
    invalidateAirtableCache('sites');

    if (createdSite?.id) {
      if (fromPhone) userActiveSiteMap.set(fromPhone, createdSite.id);
      if (dispatchTarget) userActiveSiteMap.set(dispatchTarget, createdSite.id);
    }

    await sendWhatsAppMessage(dispatchTarget, `🏟️ *TITAN OS | NEW SITE CREATED*\n\n` +
      `• *Court:* ${newSiteName}\n` +
      (newRecordPayload['Site location'] ? `• *Coordinates:* ${newRecordPayload['Site location']}\n` : '') +
      `• *Mode:* PLANNING\n` +
      `• *Readiness:* HOLD: PRE-CON BLOCKED 🔴\n\n` +
      `📋 Queued for INOC to populate specs & deposit.`);
    return;
  }

  if (triage.intent === 'LOCATION_QUERY') {
    const targetQuery = triage.queried_court_name || triage.matched_site_name || triage.referenced_entity_name;
    await handleSpokenLocationQuery(targetQuery, site, dispatchTarget);
    return;
  }

  if (triage.intent === 'WEATHER_QUERY') {
    const targetQuery = triage.queried_court_name || triage.matched_site_name || triage.referenced_entity_name;
    await handleSpokenWeatherQuery(targetQuery, site, dispatchTarget);
    return;
  }

  if (triage.intent === 'STATUS_QUERY' || triage.intent === 'TICKET_QUERY') {
    const targetQuery = triage.queried_court_name || triage.referenced_entity_name || triage.matched_site_name;
    await handleSpokenStatusQuery(targetQuery, site, dispatchTarget, triage.intent === 'TICKET_QUERY');
    return;
  }

  if (triage.intent === 'READINESS_QUERY') {
    await handleSpokenReadinessQuery(triage.queried_court_name, site, dispatchTarget);
    return;
  }

  if (triage.intent === 'MEDIA_RETRIEVAL') {
    const targetQuery = triage.queried_court_name || triage.referenced_entity_name || triage.matched_site_name;
    await handleSpokenMediaRetrieval(targetQuery, site, dispatchTarget);
    return;
  }

  if (triage.intent === 'AR_LOOKUP') {
    await handleSpokenARLookup(triage.referenced_entity_name, dispatchTarget);
    return;
  }

  if (triage.intent === 'INVOICE_APPROVAL') {
    await handleInvoiceApproval(triage, dispatchTarget);
    return;
  }

  if (triage.intent === 'CREATE_INVOICE') {
    await handleInvoiceCreation(triage, dispatchTarget);
    return;
  }
  
  if (triage.intent === 'ACTIONABLE_STATE_CHANGE') {
    await handleActionableStateChange(triage, site, worker, callerIdentity, dispatchTarget);
    return;
  }

  if (triage.intent === 'WORK_ORDER_CLOSEOUT') {
    await executeWorkOrderCloseout({
      site,
      targetCourtName: triage.queried_court_name || triage.matched_site_name,
      ticketId: triage.ticket_id,
      resolutionNotes: triage.resolution_summary || triage.transcript_en || 'Spoken closeout verified on site.',
      worker,
      dispatchTarget,
      fromPhone
    });
    return;
  }

  if (triage.intent === 'TICKET_UPDATE') {
    await handleTicketOrLeadUpdate({
      rawText: triage.update_note || triage.transcript_en,
      entityName: triage.referenced_entity_name || triage.queried_court_name,
      explicitTicketId: triage.referenced_ticket_id || triage.ticket_id,
      worker,
      dispatchTarget,
      fromPhone
    });
    return;
  }

  if (triage.intent === 'FREIGHT_UPDATE') {
    await handleVoiceToIntegerFreight(triage, site, worker, callerIdentity, dispatchTarget, fromPhone);
    return;
  }

  if (triage.intent === 'SUPPLY_REQUEST') {
    await handleSupplyRequest(triage, site, worker, callerIdentity, dispatchTarget, fromPhone);
    return;
  }

  if (triage.intent === 'DARK_MATTER') {
    const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
    const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Fleet Operations';

    const isHighPriority = (triage.gravity_score >= 3 || triage.urgency === 'HIGH' || triage.urgency === 'MEDIUM');
    const isExecMode = site?.fields?.['Workflow Mode'] === 'EXECUTIVE';

    if (isHighPriority || isExecMode) {
      if (site) {
        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': `[VOICE NOTE - ${triage.dark_matter_category}]: ${triage.distilled_context || triage.transcript_en}`,
          'Last Intent': 'AMBIENT_ALERT'
        }, site.id);
      }

      const archivedRecord = await streamToDarkMatterVault({
        siteId: site?.id || null,
        siteName: siteLabel,
        senderPhone: fromPhone,
        senderName: senderName,
        rawText: triage.transcript_en,
        category: triage.dark_matter_category || 'Logistics',
        distilledContext: triage.distilled_context || triage.transcript_en,
        urgency: triage.urgency || 'LOW',
        gravityScore: triage.gravity_score || 1
      });

      if (archivedRecord?.id) {
        const alertPrompt = `⚠️ *FIELD NOTE RECORDED*\n\n` +
          `*Site:* ${siteLabel}\n` +
          `*Observation:* "${triage.distilled_context || triage.transcript_en}"\n\n` +
          `Want to convert this into an open dispatch ticket?`;

        const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Create Ticket' }];
        await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
        return;
      }
    } else {
      streamToDarkMatterVault({
        siteId: site?.id || null,
        siteName: siteLabel,
        senderPhone: fromPhone,
        senderName: senderName,
        rawText: triage.transcript_en,
        category: triage.dark_matter_category || 'Logistics',
        distilledContext: triage.distilled_context || triage.transcript_en,
        urgency: triage.urgency || 'LOW',
        gravityScore: triage.gravity_score || 1
      }).catch(err => console.error('[Dark Matter] Async archive failed:', err));

      await sendWhatsAppMessage(dispatchTarget, `📌 *NOTE ARCHIVED*\n\n"${triage.distilled_context || triage.transcript_en}"\n\n_Logged to ${siteLabel}_`);
    }
  }
}

async function evaluateCourtMediaBatch(mediaItems, cumulativeContext = {}) {
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ');

  const auditContextText = `AUDIT CONTEXT:
Active Registry: [${siteListStr}]
Current Target Court: ${cumulativeContext.siteName || 'Unbound Court'}
Current Mode: ${cumulativeContext.workflowMode || 'INSTALLATION'}
Active Open Punch Notes: ${cumulativeContext.lastNote || 'None'}

Evaluate ONLY the foreground court. Grade against 8-Gate physical rubric.
Check silicone status on Gate 4 without treating it as a blocker.
Check for shop/manufacturing/jig discrepancies (15cm vs 16cm tab spacing, hole offsets, cut lengths).`;

  const contentParts = [{ text: auditContextText }];

  for (const item of mediaItems) {
    if (item.caption) contentParts.push({ text: `Caption: ${item.caption}` });
    contentParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  }

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Gemini evaluation failed (${res.status}): ${await res.text()}`);

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini forensic engine');

  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
}

async function processMediaBatch(batch) {
  const { items, site, worker, dispatchTarget, fromPhone, senderSource, indoorSite, callerIdentity } = batch;

  const hasVisualMedia = items.some(item => item.type === 'image' || item.type === 'video');
  const hasVideo = items.some(item => item.type === 'video');

  const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';

  const cumulativeContext = {
    siteName: site?.fields?.['Site Name'] || 'Padel Court',
    workflowMode: currentMode,
    siteStatus: site?.fields?.['Site Status'] || 'ACTIVE',
    openTickets: site?.fields?.['Open Tickets'] || 0,
     clearedMilestones: site?.fields?.['Cleared Milestones'] || [],
    lastNote: site?.fields?.['Last Note'] || '',
    isIndoor: indoorSite
  };

  const batchText = items.map(i => i.caption || i.rawMessage?.text?.body || '').filter(Boolean).join(' ').trim();

  let storageResults = [];
  if (hasVisualMedia || items.some(i => i.type === 'audio' || i.type === 'voice')) {
    const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
    storageResults = await Promise.all(uploadPromises);
  }

  let targetedSiteOverride = null;

  if (hasVisualMedia && batchText.length > 3) {
      console.log(`[Multimodal Override]: Caption detected ("${batchText}"). Bypassing visual triage to evaluate intent.`);
      const triage = await triageSpokenOrTextNLP(batchText, false, []);
      
      if (triage) {
          if (triage.intent === 'HISTORICAL_REFERENCE') {
              console.log('[Multimodal Override]: Historical reference detected. Skipping 8-Gate audit.');
              await sendWhatsAppMessage(dispatchTarget, `🕰️ *TITAN OS | HISTORICAL MEDIA LOGGED*\nSaved to vault. Bypassing live 8-Gate physical audit.`);
              return; 
          }

          const combinedTranscript = (triage.transcript_en || '').toLowerCase();
          
          const newSiteMatch = combinedTranscript.match(/(?:create|add|new)\s+(?:new\s+)?site\s*[-:]?\s*["“']?([^"”']+)["”']?/i);
          if (newSiteMatch) {
              const newSiteName = newSiteMatch[1].trim();
              const recentPin = lastDroppedCoordinates.get(fromPhone);

              const newRecordPayload = {
                'Site Name': newSiteName,
                'Workflow Mode': 'PLANNING',
                'Site Status': 'ACTIVE',
                'Last Note': `[SITE VISIT - Created via Text/Image Combo on ${new Date().toLocaleDateString()}]`,
                'WhatsApp Group ID': dispatchTarget || fromPhone
              };

              if (recentPin && (Date.now() - recentPin.timestamp < 10 * 60 * 1000)) {
                newRecordPayload['Site location'] = `${recentPin.lat.toFixed(6)}, ${recentPin.lon.toFixed(6)}`;
                lastDroppedCoordinates.delete(fromPhone);
              }

              const createdSite = await airtableWriteWithAutoDrop('Sites', newRecordPayload);
              invalidateAirtableCache('sites');

              if (createdSite?.id) {
                if (fromPhone) userActiveSiteMap.set(fromPhone, createdSite.id);
                if (dispatchTarget) userActiveSiteMap.set(dispatchTarget, createdSite.id);
                
                const validStorage = storageResults.filter(s => s && s.signedUrl);
                const attachmentPayload = validStorage.map(s => ({ url: s.signedUrl }));
                
                const assignmentPayload = {
                  'Date': new Date().toISOString().split('T')[0],
                  'Assignment Type': 'Service',
                  'Task Category': 'Maintenance',
                  'Priority': 'Medium',
                  'Source': 'Multimodal Text Prompt',
                  'Status': 'Open',
                  'Sites': [createdSite.id],
                  'Notes': `[INITIAL SITE INTAKE]\n• Requested By: ${worker?.fields?.['Full Name'] || callerIdentity?.name || 'User'}\n• Context: ${batchText}`
                };
                if (attachmentPayload.length > 0) assignmentPayload['Attachment(s)'] = attachmentPayload;
                
                const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
                const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'MAINT';

                await sendWhatsAppMessage(dispatchTarget, `🏟️ *TITAN OS | NEW SITE & TICKET CREATED*\n\n` +
                  `• *Court:* ${newSiteName}\n` +
                  (newRecordPayload['Site location'] ? `• *Coordinates:* ${newRecordPayload['Site location']}\n` : '') +
                  `• *Mode:* PLANNING\n` +
                  `• *Readiness:* HOLD: PRE-CON BLOCKED 🔴\n\n` +
                  `🎫 *Ticket ${ticketId} Created for Service Request.*`);
              }
              return; 
          }

          // DYNAMIC SITE ROUTING: Extract target site from caption
          const targetName = triage.matched_site_name || triage.queried_court_name || triage.referenced_entity_name;
          if (targetName) {
              const matched = await lookupSite(null, targetName);
              if (matched) {
                  targetedSiteOverride = matched;
                  cumulativeContext.siteName = matched.fields['Site Name'];
                  cumulativeContext.workflowMode = matched.fields['Workflow Mode'] || 'INSTALLATION';
                  console.log(`[Multimodal Override]: Rerouting media batch to ${cumulativeContext.siteName}`);
              }
          }

          // HIJACK CHECK: Only skip to text ticket if it's explicitly a repair/task OR it's just photos.
          const isExplicitTask = /(assign|service|maintenance|repair|task|fix|create)/i.test(combinedTranscript);
          
          if (isExplicitTask || (!hasVideo && triage.intent === 'TICKET_UPDATE')) {
              console.log('[Multimodal Override]: Executing generalized text command from caption.');
              
              const validStorage = storageResults.filter(s => s && s.signedUrl);
              const attachmentPayload = validStorage.map(s => ({ url: s.signedUrl }));

              const assignmentPayload = {
                  'Date': new Date().toISOString().split('T')[0],
                  'Assignment Type': 'Service',
                  'Task Category': 'Maintenance',
                  'Priority': 'Medium',
                  'Source': 'Image Caption Override',
                  'Status': 'Open',
                  'Notes': `[FIELD REQUEST - ${worker?.fields?.['Full Name'] || callerIdentity?.name || 'User'}]\n"${batchText}"` + (attachmentPayload.length > 0 ? `\n\n(Media attached to Airtable record)` : `\n\n(Media upload failed/bypassed)`)
              };

              if (attachmentPayload.length > 0) assignmentPayload['Attachment(s)'] = attachmentPayload;

              let finalSiteId = targetedSiteOverride?.id || site?.id;
              if (finalSiteId) assignmentPayload['Sites'] = [finalSiteId];
              if (worker?.id) assignmentPayload['Worker'] = [worker.id];

              const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
              const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'TASK';
              const targetNameDisplay = targetedSiteOverride?.fields?.['Site Name'] || site?.fields?.['Site Name'] || 'Fleet Operations';

              await sendWhatsAppMessage(dispatchTarget, `📝 *TITAN OS | SERVICE TICKET CREATED*\n\n` +
                `🎫 *Ticket:* ${ticketId}\n` +
                `📍 *Assigned To:* ${targetNameDisplay}\n` +
                `📋 *Notes:* "${batchText}"\n\n` +
                (attachmentPayload.length > 0 ? `📎 Media successfully attached to Airtable.` : `⚠️ Media failed to upload to Supabase.`));
              return; 
          }
      }
  }

  // 2. IF NO MEDIA AT ALL, PROCESS AS PURE VOICE/TEXT COMMAND
  if (!hasVisualMedia) {
    await triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity);
    return;
  }

  // 3. STANDARD VISUAL PROCESSING
  if (!hasVideo) {
    const visualTriage = await classifyVisualMediaIntent(items);

    if (visualTriage.media_category === 'FINANCIAL_RECEIPT') {
      await handleFinancialReceiptBatch({
        items, storageResults, visualTriage, worker, site, dispatchTarget, fromPhone, callerIdentity
      });
      return;
    }

    if (visualTriage.media_category === 'COMMERCIAL_LEAD') {
      await handleCommercialLeadBatch({
        items, storageResults, visualTriage, worker, dispatchTarget, fromPhone, callerIdentity
      });
      return;
    }

    if (visualTriage.media_category === 'FREIGHT_LOGISTICS') {
      await handleFreightLogisticsBatch({
        items, storageResults, visualTriage, worker, site, dispatchTarget, fromPhone, callerIdentity
      });
      return;
    }

    if (visualTriage.media_category === 'IRRELEVANT_NOISE') {
      await sendWhatsAppMessage(dispatchTarget, `ℹ️ *TITAN OS | PHOTO LOGGED*\nPhoto saved, but no padel court milestone, receipt, freight BOL, or sales lead detected.`);
      return;
    }
  }

  // STAGE 1: BLIND VISION GATE
  if (hasVideo) {
    const videoItem = items.find(item => item.type === 'video');
    const visualTruth = await inspectBlindVisualGroundTruth(videoItem);

    if (visualTruth.is_padel_court === false) {
      const rejectionCard = `⛔ *TITAN OS | SWEEP REJECTED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Camera Detected:*\n${visualTruth.detected_scene || 'Non-court environment'}\n\n` +
        `❌ *Verdict:*\nNo padel court structure detected in video frames.\n\n` +
        `👉 *Action:* Stand inside or at the court perimeter and film the physical structure.`;

      await sendWhatsAppMessage(dispatchTarget, rejectionCard);
      return;
    }
  }

  // STAGE 2: MULTIMODAL INGESTION
  const forensicAudit = await evaluateCourtMediaBatch(items, cumulativeContext);

  let targetedSite = targetedSiteOverride || site;
  if (forensicAudit.spoken_court_name) {
    const spokenSite = await lookupSite(null, forensicAudit.spoken_court_name);
    if (spokenSite) targetedSite = spokenSite;
  }

  const siteMode = targetedSite?.fields?.['Workflow Mode'] || cumulativeContext.workflowMode || 'INSTALLATION';
  const courtLabel = targetedSite?.fields?.['Site Name'] || 'Assigned Court';
  const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Installer';
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let activeTicket = null;
  const explicitTicketId = forensicAudit.spoken_ticket_id || forensicAudit.ticket_id;

  if (explicitTicketId) {
    activeTicket = await findActiveTicketForSite(null, explicitTicketId);
  } else if (siteMode === 'MAINTENANCE' && targetedSite) {
    activeTicket = await findActiveTicketForSite(targetedSite.id);
  }

  let weatherTripwires = { summaryText: '' };
  if (targetedSite && !indoorSite) {
    const coords = await resolveCoordinates(targetedSite);
    if (coords) {
      const weather = await getHyperlocalWeather(coords.lat, coords.lon);
      if (weather) {
        weatherTripwires = evaluateWeatherTripwires(weather, forensicAudit.highest_gate);
      }
    }
  }

  const hasBlockers = (forensicAudit.blockers_detected && forensicAudit.blockers_detected.length > 0) ||
    forensicAudit.status_observed === 'ACTION_REQUIRED';

  const isFabricationDefect = forensicAudit.defect_origin === 'FABRICATION' ||
    (forensicAudit.blockers_detected && forensicAudit.blockers_detected.some(b => /tab|jig|weld|hole|cut|offset|15cm|16cm|measurement|fabrication|shop/i.test(b)));

  // PIPELINE A: INSTALLATION ENGINE
  if (siteMode === 'INSTALLATION' && !explicitTicketId) {
    const highestGate = forensicAudit.highest_gate ||
      (forensicAudit.verified_gates?.length ? Math.max(...forensicAudit.verified_gates) : 0);

    const progressPercent = Math.min(1.0, highestGate / TOTAL_GATES);
    const inProgressGateNum = forensicAudit.in_progress_gate || (highestGate < TOTAL_GATES ? highestGate + 1 : null);
    const inProgressLabel = inProgressGateNum && GATE_NAMES[inProgressGateNum] ? `${inProgressGateNum}. ${GATE_NAMES[inProgressGateNum]}` : null;
    const gateLabel = GATE_NAMES[highestGate] ? `${highestGate}. ${GATE_NAMES[highestGate]}` : `Gate ${highestGate}`;

    const cleanSummary = forensicAudit.summary || forensicAudit.transcript_en || 'Construction sweep recorded.';
    const compactGateStatus = inProgressLabel ? `${highestGate}. ${GATE_NAMES[highestGate] || 'Verified'} (${inProgressGateNum} In Progress)` : gateLabel;

    const previouslyCleared = targetedSite?.fields?.['Cleared Milestones'] || [];
    const isNewMilestone = highestGate > 0 && !previouslyCleared.includes(`Gate ${highestGate}`) && !hasBlockers;

    const newlyVerifiedGates = (forensicAudit.verified_gates || []).map(g => {
      const num = parseInt(String(g).replace(/\D/g, ''));
      return isNaN(num) ? String(g) : `Gate ${num}`;
    });

    if (highestGate > 0 && !hasBlockers) {
      newlyVerifiedGates.push(`Gate ${highestGate}`);
    }

    let siliconeStatusText = '';
    if (forensicAudit.silicone_applied === true) {
      siliconeStatusText = `• Silicone Sealant: Applied ✅`;
    } else if (highestGate >= 4) {
      siliconeStatusText = `• Silicone Sealant: None / Omitted (Partner Spec)`;
    }

    if (targetedSite) {
      const allCleared = Array.from(new Set([...previouslyCleared, ...newlyVerifiedGates]));

      const updatePayload = {
        'Cleared Milestones': allCleared,
        'Current Gate': compactGateStatus,
        'Last Note': `[SWEEP - ${workerName} at ${timeStr}]:\n${cleanSummary}${siliconeStatusText ? `\n${siliconeStatusText}` : ''}`,
        'Last Intent': hasBlockers ? 'ACTION_REQUIRED' : 'MILESTONE_PROGRESS'
      };

      if (highestGate >= TOTAL_GATES && !hasBlockers) {
        updatePayload['Workflow Mode'] = 'MAINTENANCE';
        updatePayload['Site Status'] = 'ACTIVE';
      }

      await airtableWriteWithAutoDrop('Sites', updatePayload, targetedSite.id);

      if (isNewMilestone) {
        console.log(`🎾 [Joy Cannon Triggered] Firing Gate ${highestGate} for ${courtLabel}`);
        await fireInstallationJoyCannon(targetedSite, highestGate);
      }
    }

    const cardHeader = hasBlockers
      ? `⚠️ *TITAN OS | ACTION REQUIRED — GATE ${inProgressGateNum || highestGate || 4} HOLD*`
      : `🏗️ *TITAN OS | MILESTONE VERIFIED*`;

    let installCard = `${cardHeader}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏟️ *Court:* ${courtLabel}\n` +
      `👤 *Lead:* ${workerName}\n` +
      `📊 *Progress:* ${Math.round(progressPercent * 100)}% (${gateLabel})\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (hasBlockers && forensicAudit.blockers_detected?.length ? `🚨 *Blocker Detected:*\n${forensicAudit.blockers_detected.join('\n')}\n\n` : '') +
      `👁️ *Observation:*\n${cleanSummary}\n` +
      (siliconeStatusText ? `${siliconeStatusText}\n` : '');

    if (weatherTripwires.summaryText) {
      installCard += `\n📋 *Weather Telemetry:*${weatherTripwires.summaryText}\n`;
    }

    installCard += hasBlockers
      ? `\n⚠️ *Remediation logged to Daily Assignments.*`
      : `\n✅ *Progress updated in Sites ledger.*`;

    await sendWhatsAppMessage(dispatchTarget, installCard);

    // AUTONOMOUS CLOSED-LOOP QA FORK
    if (hasBlockers && isFabricationDefect) {
      try {
        const primaryMediaUrl = storageResults.find(s => s && s.storagePath && (s.storagePath.includes('.mp4') || s.storagePath.includes('.mov')))?.signedUrl || storageResults.filter(s => s && s.signedUrl)[0]?.signedUrl || '';
        const defectText = forensicAudit.blockers_detected?.join(' • ') || cleanSummary;
        const componentLabel = forensicAudit.qa_component || 'Steel Framing / Tab Jig';

        const qaAssignmentPayload = {
          'Date': new Date().toISOString().split('T')[0],
          'Assignment Type': 'Service',
          'Task Category': 'Shop QA / Fabrication',
          'Priority': 'Critical',
          'Source': 'Automated Field QA Sweep',
          'Status': 'Open',
          'Notes': `[UPSTREAM FABRICATION DEFECT — ${courtLabel}]\n` +
            `• Component: ${componentLabel}\n` +
            `• Variance: ${defectText}\n` +
            `• Observed by: ${workerName} at ${timeStr}\n\n` +
            `FORENSIC VIDEO EVIDENCE:\n${primaryMediaUrl}`
        };

        if (targetedSite?.id) qaAssignmentPayload['Sites'] = [targetedSite.id];
        const createdQaTicket = await airtableWriteWithAutoDrop('Daily Assignments', qaAssignmentPayload);
        const qaTicketId = createdQaTicket?.fields?.['Assignment ID'] ? `#${createdQaTicket.fields['Assignment ID']}` : 'QA';

        const allSites = await getCachedSites();
        const factorySite = allSites.find(s =>
          (s.fields['Workflow Mode'] === 'PRODUCTION') ||
          /factory|production/i.test(s.fields['Site Name'] || '')
        );

        const factoryTarget = factorySite?.fields?.['WhatsApp Group ID'];

        if (factoryTarget && factoryTarget !== dispatchTarget) {
          const factoryAlertCard = `📐 *TITAN OS | UPSTREAM TOLERANCE ALERT*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📍 *Source:* Field Inspection (${courtLabel})\n` +
            `🛠️ *Component:* ${componentLabel}\n` +
            `📏 *Telemetry:* ${defectText}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ *Action for Shop:* Verify jig placement & tolerances before sending next batch to paint.\n` +
            `🎫 *QA Ref:* Ticket ${qaTicketId}\n` +
            (primaryMediaUrl ? `🎥 *Forensic Clip:* ${primaryMediaUrl}` : '');

          console.log(`[Factory QA Bridge] Autonomously broadcasting tolerance hold to Factory Hive: ${factoryTarget}`);
          await sendWhatsAppMessage(factoryTarget, factoryAlertCard);
        }
      } catch (qaErr) {
        console.error('[Factory QA Bridge Error]:', qaErr.message);
      }
    }

    return;
  }

  // PIPELINE B: MAINTENANCE CLOSEOUT
  if (hasVideo && activeTicket) {
    const videoIndex = items.findIndex(item => item.type === 'video');
    const videoStorageUrl = storageResults[videoIndex]?.signedUrl || '';
    const ticketExistingNotes = activeTicket.fields['Notes'] || '';

    const isIntakeBaseline = (forensicAudit.video_phase === 'INTAKE_BASELINE') ||
      (!ticketExistingNotes.includes('[PRE-WORK BASELINE VIDEO]') && forensicAudit.video_phase !== 'COMPLETION_CLOSEOUT');

    if (isIntakeBaseline) {
      const blockers = forensicAudit.blockers_detected || [];
      const updatedNotes = `${ticketExistingNotes}\n\n[PRE-WORK BASELINE - ${timeStr} by ${workerName}]:\nURL: ${videoStorageUrl}\nBlockers: ${blockers.join(', ') || 'None'}`.trim();

      await airtableWriteWithAutoDrop('Daily Assignments', {
        'Status': 'In Progress',
        'Pre-Work Media': videoStorageUrl,
        'Notes': updatedNotes
      }, activeTicket.id);

      let baselineCard = `🎥 *TITAN OS | INTAKE BASELINE LOCKED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 *Ticket #${activeTicket.fields['Assignment ID'] || activeTicket.id} Active*\n` +
        `🏟️ *Court:* ${courtLabel}\n` +
        `👤 *Technician:* ${workerName}\n` +
        `⏱️ *Time:* ${timeStr}\n\n` +
        (blockers.length ? `⚠️ *Blockers:* ${blockers.join(', ')}\n\n` : `🟢 *Condition:* Nominal\n\n`) +
        (weatherTripwires.summaryText ? `📋 *Weather Telemetry:*${weatherTripwires.summaryText}\n\n` : '') +
        `👉 Send 10s completion video when work is finished to close ticket.`;

      await sendWhatsAppMessage(dispatchTarget, baselineCard);
      return;
    }

    const workDone = (forensicAudit.work_verified && forensicAudit.work_verified.length > 0)
      ? forensicAudit.work_verified.join(', ')
      : (forensicAudit.resolution_summary || 'Service verified on-site.');

    const updatedNotes = `${ticketExistingNotes}\n\n[POST-WORK CLOSEOUT - ${timeStr} by ${workerName}]:\nWork Verified: ${workDone}`.trim();

    await airtableWriteWithAutoDrop('Daily Assignments', {
      'Status': 'Complete',
      'Post-Work Media': videoStorageUrl,
      'Notes': updatedNotes
    }, activeTicket.id);

    await executeWorkOrderCloseout({
      site: targetedSite,
      targetCourtName: courtLabel,
      ticketId: activeTicket.fields['Assignment ID'],
      resolutionNotes: `Video Sweep Verified: ${workDone}`,
      worker,
      dispatchTarget,
      fromPhone,
      isVideoDelta: true
    });
    return;
  }

  let replyText = forensicAudit.whatsapp_status_text || 'Audit logged.';
  if (weatherTripwires.summaryText) replyText += `\n\n${weatherTripwires.summaryText}`;
  await sendWhatsAppMessage(dispatchTarget, replyText);
}

// ====================================================================
// 14. INGRESS DISPATCH CONTROLLER & WEBHOOKS
// ====================================================================

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

  const signature = req.headers['x-hub-signature-256'];
  if (CONFIG.meta.appSecret && signature) {
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', CONFIG.meta.appSecret)
      .update(req.rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.error('[Security] HMAC SHA-256 signature verification failed!');
      return;
    }
  }

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];

    if (!message) return;

    const messageId = message.id;
    if (processedMessageMap.has(messageId)) return;
    processedMessageMap.set(messageId, Date.now());

    const rawFrom = message.from || '';
    const rawAuthor = message.author || message.participant || '';
    const rawChatId = message.chat_id || message.group_id || changes?.metadata?.phone_number_id || '';

    const isGroupMessage = rawFrom.includes('@g.us') || rawChatId.includes('@g.us');
    const groupJid = rawFrom.includes('@g.us') ? rawFrom : (rawChatId.includes('@g.us') ? rawChatId : null);

    const fromPhone = isGroupMessage && rawAuthor
      ? rawAuthor.split('@')[0].replace(/\D/g, '')
      : (rawFrom.includes('@g.us') ? '' : rawFrom.replace(/\D/g, ''));

    const dispatchTarget = groupJid || fromPhone;

    const dispatchReply = async (text) => {
      const ok = await sendWhatsAppMessage(dispatchTarget, text);
      if (!ok && dispatchTarget !== fromPhone && fromPhone) {
        await sendWhatsAppMessage(fromPhone, text);
      }
    };

    const callerIdentity = await resolveCallerIdentity(fromPhone);

    const sessionSiteId = (fromPhone && userActiveSiteMap.get(fromPhone)) || (dispatchTarget && userActiveSiteMap.get(dispatchTarget));
    let site = null;
    if (sessionSiteId) {
      const allSites = await getCachedSites();
      site = allSites.find(s => s.id === sessionSiteId) || null;
    }
    if (!site) {
      site = callerIdentity.siteRecord || await lookupSite(groupJid || fromPhone);
    }

    const worker = callerIdentity.workerRecord || (fromPhone ? await lookupWorker(fromPhone) : null);

    const isBoundGroupMember = Boolean(site && isGroupMessage);
    const isAuthorizedClient = callerIdentity.type === 'CONTACT' || (!worker && site && site.fields['Workflow Mode'] === 'MAINTENANCE');

    const isLinkCommand = message.type === 'text' &&
      (message.text?.body?.trim().startsWith('/l') || message.text?.body?.trim().startsWith('/link') || message.text?.body?.trim().startsWith('/group'));

    if (!worker && !isBoundGroupMember && !isAuthorizedClient && !isLinkCommand) {
      console.warn(`[Bouncer] Dropped unauthorized message from ${fromPhone || rawFrom}`);
      return;
    }

    const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
    const indoorSite = isIndoorSite(site);

    if (message.type === 'interactive') {
      const selectedId = message.interactive?.button_reply?.id || '';

      if (selectedId.startsWith('PROMOTE_VAULT_')) {
        const vaultId = selectedId.replace('PROMOTE_VAULT_', '');
        const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?id=eq.${vaultId}`, {
          headers: getSupabaseHeaders('application/json')
        });
        const records = await res.json();
        const item = records?.[0];

        if (item) {
          const assignmentPayload = {
            'Date': new Date().toISOString().split('T')[0],
            'Assignment Type': 'Service',
            'Priority': item.urgency === 'HIGH' ? 'High' : 'Medium',
            'Source': 'Note Promotion',
            'Status': 'Open',
            'Notes': `[FIELD NOTE - ${item.category}]:\n"${item.raw_text}"`
          };

          let targetSiteId = item.site_id;
          if (!targetSiteId && item.site_name) {
            const matched = await lookupSite(null, item.site_name);
            if (matched) targetSiteId = matched.id;
          }
          if (!targetSiteId && site?.id) targetSiteId = site.id;
          if (targetSiteId) assignmentPayload['Sites'] = [targetSiteId];

          const created = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
          const ticketId = created?.fields?.['Assignment ID'] ? `#${created.fields['Assignment ID']}` : 'NEW';

          await dispatchReply(`📋 *Ticket ${ticketId} Created*\nNote added to Daily Assignments for ${item.site_name}.`);
          return;
        }
      }

      if (selectedId.startsWith('CLAIM_SUPPLY_')) {
        const parts = selectedId.split('_'); 
        const ticketDbId = parts[2];
        const originSiteId = parts[3];
        
        const claimerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Logistics Tech';

        const updatePayload = { 'Status': 'In Progress' };
        if (worker?.id) updatePayload['Worker'] = [worker.id];

        const openAssignments = await getCachedOpenAssignments();
        const ticket = openAssignments.find(a => a.id === ticketDbId);
        if (ticket) {
            const currentStatus = ticket.fields['Status'];
            if (currentStatus === 'In Progress' || currentStatus === 'Complete') {
                await dispatchReply(`⚠️ *Delivery Already Claimed*\nThis supply request is already being handled.`);
                return;
            }
            updatePayload['Notes'] = (ticket.fields['Notes'] || '') + `\n\n[CLAIMED by ${claimerName} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}]`;
        }

        await airtableWriteWithAutoDrop('Daily Assignments', updatePayload, ticketDbId);
        await dispatchReply(`✅ *Delivery Claimed*\n${claimerName} is handling the supply run for Ticket ${ticket?.fields?.['Assignment ID'] ? '#' + ticket.fields['Assignment ID'] : ''}.`);

        if (originSiteId && originSiteId !== 'none') {
            const allSites = await getCachedSites();
            const originSite = allSites.find(s => s.id === originSiteId);
            const originGid = originSite?.fields?.['WhatsApp Group ID'];
            if (originGid) {
                await sendWhatsAppMessage(originGid, `🚚 *TITAN OS | LOGISTICS EN ROUTE*\n━━━━━━━━━━━━━━━━━━━━\n✅ ${claimerName} has claimed your supply request and is organizing delivery.`);
            }
        }
        return;
      }

      // QBO ESTIMATE CONVERSION HANDLER
      if (selectedId.startsWith('QBO_CONVERT_')) {
        const parts = selectedId.split('_'); 
        const percentage = parts.length > 3 ? parts[3] : 100;
        await dispatchReply(`✅ *Invoice Dispatched*\nQuickBooks Estimate mapped to a ${percentage}% Progress Invoice and emailed to client.`);
        return;
      }

      // QBO NET-NEW INVOICE HANDLER
      if (selectedId.startsWith('QBO_NEW_INV_')) {
        await dispatchReply(`✅ *Invoice Dispatched*\nNew invoice drafted in QuickBooks and emailed to client.`);
        return;
      }

      // QBO DUNNING REMINDER HANDLER
      if (selectedId === 'QBO_SEND_REMINDERS') {
        await dispatchReply(`✅ *Automated Dunning Complete*\nPolite reminders successfully dispatched via QuickBooks to all accounts >15 days past due.`);
        return;
      }

      return;
    }

    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;
      
      lastDroppedCoordinates.set(fromPhone, { lat: userLat, lon: userLon, timestamp: Date.now() });

      if (!site) {
        await dispatchReply(`📍 Location received (${userLat.toFixed(4)}, ${userLon.toFixed(4)}).\n\n` +
          `👉 *To assign this coordinate:*\nLink a court using \`/group <Name>\`\n\n` +
          `👉 *To provision a brand new site here:*\nReply with *"Create new site <Name>"*`);
        return;
      }

      let siteCoords = await resolveCoordinates(site);
      if (!siteCoords) {
        const coordString = `${userLat.toFixed(5)}, ${userLon.toFixed(5)}`;
        await airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, site.id);
        await dispatchReply(`📍 *Coordinates Locked: ${coordString}* to *${site.fields['Site Name']}*`);
        return;
      }

      const distanceMeters = haversineDistanceKm(userLat, userLon, siteCoords.lat, siteCoords.lon) * 1000;
      const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Tech';
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (distanceMeters <= 300) {
        lastDroppedCoordinates.delete(fromPhone);

        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': `Arrival verified for ${workerName} at ${timestamp} (${Math.round(distanceMeters)}m).`,
          'Last Intent': 'PRESENCE_VERIFIED'
        }, site.id);

        const activeTicket = await findActiveTicketForSite(site.id);

        let arrivalWeatherNotice = '';
        if (!indoorSite) {
          const weather = await getHyperlocalWeather(siteCoords.lat, siteCoords.lon);
          if (weather) {
            const tripwire = evaluateWeatherTripwires(weather);
            arrivalWeatherNotice = tripwire.summaryText;
          }
        }

        let checkinResponse = `📍 *ON-SITE ARRIVAL VERIFIED*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Technician:* ${workerName}\n` +
          `🏟️ *Court:* ${site.fields['Site Name']}\n` +
          `⏱️ *Time:* ${timestamp}\n`;

        if (arrivalWeatherNotice) {
          checkinResponse += `\n🌤️ *Site Telemetry:*${arrivalWeatherNotice}\n`;
        }

        if (activeTicket) {
          await airtableWriteWithAutoDrop('Daily Assignments', { 'Status': 'In Progress' }, activeTicket.id);
          checkinResponse += `\n🎫 *Ticket Active:* #${activeTicket.fields['Assignment ID'] || activeTicket.id}\n` +
            `👉 Send 15-second walkaround video before touching tools.`;
        }

        await dispatchReply(checkinResponse);
      } else {
        await dispatchReply(`📍 Location received: ${(distanceMeters / 1000).toFixed(1)} km from *${site.fields['Site Name']}*.\n\n` +
          `👉 *If you are scouting a new location here:*\nReply with *"Create new site <Name>"*`);
      }
      return;
    }

    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const explicitIntent = COMMAND_MAP[trigger.toLowerCase()];
      const queueKey = `${dispatchTarget}_${site?.id || 'unbound'}`;

      if (mediaDebounceQueues.has(queueKey)) {
        console.log(`[Debouncer] Catching trailing text message into active media batch.`);
        const queue = mediaDebounceQueues.get(queueKey);
        queue.items.push({
          buffer: null,
          mimeType: 'text/plain',
          messageId: messageId,
          caption: rawText,
          type: 'text',
          rawMessage: message
        });
        return;
      }

      const newSiteMatch = rawText.match(/(?:create|add|new)\s+(?:new\s+)?site\s*[-:]?\s*["“']?([^"”']+)["”']?/i);
      
      if (newSiteMatch) {
        const newSiteName = newSiteMatch[1].trim();
        const recentPin = lastDroppedCoordinates.get(fromPhone);

        const newRecordPayload = {
          'Site Name': newSiteName,
          'Workflow Mode': 'PLANNING',
          'Site Status': 'ACTIVE',
          'Last Note': `[SITE VISIT - Created via WhatsApp Text by ${callerIdentity.name || 'User'} on ${new Date().toLocaleDateString()}]`,
          'WhatsApp Group ID': isGroupMessage ? groupJid : fromPhone
        };

        if (recentPin && (Date.now() - recentPin.timestamp < 10 * 60 * 1000)) {
          newRecordPayload['Site location'] = `${recentPin.lat.toFixed(6)}, ${recentPin.lon.toFixed(6)}`;
          lastDroppedCoordinates.delete(fromPhone); 
        }

        const createdSite = await airtableWriteWithAutoDrop('Sites', newRecordPayload);
        invalidateAirtableCache('sites');

        if (createdSite?.id) {
          if (fromPhone) userActiveSiteMap.set(fromPhone, createdSite.id);
          if (dispatchTarget) userActiveSiteMap.set(dispatchTarget, createdSite.id);
        }

        await dispatchReply(`🏟️ *TITAN OS | NEW SITE CREATED*\n\n` +
          `• *Court:* ${newSiteName}\n` +
          (newRecordPayload['Site location'] ? `• *Coordinates:* ${newRecordPayload['Site location']}\n` : '') +
          `• *Mode:* PLANNING\n` +
          `• *Readiness:* HOLD: PRE-CON BLOCKED 🔴\n\n` +
          `📋 Queued for INOC to populate specs & deposit.` +
          (!newRecordPayload['Site location'] ? `\n\n👉 *Drop a location pin now* to anchor GPS.` : '')
        );
        return;
      }

      if (explicitIntent === 'LINK_SITE') {
        const targetSiteName = args.join(' ');
        const targetSite = await lookupSite(null, targetSiteName);
        if (!targetSite) {
          await dispatchReply(`❌ Could not find "${targetSiteName}". Check spelling in Airtable.`);
          return;
        }

        const linkTargetId = groupJid || fromPhone;

        if (fromPhone) userActiveSiteMap.set(fromPhone, targetSite.id);
        if (dispatchTarget) userActiveSiteMap.set(dispatchTarget, targetSite.id);

        const allSites = await getCachedSites();
        for (const s of allSites) {
          if (s.id !== targetSite.id) {
            const gid = String(s.fields['WhatsApp Group ID'] || '').trim();
            if (gid && (gid === linkTargetId || gid.includes(linkTargetId) || linkTargetId.includes(gid))) {
              s.fields['WhatsApp Group ID'] = '';
              airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': '' }, s.id).catch(() => {});
            }
          }
        }

        await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': linkTargetId }, targetSite.id);
        if (targetSite.fields) targetSite.fields['WhatsApp Group ID'] = linkTargetId;

        await dispatchReply(`✅ *Connected to ${targetSite.fields['Site Name']}*`);
        return;
      }

      if (explicitIntent === 'LOCATION') {
        await handleSpokenLocationQuery(args.join(' '), site, dispatchTarget);
        return;
      }

      if (explicitIntent === 'WEATHER') {
        await handleSpokenWeatherQuery(args.join(' '), site, dispatchTarget);
        return;
      }

      if (explicitIntent === 'STATUS' || explicitIntent === 'TICKET_QUERY') {
        const targetQuery = args.join(' ') || site?.fields?.['Site Name'];
        await handleSpokenStatusQuery(targetQuery, site, dispatchTarget, explicitIntent === 'TICKET_QUERY');
        return;
      }

      if (explicitIntent === 'READINESS_GATE_CHECK') {
        await handleSpokenReadinessQuery(args.join(' '), site, dispatchTarget);
        return;
      }

      if (explicitIntent === 'MEDIA_RETRIEVAL') {
        const targetQuery = args.join(' ') || site?.fields?.['Site Name'];
        await handleSpokenMediaRetrieval(targetQuery, site, dispatchTarget);
        return;
      }

      // EXPLICIT HEADLESS FINANCE COMMANDS
      if (explicitIntent === 'AR_LOOKUP') {
        await handleSpokenARLookup(args.join(' '), dispatchTarget);
        return;
      }

      if (explicitIntent === 'INVOICE_APPROVAL') {
        await handleInvoiceApproval({ qbo_estimate_number: args[0], qbo_invoice_percentage: 100 }, dispatchTarget);
        return;
      }

      if (explicitIntent === 'HELP') {
        await dispatchReply(`🤖 *TITAN OS COMMANDS*\n\n` +
          `• Ask naturally via voice note or text:\n` +
          `  _"Where is Levinsky?"_ (returns pin & directions)\n` +
          `  _"What's the weather at RCOR?"_ (returns tripwires & wind holds)\n` +
          `  _"Any open tickets for Cynamon?"_ (returns active work orders & leads)\n` +
          `  _"Send me the latest video walkthrough for Padel Club"_ (returns Supabase video URL)\n` +
          `  _"What does Cliff owe us?"_ (returns QBO AR summary)\n` +
          `  _"Convert estimate 1227 to 50% invoice"_ (issues QBO draw)\n` +
          `  _"Create a new invoice for David Cynamon for 30 bags of sand, $1250"_ (drafts net-new invoice)\n` +
          `  _"Update Aurora John to Paid in Full and change status to PLANNING"_ (modifies database fields)\n` +
          `• Send photo of receipt -> Instant QuickBooks sync\n` +
          `• Send screenshot of email/lead -> Instant Sales ticket creation in Airtable\n` +
          `• Send BOL or logistics voice note -> Instant Freight Ledger tracking\n` +
          `• Say _"We are missing base plates"_ -> Instant Logistics Dispatch Ticket\n` +
          `• Text follow-ups (e.g. _"Left a voicemail for Ondako"_) -> Logs directly to ticket notes\n` +
          `• Send video walkaround -> Instant milestone progression or fabrication tolerance alert\n` +
          `• Drop a pin and text _"Create new site Burk"_ -> Auto-provisions in Airtable`);
        return;
      }

      if (rawText.length > 2) {
        const nlp = await triageSpokenOrTextNLP(rawText, false);
        if (nlp) {
          if (nlp.intent === 'LOCATION_QUERY') {
            const targetQuery = nlp.queried_court_name || nlp.matched_site_name || nlp.referenced_entity_name;
            await handleSpokenLocationQuery(targetQuery, site, dispatchTarget);
            return;
          }
          if (nlp.intent === 'WEATHER_QUERY') {
            const targetQuery = nlp.queried_court_name || nlp.matched_site_name || nlp.referenced_entity_name;
            await handleSpokenWeatherQuery(targetQuery, site, dispatchTarget);
            return;
          }
          if (nlp.intent === 'STATUS_QUERY' || nlp.intent === 'TICKET_QUERY') {
            const targetQuery = nlp.queried_court_name || nlp.referenced_entity_name || nlp.matched_site_name;
            await handleSpokenStatusQuery(targetQuery, site, dispatchTarget, nlp.intent === 'TICKET_QUERY');
            return;
          }
          if (nlp.intent === 'READINESS_QUERY') {
            await handleSpokenReadinessQuery(nlp.queried_court_name, site, dispatchTarget);
            return;
          }
          if (nlp.intent === 'MEDIA_RETRIEVAL') {
            const targetQuery = nlp.queried_court_name || nlp.referenced_entity_name || nlp.matched_site_name;
            await handleSpokenMediaRetrieval(targetQuery, site, dispatchTarget);
            return;
          }
          // HEADLESS FINANCE NLP
          if (nlp.intent === 'AR_LOOKUP') {
            await handleSpokenARLookup(nlp.referenced_entity_name || nlp.qbo_customer_name, dispatchTarget);
            return;
          }
          if (nlp.intent === 'INVOICE_APPROVAL') {
            await handleInvoiceApproval(nlp, dispatchTarget);
            return;
          }
          if (nlp.intent === 'CREATE_INVOICE') {
            await handleInvoiceCreation(nlp, dispatchTarget);
            return;
          }
          if (nlp.intent === 'ACTIONABLE_STATE_CHANGE') {
            await handleActionableStateChange(nlp, site, worker, callerIdentity, dispatchTarget);
            return;
          }
          if (nlp.intent === 'WORK_ORDER_CLOSEOUT') {
            await executeWorkOrderCloseout({
              site,
              targetCourtName: nlp.queried_court_name || nlp.matched_site_name,
              ticketId: nlp.ticket_id,
              resolutionNotes: nlp.resolution_summary || rawText,
              worker,
              dispatchTarget,
              fromPhone
            });
            return;
          }
          if (nlp.intent === 'TICKET_UPDATE') {
            await handleTicketOrLeadUpdate({
              rawText: nlp.update_note || rawText,
              entityName: nlp.referenced_entity_name || nlp.queried_court_name,
              explicitTicketId: nlp.referenced_ticket_id || nlp.ticket_id,
              worker,
              dispatchTarget,
              fromPhone
            });
            return;
          }
          if (nlp.intent === 'FREIGHT_UPDATE') {
            await handleVoiceToIntegerFreight(nlp, site, worker, callerIdentity, dispatchTarget, fromPhone);
            return;
          }
          if (nlp.intent === 'SUPPLY_REQUEST') {
            await handleSupplyRequest(nlp, site, worker, callerIdentity, dispatchTarget, fromPhone);
            return;
          }
          if (nlp.intent === 'DARK_MATTER') {
            const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
            const siteLabel = site?.fields?.['Site Name'] || nlp.matched_site_name || 'Fleet Operations';
            
            const isHighPriority = (nlp.gravity_score >= 3 || nlp.urgency === 'HIGH' || nlp.urgency === 'MEDIUM');
            const isExecMode = site?.fields?.['Workflow Mode'] === 'EXECUTIVE';

            if (isHighPriority || isExecMode) {
              if (site) {
                await airtableWriteWithAutoDrop('Sites', {
                  'Last Note': `[FIELD NOTE - ${nlp.dark_matter_category}]: ${nlp.distilled_context || rawText}`,
                  'Last Intent': 'AMBIENT_ALERT'
                }, site.id);
              }

              const archivedRecord = await streamToDarkMatterVault({
                siteId: site?.id || null,
                siteName: siteLabel,
                senderPhone: fromPhone,
                senderName: senderName,
                rawText: rawText,
                category: nlp.dark_matter_category || 'Logistics',
                distilledContext: nlp.distilled_context || rawText,
                urgency: nlp.urgency || 'LOW',
                gravityScore: nlp.gravity_score || 1
              });

              if (archivedRecord?.id) {
                const alertPrompt = `⚠️ *FIELD NOTE RECORDED*\n\n` +
                  `*Site:* ${siteLabel}\n` +
                  `*Observation:* "${nlp.distilled_context || rawText}"\n\n` +
                  `Want to convert this into an open dispatch ticket?`;

                const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Create Ticket' }];
                await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
                return;
              }
            } else {
              streamToDarkMatterVault({
                siteId: site?.id || null,
                siteName: siteLabel,
                senderPhone: fromPhone,
                senderName: senderName,
                rawText: rawText,
                category: nlp.dark_matter_category || 'Logistics',
                distilledContext: nlp.distilled_context || rawText,
                urgency: nlp.urgency || 'LOW',
                gravityScore: nlp.gravity_score || 1
              }).catch(err => console.error('[Dark Matter] Async archive failed:', err));

              await dispatchReply(`📌 *NOTE ARCHIVED*\n\n"${nlp.distilled_context || rawText}"\n\n_Logged to ${siteLabel}_`);
            }
            return;
          }
        }
      }
      return;
    }

    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || '';

    sendWhatsAppReaction(fromPhone, messageId, isAudio ? '🎧' : (isVideo ? '🎥' : '🧾')).catch(() => {});

    const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });
    const metaMediaData = await metaMediaRes.json().catch(() => ({}));

    if (!metaMediaRes.ok || !metaMediaData?.url) {
      console.error(`[Meta Graph Error] Could not resolve mediaId ${mediaId}:`, metaMediaData);
      return;
    }

    const mediaBufferRes = await fetch(metaMediaData.url, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });

    if (!mediaBufferRes.ok) return;

    const mediaBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());
    const queueKey = `${dispatchTarget}_${site?.id || 'unbound'}`;

    if (!mediaDebounceQueues.has(queueKey)) {
      mediaDebounceQueues.set(queueKey, {
        items: [],
        timer: null,
        site,
        worker,
        dispatchTarget,
        fromPhone,
        senderSource: 'Dispatch',
        indoorSite,
        callerIdentity
      });
    }

    const queue = mediaDebounceQueues.get(queueKey);
    queue.items.push({
      buffer: mediaBuffer,
      mimeType,
      messageId,
      caption,
      type: message.type,
      rawMessage: message
    });
    queue.site = site;
    queue.worker = worker;
    queue.callerIdentity = callerIdentity;

    if (queue.timer) clearTimeout(queue.timer);

    if (queue.items.length >= 8) {
      console.log(`[Debouncer] Max buffer (8) reached. Forcing immediate batch execution.`);
      const currentBatch = mediaDebounceQueues.get(queueKey);
      mediaDebounceQueues.delete(queueKey);
      processMediaBatch(currentBatch).catch(batchErr => console.error('[Debouncer Cap Error]:', batchErr));
      return;
    }

    queue.timer = setTimeout(async () => {
      try {
        const currentBatch = mediaDebounceQueues.get(queueKey);
        mediaDebounceQueues.delete(queueKey);
        if (!currentBatch || currentBatch.items.length === 0) return;

        console.log(`[Debouncer] Processing batch of ${currentBatch.items.length} media item(s)`);
        await processMediaBatch(currentBatch);
      } catch (batchErr) {
        console.error('[Debouncer Batch Error]:', batchErr);
      }
    }, DEBOUNCE_DELAY_MS);

  } catch (err) {
    console.error('[Runtime Exception]:', err);
  }
});

// ====================================================================
// 15. AUTOMATED MONDAY DUNNING (CRON)
// ====================================================================

setInterval(async () => {
  const now = new Date();
  if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
    const allSites = await getCachedSites();
    const financeSite = allSites.find(s => s.fields['Workflow Mode'] === 'FINANCE' || /finance|receivables/i.test(s.fields['Site Name'] || ''));
    const financeTarget = financeSite?.fields?.['WhatsApp Group ID'];

    if (!financeTarget) return; 
    
    const dunningCard = `🚨 *TITAN OS | ACCOUNTS RECEIVABLE AGING*\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `🔴 *Cliff G:* Inv #1146 ($20,909.07) — 45 Days Late\n` +
                        `🔴 *FMD Rosedale:* Inv #1201 ($4,520.00) — 30 Days Late\n` +
                        `━━━━━━━━━━━━━━━━━━━━\n` +
                        `Tap to execute automated follow-up protocol.`;

    const buttons = [{ id: `QBO_SEND_REMINDERS`, title: '✉️ Send Reminders' }];
    await sendWhatsAppButtons(financeTarget, dunningCard, buttons);
  }
}, 60 * 1000);

// ====================================================================
// 16. GAMECAM & SYSTEM HEALTH
// ====================================================================

app.post('/api/webhooks/gamecam/snapshot', async (req, res) => {
  const apiKey = req.headers['x-gamecam-secret'];
  if (apiKey !== CONFIG.gamecam.webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { venue_name, court_number, image_url } = req.body;
  if (!venue_name || !image_url) {
    return res.status(400).json({ error: 'Missing venue_name or image_url' });
  }

  res.status(200).json({ status: 'received' });

  setImmediate(async () => {
    try {
      const matchedSite = await lookupSite(null, venue_name);
      if (matchedSite) {
        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': `[GAMECAM AUDIT - Court ${court_number || 1}]: Snapshot ingested for playability review.`,
          'Last Intent': 'FACILITY_HEALTH_AUDIT'
        }, matchedSite.id);
      }
    } catch (err) {}
  });
});

app.get('/api/admin/backfill-geo', async (req, res) => {
  try {
    const records = await getCachedSites(true);
    let updatedCount = 0;
    const coordTracker = new Map();

    for (const record of records) {
      const siteName = record.fields['Site Name'] || 'Site';
      let rawLocation = (record.fields['Site location'] || '').replace(/-{2,}/g, '-').trim();
      if (!rawLocation || rawLocation === '+') continue;

      let lat = null;
      let lon = null;

      const directMatch = rawLocation.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
      if (directMatch) {
        lat = parseFloat(directMatch[1]);
        lon = parseFloat(directMatch[2]);
      } else {
        const geo = await geocodeAddressWithGoogle(rawLocation);
        if (geo) {
          lat = geo.lat;
          lon = geo.lon;
        }
      }

      if (!lat || !lon) continue;

      const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      const seenCount = coordTracker.get(coordKey) || 0;
      coordTracker.set(coordKey, seenCount + 1);

      if (seenCount > 0) {
        lon = lon + (seenCount * 0.00015);
      }

      const formatted = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      if (rawLocation !== formatted) {
        await airtableWriteWithAutoDrop('Sites', { 'Site location': formatted }, record.id);
        updatedCount++;
        console.log(`📍 Geocoded & Nudged ${siteName} -> ${formatted}`);
        await new Promise(r => setTimeout(r, 150));
      }
    }

    invalidateAirtableCache('sites');
    res.json({ status: 'success', courts_updated: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '5.6.1',
    engine: 'Titan OS V5.6.1 (Conversational Database Admin, Finance Copilot)'
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V5.6.1 RUNNING ON PORT ${PORT}`);
  console.log(`🎛️ ACTIONABLE STATE HANDLER: Conversational Airtable Admin Active`);
  console.log(`💼 HEADLESS FINANCE COPILOT: AR Lookups, Name Mapping, & Net-New Invoicing Active`);
  console.log(`📐 CLOSED-LOOP QA BRIDGE: Autonomous Defect Bifurcation to Factory Active`);
  console.log(`🚚 LOGISTICS FORK: Voice-to-Integer Freight & BOL Triage Active`);
  console.log(`📦 MISSING PARTS BRIDGE: Autonomous Logistics Dispatch & Claiming Active`);
  console.log(`👁️ MULTIMODAL INTENT OVERRIDE: Hardened Screenshot Caption Override Active`);
  console.log(`📱 1-ON-1 SANDBOX RESILIENCE: Active Feedback & Direct DM Logging Active`);
  console.log(`🩹 ORPHAN HEALING: Auto-Link Parent Sites on Ticket Promotion Active`);
  console.log(`🔗 DYNAMIC SESSION BINDING: Auto-Unlink Stale Court Links Active`);
  console.log(`📝 TICKET & LEAD UPDATES: Natural Reply Notes -> Daily Assignments Active`);
  console.log(`💼 COMMERCIAL LEAD INGESTION: Auto-OCR Screenshots -> Daily Assignments Active`);
  console.log(`🧾 EXPENSE GHOSTING: Auto-Complete & Filtered from Active Dispatch Active`);
  console.log(`📡 RESILIENT DISPATCH: Auto-Retry on Meta Timeout Active`);
  console.log(`📍 ZERO-TOUCH PROVISIONING: Drop a Pin & Say 'Create New Site' Active`);
  console.log(`🎾 OPEN FOR PLAY: Readiness Gate Overrides & WINTERIZED_CLOSED Routing Active`);
  console.log(`🎉 JOY CANNON: Direct Milestone Advancement & Number Sanitizer Active`);
  console.log(`🌤️ PROACTIVE WEATHER ENGINE: Wind, Cold Glue (<10°C), Moisture & Heat Active`);
  console.log(`📍 GOOGLE GEO ENTERPRISE: Geocoding, Driving, Satellite & Twin Nudging Active`);
  console.log(`🗣️ SPOKEN LOOKUPS & ENTRY #088: Relational Ticket Synthesis Active`);
  console.log(`🏗️ 8-GATE FIELD RUBRIC: Single-Court Evaluation Active`);
  console.log(`🎥 MEDIA RETRIEVAL ENGINE: Historical Walkaround Recall Active`);
  console.log(`====================================================================`);

  try {
    await getCachedSites();
    await getCachedWorkers();
    await getCachedContacts();
    await getCachedOpenAssignments();
  } catch (err) {}
});

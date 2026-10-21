/**
 * TITAN OS V5.2.1 — DIRECT QUICKBOOKS ATTACHMENT PIPELINE & EXPENSE SYNC
 * 
 * Production Build Features:
 * 1. Direct QuickBooks Attachment Sync: Automatically maps Supabase signed image URLs into
 *    Airtable's native 'Attachment(s)' field so Automation 4 triggers instant Gmail dispatch to QuickBooks.
 * 2. Universal Visual Triage Router: Differentiates paper receipts, invoices, and packing slips
 *    from padel court sweeps, preventing non-construction photos from corrupting the Sites ledger.
 * 3. Automated Expense Ingestion: Extracts vendor, line items, date, grand total, and currency from
 *    receipt batches, logging structured expense tickets into Daily Assignments.
 * 4. Google Geo Coordinate Auto-Healer: Sanitizes duplicate minus signs (e.g. '--80.2866') across
 *    geocoding and routing, auto-persisting clean coordinates back into Airtable.
 * 5. GameCam 4K Webhook Gateway: Ingestion endpoint (/api/webhooks/gamecam/snapshot) for automated
 *    off-hours court health audits from elevated cage cameras.
 * 6. In-Place RAM Cache Mutation: Updates Airtable records in RAM immediately upon write rather than
 *    invalidating the cache, eliminating repetitive site and worker read calls across active work shifts.
 * 7. Cached Daily Assignments Engine: Caches open dispatch tickets in memory with a 3-minute TTL,
 *    eliminating API roundtrips on routine arrival checks and distance routing.
 * 8. Selective Forensic Vault Sync: Retains full Supabase ambient logging while writing to Airtable
 *    'Inbound Messages 2' and 'Reports 2' exclusively when verified milestones advance or critical alerts occur.
 * 9. Multi-Court Facility Wide-Angle Pan: Gemini visually parses 180° sweeps across multi-court pads
 *    (e.g., Fairgrounds Leaside, RCOR) to evaluate each court's gates independently.
 * 10. Consolidated Digital Twins: Single venue records track aggregate facility health while storing
 *    per-court breakdowns (e.g. C1: G4 | C2: G2).
 * 11. Text-Only Executive Joy Cannons: Pure, frictionless momentum updates with database court labels removed.
 * 12. 12-Gate Visual Forensic Rubric: Gemini evaluates video frames against physical criteria.
 * 13. Smart Verbatim Engine: Purges vocal fillers ("uh", "ah", "um") while preserving technical terminology.
 * 14. Dual-Track Bilingual Output: Generates clean English and Spanish transcripts concurrently.
 * 15. Meteorological Safety Tripwires: Real-time wind gust (>20 kts) & condensation turf adhesive holds.
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
  google: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEO_KEY
  },
  gamecam: {
    webhookSecret: process.env.GAMECAM_WEBHOOK_SECRET || 'bpc_titan_gamecam_secret_2026'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

// ====================================================================
// 2. IN-MEMORY CACHE-ASIDE ENGINE (AIRTABLE API BURN PROTECTOR)
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
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=50`;
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
  console.log(`[Cache Engine] Explicit cache invalidation scope: ${entity}`);
}

// ====================================================================
// 3. SUPABASE AMBIENT DATA EXHAUST VAULT (DARK MATTER ENGINE)
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
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) {
    console.warn('[Dark Matter Vault] Supabase credentials not configured, skipping ambient archive.');
    return null;
  }

  const payload = {
    site_id: siteId || null,
    site_name: siteName || 'Fleet Operations',
    sender_phone: senderPhone || null,
    sender_name: senderName || 'Field Tech',
    raw_text: rawText,
    category: category || 'General Logistics',
    distilled_context: distilledContext || rawText.slice(0, 150),
    urgency,
    gravity_score: gravityScore,
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

    if (!res.ok) {
      console.warn(`[Dark Matter Vault] Supabase write failed (${res.status}): ${await res.text()}`);
      return null;
    }

    const inserted = await res.json();
    console.log(`🌌 [Dark Matter Vault] Archived ambient note #${inserted?.[0]?.id || ''} for ${siteName}`);
    return inserted?.[0] || null;
  } catch (err) {
    console.error('[Dark Matter Vault Exception]:', err.message);
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
    console.warn('[Dark Matter Fetch Warning]:', err.message);
    return [];
  }
}

async function searchDarkMatterVault(keyword, limit = 6) {
  if (!CONFIG.supabase.url || !CONFIG.supabase.serviceRoleKey) return [];

  try {
    const encoded = encodeURIComponent(keyword.trim());
    const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?or=(raw_text.ilike.*${encoded}*,distilled_context.ilike.*${encoded}*,site_name.ilike.*${encoded}*)&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getSupabaseHeaders('application/json')
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[Dark Matter Search Warning]:', err.message);
    return [];
  }
}

// ====================================================================
// 4. SPRING 2027 MOBILIZATION GATE ENGINE
// ====================================================================
function evaluateReadinessGate(siteRecord) {
  const f = siteRecord.fields || siteRecord;

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
// 5. UNIVERSAL VISUAL TRIAGE ENGINE (RECEIPTS VS COURT SWEEPS)
// ====================================================================

const VISUAL_TRIAGE_PROMPT = `
You are the Titan OS Universal Visual Triage Engine for Bounce Padel.
Analyze the provided image(s) or video frames to classify the primary operational subject.

CATEGORIES:
1. "FINANCIAL_RECEIPT": Store receipts (Home Depot, Lowe's, gas station, fuel, hardware store, Fastenal, restaurants/meals, lumber, supplies, equipment rental, parking), store invoices, register slips.
2. "COURT_FACILITY": Padel court construction, court maintenance, turf, glass, mesh, lighting, net, concrete pad, or sports facility walkaround.
3. "FREIGHT_LOGISTICS": Wooden crates, pallets, glass shipping A-frames, shipping bills of lading (BOL), delivery trucks, flatbed offloading.
4. "IRRELEVANT_NOISE": Personal selfies, casual non-work objects, pet photos, screenshots with no work context.

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

OUTPUT FORMAT (JSON ONLY):
{
  "media_category": "FINANCIAL_RECEIPT" | "COURT_FACILITY" | "FREIGHT_LOGISTICS" | "IRRELEVANT_NOISE",
  "confidence": number,
  "grand_total": number or null,
  "primary_currency": "CAD" | "USD" | null,
  "summary": "string or null",
  "receipts": []
}
`;

async function classifyVisualMediaIntent(items) {
  const contentParts = [{ text: "Determine the primary subject of these images. If receipts, extract all financial data." }];

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

    if (!res.ok) throw new Error(`Visual triage failed (${res.status}): ${await res.text()}`);

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { media_category: 'COURT_FACILITY', confidence: 0.5 };

    return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Visual Triage Exception]:', err.message);
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

  // Build Structured Notes for Daily Assignments Ledger
  let formattedNotes = `[EXPENSE RECEIPT INGESTION - ${workerName} at ${timeStr}]\n` +
    `Total: $${grandTotal} ${currency}\n` +
    `Summary: ${summaryText}\n\n` +
    `RECEIPTS BREAKDOWN:\n`;

  if (receipts.length > 0) {
    receipts.forEach((r, idx) => {
      formattedNotes += `${idx + 1}. ${r.vendor || 'Merchant'} — $${r.total_amount ? r.total_amount.toFixed(2) : '0.00'} (${r.category || 'General'})\n` +
        `   Items: ${r.items_summary || 'Supplies'}\n` +
        (r.date ? `   Date: ${r.date}\n` : '');
    });
  } else {
    formattedNotes += `Single Expense Batch — Total: $${grandTotal} ${currency}\n`;
  }

  formattedNotes += `\nRECEIPT MEDIA URLS:\n` + storageResults.map(s => `• ${s.signedUrl}`).join('\n');

  // Format array of attachment objects for Airtable
  const attachmentPayload = storageResults.map(s => ({ url: s.signedUrl }));

  // Create Assignment Ticket in Daily Assignments with Attachment(s) populated for QuickBooks Automation
  const assignmentPayload = {
    'Date': todayStr,
    'Assignment Type': 'Expense',
    'Task Category': 'Expense',
    'Priority': 'Low',
    'Source': 'WhatsApp Receipt Intake',
    'Status': 'Open',
    'Notes': formattedNotes,
    'Attachment(s)': attachmentPayload
  };

  if (worker?.id) assignmentPayload['Worker'] = [worker.id];
  if (site?.id) assignmentPayload['Sites'] = [site.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'EXP';

  // Ambient archive into Supabase Dark Matter Vault
  await streamToDarkMatterVault({
    siteId: site?.id || null,
    siteName: site?.fields?.['Site Name'] || 'Fleet Operations',
    senderPhone: fromPhone,
    senderName: workerName,
    rawText: formattedNotes,
    category: 'Finance / Receipts',
    distilledContext: `Expense $${grandTotal} ${currency} (${receipts.map(r => r.vendor).filter(Boolean).join(', ') || 'Receipts'}) submitted by ${workerName}`,
    urgency: 'LOW',
    gravityScore: 2,
    actionableFollowup: `Ticket ${ticketId}`
  });

  // Executive WhatsApp Confirmation Card
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
    `🎫 *Ticket:* ${ticketId} (Dispatched to QuickBooks)\n` +
    `📁 *Vault:* Archived securely in Supabase Storage.`;

  await sendWhatsAppMessage(dispatchTarget, receiptCard);
}

// ====================================================================
// 6. DECOUPLED BLIND VISION CLASSIFIER (ZERO AUDIO LEAKAGE)
// ====================================================================

async function inspectBlindVisualGroundTruth(mediaItem) {
  const systemInstruction = `
You are the Titan OS Ground Truth Vision Gate.
Classify the physical environment visible in these video frames with complete neutrality.

STRICT GROUND TRUTH RULES:
1. PADEL COURT VERIFICATION:
   - A valid padel court MUST show clear structural padel elements:
     * Regulation synthetic turf (blue, green, or terracotta with white lines)
     * 10mm to 12mm tempered structural glass panels mounted to steel columns
     * Electro-welded structural wire mesh cages
     * Regulation net posts and center strap
   - If the video shows:
     * Residential patio, backyard, deck, lawn furniture, BBQ, or house siding
     * Office desk, computer screens, indoor living room, drywall, or kitchen
     * Truck cab, vehicle dashboard, steering wheel, or parking lot
     YOU MUST CLASSIFY: is_padel_court: false

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
          { text: "Examine ONLY visual frames. Disregard any audio. Is this physically inside or at the apron of a regulation padel court?" }
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

    if (!res.ok) {
      console.warn('[Blind Vision Gate] API check failed, falling back:', await res.text());
      return { is_padel_court: true, detected_scene: 'Bypassed on API error' };
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    console.log('[Blind Vision Gate Verdict]:', parsed);
    return parsed;
  } catch (err) {
    console.error('[Blind Vision Gate Exception]:', err.message);
    return { is_padel_court: true, detected_scene: 'Bypassed on parse error' };
  }
}

// ====================================================================
// 7. MULTIMODAL SPOKEN & TASK TRIAGE PROMPTS (FORENSIC GATE RUBRIC)
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection & Construction Gate Engine for Bounce Padel.

PADEL COURT 12-GATE PHYSICAL CONSTRUCTION RUBRIC:
When inspecting video frames, you MUST visually identify completed physical stages:
- Gate 1: "Foundation & Anchor Slab" (Cured concrete pad, slab anchor channels, perimeter base plates)
- Gate 2: "Steel Frame Assembly" (Vertical structural steel columns, corner posts, and perimeter frame beams fully bolted upright)
- Gate 3: "Structural Mesh Panels" (Electro-welded wire mesh fencing panels mounted and bolted to the steel columns)
- Gate 4: "Toughened Glass Seating" (10mm/12mm tempered glass panels seated into frame channels and gasketed)
- Gate 5: "Light Masts & LED Luminaires" (Overhead light poles and LED fixtures mounted to cage frame)
- Gate 6: "Underlayment Membrane" (Base geotextile shock pad laid out over concrete)
- Gate 7: "Turf Seaming & Gluing" (Synthetic turf carpet rolled out, cut, and seamed with adhesive)
- Gate 8: "Regulation Line Cutting" (White boundary service lines inlaid into turf)
- Gate 9: "Silica Sand Distribution" (Kiln-dried silica sand spread across turf surface)
- Gate 10: "Sand Brushing & Infill Depth" (Sand mechanically brushed into turf fibers)
- Gate 11: "Net Posts & Calibration" (Center net installed, tensioned to 88cm center height)
- Gate 12: "Site Cleanliness & Handover" (Debris/tools removed, glass cleaned, ready for play)

MULTI-COURT FACILITY WIDE-ANGLE PAN DIRECTIVE:
Technicians will stand at the apron or center between courts and slowly pan across the entire facility.
1. Identify the number of distinct padel court cages/pads visible ("courts_detected_count").
2. Evaluate each visible court independently (from left to right, near to far, or by visible visual markers).
3. For each court, detect its completed gates and active stage.
4. "facility_breakdown": Array of objects:
   [
     { "court_label": "Court 1", "highest_gate": 4, "stage_description": "Glass seated, turf staging" },
     { "court_label": "Court 2", "highest_gate": 2, "stage_description": "Columns upright, mesh unbolted" }
   ]
5. "highest_facility_gate": Integer (the furthest gate reached by any court at the site).
6. "lowest_facility_gate": Integer (the baseline gate reached across all courts).
7. "facility_summary": A 1-2 sentence executive summary of visible progress across all courts.

VISUAL INSPECTION MANDATES:
1. "verified_gates": Array of integers (e.g., [1, 2, 3]) for gates that are 100% complete across the court or leading court.
2. "in_progress_gate": Single integer representing the stage currently being installed.
3. SMART VERBATIM: Purge all speech hesitations and filler words ("uh", "ah", "um", "like", stutters). Disregard ambient background construction noise.
4. DUAL-TRACK BILINGUAL OUTPUT:
   - "transcript_en": Clean English transcript or visual engineering narrative.
   - "transcript_es": Clean Spanish transcript or visual engineering narrative.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "transcript_en": "Clean polished English transcript or visual scene summary",
  "transcript_es": "Transcripción limpia o resumen visual profesional en español",
  "spoken_court_name": "string or null",
  "spoken_ticket_id": integer or null,
  "video_phase": "INSTALLATION_SWEEP" | "INTAKE_BASELINE" | "COMPLETION_CLOSEOUT" | "GENERAL_AUDIT",
  "courts_detected_count": integer,
  "verified_gates": [1, 2, 3],
  "in_progress_gate": 4,
  "highest_facility_gate": 4,
  "lowest_facility_gate": 2,
  "facility_breakdown": [
    { "court_label": "Court 1", "highest_gate": 4, "stage_description": "Glass seated" },
    { "court_label": "Court 2", "highest_gate": 2, "stage_description": "Columns bolted upright" }
  ],
  "facility_summary": "Court 1 glass is fully mounted; Court 2 steel structure is upright and awaiting mesh.",
  "blockers_detected": ["Specific impediment or missing item in English"],
  "work_verified": ["Foundation slab complete", "Structural steel frame erected"],
  "task_category": "string or null",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "status_observed": "MILESTONE_PROGRESS" | "ACTION_REQUIRED" | "COMMISSIONED" | "NOMINAL",
  "action_intent": "MILESTONE_CLEARANCE",
  "site_conditions": "Short string in English",
  "action_items": ["Specific mechanical punch item in English"],
  "worker_summary": "1-2 sentence executive brief in English for INOC ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card"
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & VIP Field Concierge Engine.

CRITICAL DIRECTIVE:
1. "SMART VERBATIM": Purge all speech hesitations and filler words ("uh", "ah", "um", "like", stutters).
2. DUAL-TRACK BILINGUAL OUTPUT: Provide both transcript_en and transcript_es.

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
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item in English"],
  "site_conditions": "Short string in English",
  "worker_summary": "1-2 sentence executive summary in English for INOC.",
  "whatsapp_status_text": "Plaintext WhatsApp card"
}
`;

const COMMAND_MAP = {
  '/s': 'STATUS',
  '/sum': 'STATUS',
  '/status': 'STATUS',
  '/summary': 'STATUS',
  '/w': 'WEATHER',
  '/weather': 'WEATHER',
  '/clima': 'WEATHER',
  '/nearby': 'NEARBY_SWEEP',
  '/route': 'NEARBY_SWEEP',
  '/m': 'MODE_MAINTENANCE',
  '/maint': 'MODE_MAINTENANCE',
  '/maintenance': 'MODE_MAINTENANCE',
  '/i': 'MODE_INSTALLATION',
  '/install': 'MODE_INSTALLATION',
  '/spot': 'MODE_SPOT_CHECK',
  '/sc': 'MODE_SPOT_CHECK',
  '/spotcheck': 'MODE_SPOT_CHECK',
  '/l': 'LINK_SITE',
  '/link': 'LINK_SITE',
  '/group': 'LINK_SITE',
  '/map': 'LOCATION',
  '/loc': 'LOCATION',
  '/location': 'LOCATION',
  '/gps': 'LOCATION',
  '/board': 'COURT_BOARD',
  '/schedule': 'COURT_BOARD',
  '/mapview': 'FLEET_MAP_LINK',
  '/fleet': 'FLEET_MAP_LINK',
  '/g': 'READINESS_GATE_CHECK',
  '/gate': 'READINESS_GATE_CHECK',
  '/r': 'READINESS_GATE_CHECK',
  '/readiness': 'READINESS_GATE_CHECK',
  '/context': 'SITE_CONTEXT',
  '/history': 'SITE_CONTEXT',
  '/search': 'SEARCH_VAULT',
  '/find': 'SEARCH_VAULT',
  '/promote': 'PROMOTE_DARK_MATTER',
  '/delta': 'VIDEO_DELTA_INFO',
  '/?': 'HELP',
  '/h': 'HELP',
  '/help': 'HELP',
  '/ayuda': 'HELP'
};

const GATE_NAMES = {
  '0A': 'Freight & Glass Integrity (Container Audit)',
  '0B': 'Offload & Turf Protection',
  1: 'Foundation & Anchor Slab',
  2: 'Steel Frame Assembly',
  3: 'Structural Mesh Panels',
  4: 'Toughened Glass Seating',
  5: 'Light Masts & LED Luminaires',
  6: 'Underlayment Membrane',
  7: 'Turf Seaming & Gluing',
  8: 'Regulation Line Cutting',
  9: 'Silica Sand Distribution',
  10: 'Sand Brushing & Infill Depth',
  11: 'Net Posts & Calibration',
  12: 'Site Cleanliness & Handover'
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

/**
 * Direct Google Geocoding API Engine with Coordinate Sanitization
 */
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
    } else {
      console.warn(`[Google Geo] Geocode zero results for "${cleanAddress}": ${data.status}`);
      return null;
    }
  } catch (err) {
    console.error('[Google Geo Engine Exception]:', err.message);
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

  // Sanitize double dashes or typos in coordinate strings
  if (typeof rawLocation === 'string') {
    const sanitized = rawLocation.replace(/-{2,}/g, '-').trim();
    if (sanitized !== rawLocation && siteId) {
      console.log(`[Google Geo] Auto-healed corrupted coordinate for site ${siteId}: "${rawLocation}" -> "${sanitized}"`);
      rawLocation = sanitized;
      airtableWriteWithAutoDrop('Sites', { 'Site location': sanitized }, siteId).catch(err => {
        console.warn('[Google Geo] Auto-heal patch to Sites skipped:', err.message);
      });
    } else {
      rawLocation = sanitized;
    }
  }

  if (typeof rawLocation === 'string' && memoryCache.coordinates.has(rawLocation)) {
    return memoryCache.coordinates.get(rawLocation);
  }

  // 1. Direct regex match on raw "lat, lon"
  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (directMatch) {
      const coords = { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
      memoryCache.coordinates.set(rawLocation, coords);
      return coords;
    }
  }

  // 2. Decode native Airtable Map Cache
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

  // 3. Primary Google Maps Geocoding Resolver
  if (typeof rawLocation === 'string' && rawLocation.length > 3) {
    const googleResult = await geocodeAddressWithGoogle(rawLocation);
    if (googleResult) {
      const coords = { lat: googleResult.lat, lon: googleResult.lon };
      memoryCache.coordinates.set(rawLocation, coords);

      if (siteId && !rawLocation.includes(',')) {
        const coordString = `${googleResult.lat.toFixed(6)}, ${googleResult.lon.toFixed(6)}`;
        airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, siteId).catch(err => {
          console.warn('[Google Geo] Auto-persist to Sites skipped:', err.message);
        });
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
    console.warn('[Weather Engine] Telemetry fetch failed:', err.message);
    return null;
  }
}

async function uploadToSupabase(fileBuffer, mimeType) {
  let ext = 'mp4';
  if (mimeType.includes('image')) ext = 'jpg';
  if (mimeType.includes('audio') || mimeType.includes('ogg') || mimeType.includes('opus')) ext = 'ogg';
  if (mimeType.includes('video') || mimeType.includes('mp4') || mimeType.includes('mov') || mimeType.includes('quicktime')) ext = 'mp4';

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const storagePath = `${year}/${month}/${uuid}.${ext}`;

  const uploadUrl = `${CONFIG.supabase.url}/storage/v1/object/${CONFIG.supabase.bucket}/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: getSupabaseHeaders(mimeType),
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Supabase upload failed (${uploadRes.status}): ${errText}`);
  }

  const signUrl = `${CONFIG.supabase.url}/storage/v1/object/sign/${CONFIG.supabase.bucket}/${storagePath}`;
  const signRes = await fetch(signUrl, {
    method: 'POST',
    headers: getSupabaseHeaders('application/json'),
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 })
  });

  if (!signRes.ok) {
    const errText = await signRes.text();
    throw new Error(`Supabase signing failed (${signRes.status}): ${errText}`);
  }

  const signData = await signRes.json();
  const rawSignedPath = signData.signedURL || signData.signedUrl || '';
  const fullSignedUrl = rawSignedPath.startsWith('http')
    ? rawSignedPath
    : `${CONFIG.supabase.url}/storage/v1${rawSignedPath.startsWith('/') ? '' : '/'}${rawSignedPath}`;

  return { storagePath, signedUrl: fullSignedUrl };
}

/**
 * Enhanced Auto-Healer with In-Place RAM Cache Mutation
 */
async function airtableWriteWithAutoDrop(table, fields, recordId = null, attempt = 1) {
  const cleanFields = { ...fields };

  for (const [key, val] of Object.entries(cleanFields)) {
    if (Array.isArray(val) && val.length === 0) {
      delete cleanFields[key];
    }
    if (key === 'Completion %') {
      delete cleanFields[key];
    }
  }

  const url = recordId
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(table)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(table)}`;

  const method = recordId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${CONFIG.airtable.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: cleanFields, typecast: true })
  });

  if (res.ok) {
    const savedRecord = await res.json();
    const lowerTable = table.toLowerCase();

    if (lowerTable.includes('site') && memoryCache.sites) {
      if (recordId) {
        const item = memoryCache.sites.find(s => s.id === recordId);
        if (item) item.fields = { ...item.fields, ...cleanFields, ...(savedRecord.fields || {}) };
      } else if (savedRecord?.id) {
        memoryCache.sites.push(savedRecord);
      }
    } else if (lowerTable.includes('worker') && memoryCache.workers) {
      if (recordId) {
        const item = memoryCache.workers.find(w => w.id === recordId);
        if (item) item.fields = { ...item.fields, ...cleanFields, ...(savedRecord.fields || {}) };
      } else if (savedRecord?.id) {
        memoryCache.workers.push(savedRecord);
      }
    } else if (lowerTable.includes('assignment') && memoryCache.assignments) {
      if (recordId) {
        const item = memoryCache.assignments.find(a => a.id === recordId);
        if (item) {
          item.fields = { ...item.fields, ...cleanFields, ...(savedRecord.fields || {}) };
          if (item.fields['Status'] === 'Complete' || item.fields['Status'] === 'Cancelled') {
            memoryCache.assignments = memoryCache.assignments.filter(a => a.id !== recordId);
          }
        }
      } else if (savedRecord?.id && savedRecord.fields?.['Status'] !== 'Complete') {
        memoryCache.assignments.unshift(savedRecord);
      }
    }

    return savedRecord;
  }

  const errBody = await res.json().catch(() => ({}));

  if (res.status === 422 && attempt <= 5) {
    const errorMsg = errBody?.error?.message || '';
    console.warn(`[Auto-Healer] 422 on ${table} (Attempt ${attempt}): ${errorMsg}`);

    const match = errorMsg.match(/(?:Unknown field name|Unknown field|Field|Column)\s*:?\s*["\\]+([^"\\]+)["\\]+/i) ||
                  errorMsg.match(/field\s*["\\]+([^"\\]+)["\\]+/i);

    if (match && match[1]) {
      const badField = match[1];
      console.warn(`[Auto-Healer] Pruning incompatible field: "${badField}"`);
      delete cleanFields[badField];
      return await airtableWriteWithAutoDrop(table, cleanFields, recordId, attempt + 1);
    }
  }

  throw new Error(`Airtable write failed on ${table} (${res.status}): ${JSON.stringify(errBody)}`);
}

// ====================================================================
// 9. IDENTITY & SITE MATRIX RESOLUTION
// ====================================================================

async function lookupContact(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const contacts = await getCachedContacts();

  return contacts.find(c => {
    const p = (c.fields['Phone Number'] || '').replace(/\D/g, '');
    return p === cleanDigits || p.endsWith(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.endsWith(p));
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
    return (pE164 && (pE164 === cleanDigits || cleanDigits.endsWith(pE164))) ||
           (wNum && (wNum === cleanDigits || cleanDigits.endsWith(wNum)));
  }) || null;
}

async function lookupWorkerByName(name) {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  const workers = await getCachedWorkers();

  return workers.find(w => {
    const isActive = w.fields['Active'] === true || w.fields['Active'] === 1;
    if (!isActive) return false;
    const fullName = String(w.fields['Full Name'] || w.fields['Worker Name'] || '').toLowerCase();
    return fullName.includes(cleanName);
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
      .replace(/\b(?:bpc|court)\b/gi, '')
      .trim();

    let match = sites.find(s => {
      const sName = String(s.fields['Site Name'] || '').toLowerCase();
      return sName.includes(normalized) || normalized.includes(sName);
    });
    if (match) return match;

    const searchTokens = normalized.split(/\s+/).filter(t => t.length > 2);
    if (searchTokens.length > 0) {
      match = sites.find(s => {
        const sName = String(s.fields['Site Name'] || '').toLowerCase();
        return searchTokens.every(token => sName.includes(token));
      });
      if (match) return match;
    }
  }

  if (groupIdOrPhone) {
    const cleanTarget = String(groupIdOrPhone).trim();
    const match = sites.find(s => {
      const gid = String(s.fields['WhatsApp Group ID'] || '').trim();
      const clientGid = String(s.fields['Client WhatsApp Group ID'] || '').trim();
      return (gid && (gid === cleanTarget || cleanTarget.includes(gid))) ||
             (clientGid && (clientGid === cleanTarget || cleanTarget.includes(clientGid)));
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
  if (!fromPhone) {
    return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: '' };
  }

  try {
    const contact = await lookupContact(fromPhone);
    if (contact) {
      const siteId = contact.fields['Linked Site']?.[0] || null;
      let siteRecord = null;
      if (siteId) {
        const sites = await getCachedSites();
        siteRecord = sites.find(s => s.id === siteId) || null;
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
  } catch (err) {
    console.warn('[Identity Engine] Contacts check failed:', err.message);
  }

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
  } catch (err) {
    console.warn('[Identity Engine] Worker check failed:', err.message);
  }

  return {
    type: 'UNKNOWN',
    name: 'External Caller',
    role: 'Unknown',
    phone: fromPhone
  };
}

// ====================================================================
// 10. WHATSAPP MESSAGING & JOY CANNON ENGINE
// ====================================================================

async function sendWhatsAppReaction(toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'reaction',
    reaction: { message_id: messageId, emoji: emoji }
  };

  if (!isGroup) payload.recipient_type = 'individual';

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function sendWhatsAppMessage(toTarget, messageBody) {
  if (!toTarget) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'text',
    text: { body: messageBody }
  };

  if (!isGroup) payload.recipient_type = 'individual';

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
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
    if (res.status === 401) {
      console.error(`[Meta Auth Fault (401)] WhatsApp Token expired or invalid. Update META_ACCESS_TOKEN in Render env vars!`);
    } else {
      console.error(`WhatsApp dispatch failed to ${toTarget} (${res.status}): ${errData}`);
    }
    return false;
  }
  return true;
}

async function sendWhatsAppButtons(toTarget, textBody, buttons = []) {
  if (!toTarget || !buttons || buttons.length === 0) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${idx}_${Date.now()}`,
      title: (btn.title || 'Select').slice(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
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
      return await sendWhatsAppMessage(toTarget, fallbackText);
    }
    return true;
  } catch (err) {
    const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
    return await sendWhatsAppMessage(toTarget, fallbackText);
  }
}

async function fireInstallationJoyCannon(siteRecord, highestGate) {
  try {
    const siteName = siteRecord.fields['Site Name'] || 'Facility Court';
    const clientGroup = siteRecord.fields['Client WhatsApp Group ID'];
    const linkedContactIds = siteRecord.fields['Linked Contacts'] || [];

    let celebrationCard = null;

    if (highestGate === 1) {
      celebrationCard = `🎾 *BOUNCE PADEL | JOY UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Work is officially underway and the foundation is set!\n\n` +
        `_Next step: Raising the frame._`;
    } else if (highestGate === 2 || highestGate === 3) {
      celebrationCard = `🎾 *BOUNCE PADEL | JOY UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `The steel frame and mesh are installed!\n\n` +
        `The court is really taking shape.\n` +
        `_Next step: Installing the glass._`;
    } else if (highestGate === 4) {
      celebrationCard = `🎾 *BOUNCE PADEL | JOY UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Installation is moving in the right direction — the glass is installed!\n\n` +
        `_Next step: Rolling out the turf._`;
    } else if (highestGate >= 7 && highestGate <= 10) {
      celebrationCard = `🎾 *BOUNCE PADEL | JOY UPDATE*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Turf is down and the net is up!\n\n` +
        `_Next step: Sand distribution, brushing, and final details._`;
    } else if (highestGate >= 11) {
      celebrationCard = `🎾 *BOUNCE PADEL | READY TO PLAY*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Installation is complete and your court is ready to play! 🥂\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 *Keep this chat handy:*\n` +
        `Pin this group to the top of your WhatsApp (_swipe right on this chat and tap "Pin"_).\n\n` +
        `Whenever you need court grooming or have a question down the road, simply send a text, voice note, or show us with a video right here. Our team is always on standby to keep your court in tournament shape.`;
    }

    if (!celebrationCard) return;

    if (clientGroup) {
      await sendWhatsAppMessage(clientGroup, celebrationCard);
      console.log(`🎾 [Joy Cannon] Dispatched Gate ${highestGate} for ${siteName} to VIP Group ${clientGroup}`);
    }

    if (Array.isArray(linkedContactIds) && linkedContactIds.length > 0) {
      const contacts = await getCachedContacts();
      for (const cid of linkedContactIds) {
        const contact = contacts.find(c => c.id === cid);
        if (contact && contact.fields['Phone Number']) {
          const cleanPhone = String(contact.fields['Phone Number']).replace(/\D/g, '');
          await sendWhatsAppMessage(cleanPhone, celebrationCard);
          console.log(`🎾 [Joy Cannon] Dispatched Gate ${highestGate} for ${siteName} to ${contact.fields['Contact Name']}`);
        }
      }
    }
  } catch (err) {
    console.error('[Installation Joy Cannon Error]:', err.message);
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

async function findNearestOpenAssignment(currentLat, currentLon, excludeSiteId = null) {
  try {
    const openTickets = await getCachedOpenAssignments();
    if (openTickets.length === 0) return null;

    const cachedSites = await getCachedSites();
    let nearest = null;
    let minDistanceKm = Infinity;

    for (const ticket of openTickets) {
      const siteId = ticket.fields['Sites']?.[0] || ticket.fields['Site']?.[0];
      if (!siteId || siteId === excludeSiteId) continue;

      const siteRecord = cachedSites.find(s => s.id === siteId);
      if (!siteRecord) continue;

      const coords = await resolveCoordinates(siteRecord);
      if (!coords) continue;

      const dist = haversineDistanceKm(currentLat, currentLon, coords.lat, coords.lon);
      if (dist < minDistanceKm) {
        minDistanceKm = dist;
        nearest = { ticket, site: siteRecord, distanceKm: dist };
      }
    }

    return nearest;
  } catch (err) {
    console.warn('[Proactive Dispatch Engine] Distance calculation failed:', err.message);
    return null;
  }
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

  if (targetSite) {
    await airtableWriteWithAutoDrop('Sites', {
      'Last Note': `Work Order #${activeTicket.fields['Assignment ID']} completed by ${workerName}: ${resolutionNotes}`,
      'Last Intent': 'WORK_ORDER_COMPLETED'
    }, targetSite.id);
  }

  const ticketNum = activeTicket.fields['Assignment ID'] ? `#${activeTicket.fields['Assignment ID']}` : '';
  const courtLabel = targetSite?.fields?.['Site Name'] || 'Assigned Court';

  const voucherReceipt = `🧾 *TITAN OS | CLOSEOUT RECEIPT (RECIBO DE CIERRE)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Ticket ${ticketNum} Completed / Completado*\n` +
    `🏟️ *Court / Cancha:* ${courtLabel}\n` +
    `👤 *Technician / Técnico:* ${workerName}\n` +
    `⏱️ *Verified / Verificado:* ${timeStr}\n` +
    (isVideoDelta ? `🎥 *Video Delta:* Baseline & Completion Sweeps Verified 🟢\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Work Performed / Trabajo Realizado:*\n${resolutionNotes}\n\n` +
    `🟢 *Asset Condition / Estado:* Nominal (Court Open for Play / Cancha Lista para Juego)`;

  await sendWhatsAppMessage(dispatchTarget, voucherReceipt);

  if (targetSite) {
    const coords = await resolveCoordinates(targetSite);
    if (coords) {
      const nearest = await findNearestOpenAssignment(coords.lat, coords.lon, targetSite.id);
      if (nearest) {
        const nextCourt = nearest.site.fields['Site Name'] || 'Next Assigned Asset';
        const nextDist = nearest.distanceKm.toFixed(1);
        const nextCat = nearest.ticket.fields['Task Category'] || 'Maintenance';
        const nextNotes = nearest.ticket.fields['Notes'] || 'Follow-up service directive';
        const nextTicketId = nearest.ticket.fields['Assignment ID'] || nearest.ticket.id;
        const nextCoords = await resolveCoordinates(nearest.site);
        const navUrl = nextCoords ? `https://www.google.com/maps/dir/?api=1&destination=${nextCoords.lat},${nextCoords.lon}` : '';

        const routeText = `📍 *TITAN PROACTIVE ROUTE RECOMMENDATION*\n` +
          `*(Recomendación de Ruta Proactiva)*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Technician ${workerName} is clear at *${courtLabel}*.\n\n` +
          `🎯 *Next Dispatch / Siguiente:* ${nextCourt} (~${nextDist} km)\n` +
          `🔧 *Scope / Tarea:* ${nextCat}\n` +
          `📝 *Notes / Notas:* ${nextNotes.slice(0, 90)}\n` +
          (navUrl ? `🗺️ *Google Maps:* ${navUrl}\n` : '');

        const buttons = [
          { id: `DISPATCH_APPROVE_${nextTicketId}_${worker?.id || 'any'}`, title: `⚡ Dispatch: ${nextCourt.slice(0, 10)}` },
          { id: `ROUTE_FACTORY_${worker?.id || 'any'}`, title: `🏭 Return to Shop` }
        ];

        await sendWhatsAppButtons(dispatchTarget, routeText, buttons);
      }
    }
  }

  return true;
}

// ====================================================================
// 12. COMPOUND SCHEDULER & VIP CONCIERGE
// ====================================================================

async function handleCompoundScheduler(text, identity, dispatchTarget, fromPhone, boundSite = null) {
  const targetSite = identity.siteRecord || boundSite;
  const targetSiteId = targetSite?.id || identity.siteId;
  const siteName = targetSite?.fields?.['Site Name'] || identity.siteName || 'Private Compound Court';
  const nowIso = new Date().toISOString();

  const prompt = `
You are the Titan OS Compound Court Scheduler.
Current Time: ${nowIso}
Sender: ${identity.name || 'Compound Member'}
Court Asset: ${siteName}

Extract scheduling intent from: "${text}"

ACTIONS:
- "BOOK": User wants to reserve court time.
- "CANCEL": User wants to release reservation.
- "QUERY_SCHEDULE": User asks who is playing or for board.
- "CHATTER": General conversation.

CRITICAL DURATION RULE: STRICT 2-HOUR DEFAULT BOOKING BLOCK.

Output JSON only:
{
  "action": "BOOK" | "CANCEL" | "QUERY_SCHEDULE" | "CHATTER",
  "startTimeIso": "ISO 8601 string or null",
  "endTimeIso": "ISO 8601 string or null",
  "partyName": "string or null",
  "confidence": number
}
`;

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
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

    if (!res.ok) return false;
    const data = await res.json();
    const rawParsed = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawParsed) return false;

    const intent = JSON.parse(rawParsed);
    if (intent.action === 'CHATTER') return false;

    if (intent.action === 'QUERY_SCHEDULE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?sort%5B0%5D%5Bfield%5D=Start%20Time&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`;

      const qRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const qData = qRes.ok ? await qRes.json() : { records: [] };
      const records = (qData.records || []).filter(r => {
        const isConfirmed = r.fields['Status'] === 'Confirmed';
        const startTime = r.fields['Start Time'];
        return isConfirmed && startTime && startTime >= `${todayStr}T00:00:00.000Z`;
      });

      let boardText = `🎾 *${siteName.toUpperCase()} | COURT BOARD*\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (records.length === 0) {
        boardText += `🟢 *Court is wide open today!*\nSimply type your requested time here to lock it in (2-hour blocks standard).`;
      } else {
        records.forEach(r => {
          const s = new Date(r.fields['Start Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const e = new Date(r.fields['End Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const by = r.fields['Booked By'] || 'Family Member';
          boardText += `• ${s} – ${e}: *${by}*\n`;
        });
        boardText += `━━━━━━━━━━━━━━━━━━━━\n🟢 All other windows are open for play.`;
      }
      await sendWhatsAppMessage(dispatchTarget, boardText);
      return true;
    }

    if (intent.action === 'CANCEL') {
      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?sort%5B0%5D%5Bfield%5D=Start%20Time&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=20`;
      const qRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const qData = qRes.ok ? await qRes.json() : { records: [] };

      const myReservation = (qData.records || []).find(r => {
        const isConfirmed = r.fields['Status'] === 'Confirmed';
        const sTime = r.fields['Start Time'];
        const bookedBy = (r.fields['Booked By'] || '').toLowerCase();
        const searchName = (identity.name || intent.partyName || '').toLowerCase();
        return isConfirmed && sTime && sTime >= nowIso && (searchName ? bookedBy.includes(searchName) : true);
      });

      if (myReservation) {
        await airtableWriteWithAutoDrop('Reservations', { 'Status': 'Cancelled' }, myReservation.id);
        await sendWhatsAppMessage(dispatchTarget, `🟢 *COURT RELEASED*\n\nYour 2-hour reserved block has been released back to the family pool. The court is now open!`);
      } else {
        await sendWhatsAppMessage(dispatchTarget, `ℹ️ No upcoming reservations found under your name to cancel.`);
      }
      return true;
    }

    if (intent.action === 'BOOK') {
      if (!intent.startTimeIso) {
        await sendWhatsAppMessage(dispatchTarget, `Could you specify the time you'd like to play? (e.g. "Tomorrow at 10 AM")`);
        return true;
      }

      const pStart = new Date(intent.startTimeIso);
      const pEnd = intent.endTimeIso ? new Date(intent.endTimeIso) : new Date(pStart.getTime() + 2 * 60 * 60 * 1000);

      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?maxRecords=100`;
      const cRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const cData = cRes.ok ? await cRes.json() : { records: [] };

      const conflict = (cData.records || []).find(r => {
        if (r.fields['Status'] !== 'Confirmed') return false;
        const rStart = new Date(r.fields['Start Time']);
        const rEnd = new Date(r.fields['End Time']);
        return rStart < pEnd && rEnd > pStart;
      });

      if (conflict) {
        const holder = conflict.fields['Booked By'] || 'Another family member';
        const sTime = new Date(conflict.fields['Start Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const eTime = new Date(conflict.fields['End Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const conflictMsg = `⚠️ *SCHEDULE OVERLAP*\n\n` +
          `*${holder}* already has the court reserved from *${sTime} to ${eTime}*.\n\n` +
          `🟢 The court is open right after at *${eTime}*. Want me to book a 2-hour window starting at ${eTime} for you?`;

        await sendWhatsAppMessage(dispatchTarget, conflictMsg);
        return true;
      }

      const bookedByName = intent.partyName ||
        (identity.name !== 'External Caller' && identity.name !== 'VIP Member' ? identity.name : `Family Member (+${fromPhone.slice(-4)})`);

      const resPayload = {
        'Booked By': bookedByName,
        'Start Time': pStart.toISOString(),
        'End Time': pEnd.toISOString(),
        'Status': 'Confirmed',
        'Notes': `Booked via ambient WhatsApp NLP. Raw text: "${text}"`
      };
      if (targetSiteId) resPayload['Site'] = [targetSiteId];

      await airtableWriteWithAutoDrop('Reservations', resPayload);

      const sFormatted = pStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const eFormatted = pEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateFormatted = pStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      const confirmationCard = `🎾 *${siteName.toUpperCase()} | RESERVATION LOCKED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Player / Party:* ${bookedByName}\n` +
        `📅 *Date:* ${dateFormatted}\n` +
        `⏱️ *Time:* ${sFormatted} – ${eFormatted} (2-Hour Block)\n` +
        `🟢 *Status:* Confirmed\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*Have a great match! Court board updated.*`;

      await sendWhatsAppMessage(dispatchTarget, confirmationCard);
      return true;
    }
  } catch (err) {
    console.error('[Compound Scheduler Error]:', err.message);
  }
  return false;
}

async function handleVIPConcierge(text, identity, dispatchTarget, fromPhone) {
  const siteId = identity.siteId;
  const siteName = identity.siteName || 'Private Reserve Court';

  const assignmentPayload = {
    'Date': new Date().toISOString().split('T')[0],
    'Assignment Type': 'Service',
    'Priority': 'High',
    'Source': 'Joy Cannon (Client)',
    'Status': 'Open',
    'Notes': `[VIP CONCIERGE — ${identity.name} (${identity.role})]\nDirective: "${text}"`
  };

  if (siteId) assignmentPayload['Sites'] = [siteId];

  const bobWorker = await lookupWorkerByName('Bob');
  if (bobWorker) assignmentPayload['Worker'] = [bobWorker.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

  const voucherText = `💼 *BOUNCE CONCIERGE | REQUEST CONFIRMED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Hello ${identity.name} — we've received your directive for *${siteName}*:\n\n` +
    `> "${text}"\n\n` +
    `🎫 *Ticket:* ${ticketId}\n` +
    `⚡ *Priority:* High (VIP Private Reserve)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Our district service van has been notified. Handled seamlessly under your seasonal coverage.`;

  await sendWhatsAppMessage(dispatchTarget, voucherText);
  return true;
}

// ====================================================================
// 13. 3-TIER TEXT EXHAUST SIPHON
// ====================================================================

async function triageDispatchText(text, workerRecord, currentSite = null, recentAmbientSnippets = []) {
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ') || 'BPC RCOR Court 1, BPC RCOR Court 2, BPC Don Walker, BPC North Padel Club';
  const siteWorkflowMode = currentSite?.fields?.['Workflow Mode'] || 'INSTALLATION';

  const ambientMemory = recentAmbientSnippets.length > 0
    ? `\nRECENT AMBIENT FIELD MEMORY FOR THIS SITE:\n${recentAmbientSnippets.map(n => `- [${n.category}]: ${n.distilled_context}`).join('\n')}\n`
    : '';

  const prompt = `
You are the Titan OS Ambient Intelligence Scribe, Operational Dispatch & Data Exhaust Siphon for Bounce Padel.
Current Operational Context: [Site Mode: ${siteWorkflowMode}]
Active Padel Court Registry: [${siteListStr}]
Field Personnel: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem", "Michael", "David", "Edwin"]
${ambientMemory}
3-TIER EXHAUST CLASSIFICATION DIRECTIVE:
Classify the incoming text into EXACTLY ONE of three tiers:

TIER 1 - "PURE_NOISE": Casual banter, emojis, greeting filler ("ok", "lol", "👍", "coffee time").
TIER 2 - "DARK_MATTER": Informal field intelligence, weather notes, equipment comments ("traffic on 400", "dropped off screws at Orillia", "GC Paul says slab is Friday").
TIER 3 - "ACTIONABLE_STATE_CHANGE": Milestones, 50% deposit received, concrete pour dates, quote leads, closeouts, invoices.

Input Text: "${text}"

Output JSON only:
{
  "exhaust_tier": "PURE_NOISE" | "DARK_MATTER" | "ACTIONABLE_STATE_CHANGE",
  "is_actionable": boolean,
  "intent": string,
  "dark_matter_category": string | null,
  "distilled_context": string | null,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | null,
  "gravity_score": integer | null,
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "billing_details": { "client_name": "string or null", "amount": "string or null", "invoice_number": "string or null", "memo": "string or null" },
  "deposit_status": "50% Deposit Received" | "Paid in Full" | null,
  "pour_date": "YYYY-MM-DD or null",
  "notes": "string in English"
}
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
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

  if (!res.ok) throw new Error(`Gemini dispatch triage failed (${res.status}): ${await res.text()}`);

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
}

async function triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity) {
  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  await Promise.all(uploadPromises);

  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ') || 'BPC RCOR Court 1, BPC RCOR Court 2, BPC Don Walker, BPC North Padel Club';

  const audioPrompt = `
You are the Titan OS Spoken Voice Triage Engine for Bounce Padel.
Transcribe spoken audio with "Smart Verbatim" (purge all "uh", "ah", "um", stutters, and verbal fillers).
Generate both clean fluent English (transcript_en) and clean Spanish (transcript_es).

Active Padel Court Registry: [${siteListStr}]
Field Personnel: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem", "Michael", "David", "Edwin"]

TIER 1 - "PURE_NOISE": Casual banter, filler speech.
TIER 2 - "DARK_MATTER": Informal intelligence, staging notes, parts comments, weather notes.
TIER 3 - "ACTIONABLE_STATE_CHANGE": Milestones, deposits received, concrete pour dates, closeouts.

OUTPUT SPECIFICATION (JSON ONLY):
{
  "transcript_en": "Verbatim English transcript without filler words",
  "transcript_es": "Transcripción limpia en español sin muletillas",
  "exhaust_tier": "PURE_NOISE" | "DARK_MATTER" | "ACTIONABLE_STATE_CHANGE",
  "is_actionable": boolean,
  "intent": string,
  "dark_matter_category": string | null,
  "distilled_context": string | null,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | null,
  "gravity_score": integer | null,
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English or null",
  "pour_date": "YYYY-MM-DD or null",
  "deposit_status": "50% Deposit Received" | "Paid in Full" | null,
  "notes": "string in English"
}
`;

  const contentParts = [{ text: audioPrompt }];
  for (const item of items) {
    contentParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  }

  const payload = {
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const gRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!gRes.ok) throw new Error(`Gemini voice triage failed (${gRes.status}): ${await gRes.text()}`);

  const gData = await gRes.json();
  const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return;

  const triage = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  console.log('[Voice Memo Siphon]:', { transcript_en: triage.transcript_en, tier: triage.exhaust_tier });

  if (triage.exhaust_tier === 'PURE_NOISE') return;

  if (triage.exhaust_tier === 'DARK_MATTER') {
    const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
    const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Fleet General';

    const archivedRecord = await streamToDarkMatterVault({
      siteId: site?.id || null,
      siteName: siteLabel,
      senderPhone: fromPhone,
      senderName: senderName,
      rawText: triage.transcript_en || triage.transcription,
      category: triage.dark_matter_category || 'Logistics',
      distilledContext: triage.distilled_context || triage.transcript_en,
      urgency: triage.urgency || 'LOW',
      gravityScore: triage.gravity_score || 1
    });

    if (site && (triage.gravity_score >= 4 || triage.urgency === 'HIGH')) {
      await airtableWriteWithAutoDrop('Sites', {
        'Last Note': `[VOICE ALERT - ${triage.dark_matter_category}]: ${triage.distilled_context}`,
        'Last Intent': 'AMBIENT_ALERT'
      }, site.id);

      if (archivedRecord?.id) {
        const alertPrompt = `⚠️ *FIELD INTELLIGENCE RECORDED (VOICE)*\n\n` +
          `*Site:* ${siteLabel}\n` +
          `*Observation:* "${triage.distilled_context}"\n` +
          `*Category:* ${triage.dark_matter_category} (Urgency: ${triage.urgency})\n\n` +
          `Archived into Supabase vault. Want to promote this into an active dispatch ticket?`;

        const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Promote to Ticket' }];
        await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
      }
    }
    return;
  }

  if (triage.exhaust_tier === 'ACTIONABLE_STATE_CHANGE') {
    if (triage.intent === 'WORK_ORDER_CLOSEOUT') {
      await executeWorkOrderCloseout({
        site,
        targetCourtName: triage.matched_site_name,
        ticketId: triage.ticket_id,
        resolutionNotes: triage.resolution_summary || triage.transcript_en || 'Spoken closeout verified on site.',
        worker,
        dispatchTarget,
        fromPhone
      });
      return;
    }
  }
}

async function evaluateCourtMediaBatch(mediaItems, cumulativeContext = {}) {
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ');

  const auditContextText = `AUDIT CONTEXT:
Active Padel Court Registry: [${siteListStr}]
Current Bound Asset: ${cumulativeContext.siteName || 'Unbound Court'}
Total Physical Courts at Facility: ${cumulativeContext.totalCourts || 1}
Current Mode: ${cumulativeContext.workflowMode || 'INSTALLATION'}
Active Open Punch Notes: ${cumulativeContext.lastNote || 'None'}

Evaluate video frames against the 12-Gate Physical Construction Rubric.
If this is a multi-court venue, assess the 180° apron sweep across all visible courts.
Extract courts_detected_count, facility_breakdown, highest_facility_gate, lowest_facility_gate, verified_gates, in_progress_gate, facility_summary, Smart Verbatim transcript_en, and transcript_es.`;

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
  const totalFacilityCourts = parseInt(site?.fields?.['Total Courts'] || site?.fields?.['Venue Court Count']) || 1;

  const cumulativeContext = {
    siteName: site?.fields?.['Site Name'] || 'BPC Court',
    workflowMode: currentMode,
    totalCourts: totalFacilityCourts,
    siteStatus: site?.fields?.['Site Status'] || 'ACTIVE',
    openTickets: site?.fields?.['Open Tickets'] || 0,
    clearedMilestones: site?.fields?.['Cleared Milestones'] || [],
    lastNote: site?.fields?.['Last Note'] || '',
    isIndoor: indoorSite
  };

  if (!hasVisualMedia) {
    console.log(`[Batch Router] Voice-only memo detected (${items.length} item(s)). Routing to Ambient Voice Siphon.`);
    await triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity);
    return;
  }

  // Upload visual artifacts to Supabase Storage first
  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  const storageResults = await Promise.all(uploadPromises);

  // ==================================================================
  // STAGE 0: UNIVERSAL VISUAL TRIAGE (RECEIPTS VS COURT SWEEPS)
  // ==================================================================
  if (!hasVideo) {
    const visualTriage = await classifyVisualMediaIntent(items);
    console.log('[Visual Triage Classification]:', {
      category: visualTriage.media_category,
      total: visualTriage.grand_total,
      receipts: visualTriage.receipts?.length || 0
    });

    if (visualTriage.media_category === 'FINANCIAL_RECEIPT') {
      console.log(`[Batch Router] Financial receipt(s) detected. Routing to Expense Ingestion Engine.`);
      await handleFinancialReceiptBatch({
        items,
        storageResults,
        visualTriage,
        worker,
        site,
        dispatchTarget,
        fromPhone,
        callerIdentity
      });
      return; // HARD STOP — Prevents polluting Sites table or triggering 0% Gate 0!
    }

    if (visualTriage.media_category === 'IRRELEVANT_NOISE') {
      console.warn(`[Visual Triage] Media classified as non-operational noise.`);
      await sendWhatsAppMessage(dispatchTarget, `ℹ️ *TITAN OS | MEDIA ARCHIVED*\nPhoto received and saved to Supabase vault, but no padel court milestone or expense receipt was detected.`);
      return; // HARD STOP
    }
  }

  // ==================================================================
  // STAGE 1: BLIND VISUAL GROUND TRUTH GATE (VIDEO SWEEPS)
  // ==================================================================
  if (hasVideo) {
    const videoItem = items.find(item => item.type === 'video');
    const visualTruth = await inspectBlindVisualGroundTruth(videoItem);

    if (visualTruth.is_padel_court === false) {
      console.warn(`[Blind Vision Gate] REJECTED non-court video: "${visualTruth.detected_scene}"`);

      const rejectionCard = `⛔ *TITAN OS | AUDIT REJECTED (VISUAL MISMATCH)*\n` +
        `*(Auditoría Rechazada por Discrepancia Visual)*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Ground Truth Verification Failed / Verificación Fallida*\n\n` +
        `👁️ *Camera Detected / Cámara Detectó:*\n${visualTruth.detected_scene || 'Non-court environment'}\n\n` +
        `❌ *Verdict / Veredicto:*\nNo padel court structure detected in video frames.\n_No se detectó estructura de pádel en el video._\n\n` +
        `👉 *Action Required / Acción Requerida:*\nStand at the court perimeter and film the physical asset to lock baseline.\n_Párese en el perímetro de la cancha y grabe el activo físico para bloquear la línea base._`;

      await sendWhatsAppMessage(dispatchTarget, rejectionCard);
      return; // HARD STOP
    }
  }

  // ==================================================================
  // STAGE 2: MULTIMODAL INGESTION & MODE-AWARE ROUTING
  // ==================================================================
  const forensicAudit = await evaluateCourtMediaBatch(items, cumulativeContext);

  let targetedSite = site;
  if (forensicAudit.spoken_court_name) {
    const spokenSite = await lookupSite(null, forensicAudit.spoken_court_name);
    if (spokenSite) targetedSite = spokenSite;
  }

  const siteMode = targetedSite?.fields?.['Workflow Mode'] || cumulativeContext.workflowMode || 'INSTALLATION';
  const courtLabel = targetedSite?.fields?.['Site Name'] || forensicAudit.target_court_name || 'Assigned Court';
  const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Technician';
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let activeTicket = null;
  const explicitTicketId = forensicAudit.spoken_ticket_id || forensicAudit.ticket_id;

  if (explicitTicketId) {
    activeTicket = await findActiveTicketForSite(null, explicitTicketId);
  } else if (siteMode === 'MAINTENANCE' && targetedSite) {
    activeTicket = await findActiveTicketForSite(targetedSite.id);
  }

  // Weather Tripwires
  let weatherNotice = '';
  if (targetedSite && !indoorSite) {
    const coords = await resolveCoordinates(targetedSite);
    if (coords) {
      const weather = await getHyperlocalWeather(coords.lat, coords.lon);
      if (weather) {
        const dewDelta = weather.temp - weather.dewPoint;
        if (weather.windGusts > 37) {
          weatherNotice += `\n⛔ *SAFETY NOTICE / ALERTA DE SEGURIDAD:* Wind gusts at ${weather.windGusts} km/h (>20 kts). Gate 4 glass seating suspended / Montaje de cristal suspendido por viento.`;
        } else if (weather.isRainingOrStorm || weather.precip > 0 || weather.precipProbability4h > 40) {
          weatherNotice += `\n🌧️ *WEATHER NOTICE / ALERTA DE LLUVIA:* Rain/storm detected. Hold outdoor assembly & gluing / Suspender pegado y montaje exterior.`;
        } else if (weather.humidity > 85 || dewDelta <= 2) {
          weatherNotice += `\n⚠️ *CONDENSATION NOTICE / ALERTA DE HUMEDAD:* High surface moisture risk. Hold Gate 7 turf adhesive / Suspender adhesivo de césped.`;
        }
      }
    }
  }

  // ==================================================================
  // PIPELINE A: INSTALLATION MILESTONE ENGINE (GATES 1 - 12)
  // ==================================================================
  if (siteMode === 'INSTALLATION' && !explicitTicketId) {
    console.log(`[Installation Engine] Processing construction sweep for ${courtLabel}`);

    const siteCapacity = parseInt(targetedSite?.fields?.['Total Courts'] || targetedSite?.fields?.['Venue Court Count']) || 1;
    const detectedCount = forensicAudit.courts_detected_count || 1;
    const isMultiCourt = siteCapacity > 1 || detectedCount > 1;

    const highestGate = forensicAudit.highest_facility_gate ||
      (forensicAudit.verified_gates?.length ? Math.max(...forensicAudit.verified_gates) : 0);
    const lowestGate = forensicAudit.lowest_facility_gate || highestGate;

    const progressPercent = Math.min(1.0, highestGate / 12);
    const inProgressGateNum = forensicAudit.in_progress_gate || (highestGate < 12 ? highestGate + 1 : null);
    const inProgressLabel = inProgressGateNum && GATE_NAMES[inProgressGateNum] ? `${inProgressGateNum}. ${GATE_NAMES[inProgressGateNum]}` : null;
    const gateLabel = GATE_NAMES[highestGate] ? `${highestGate}. ${GATE_NAMES[highestGate]}` : `Gate ${highestGate}`;

    const cleanEn = forensicAudit.transcript_en || forensicAudit.facility_summary || 'Construction sweep recorded.';

    let breakdownText = '';
    let compactGateStatus = inProgressLabel ? `${highestGate}. ${GATE_NAMES[highestGate] || 'Verified'} (${inProgressGateNum} In Progress)` : gateLabel;

    if (isMultiCourt && Array.isArray(forensicAudit.facility_breakdown) && forensicAudit.facility_breakdown.length > 0) {
      breakdownText = `\n📋 *Facility Breakdown (${siteCapacity} Courts):*\n` +
        forensicAudit.facility_breakdown.map(c => `• *${c.court_label}:* Gate ${c.highest_gate} (${c.stage_description || GATE_NAMES[c.highest_gate] || 'Active'})`).join('\n');
      
      compactGateStatus = forensicAudit.facility_breakdown.map(c => `${c.court_label}: G${c.highest_gate}`).join(' | ');
    }

    const previouslyCleared = targetedSite?.fields?.['Cleared Milestones'] || [];
    const newlyVerifiedGates = (forensicAudit.verified_gates || []).map(g => {
      const num = parseInt(String(g).replace(/\D/g, ''));
      return isNaN(num) ? String(g) : `Gate ${num}`;
    }).filter(g => !previouslyCleared.includes(g));

    if (targetedSite) {
      const allCleared = Array.from(new Set([...previouslyCleared, ...newlyVerifiedGates]));

      const updatePayload = {
        'Cleared Milestones': allCleared,
        'Current Gate': compactGateStatus,
        'Last Note': `[SWEEP - ${workerName} at ${timeStr}]:\n${forensicAudit.facility_summary || cleanEn}${breakdownText ? `\n${breakdownText}` : ''}`,
        'Last Intent': 'MILESTONE_PROGRESS'
      };

      if (lowestGate >= 12 && highestGate >= 12) {
        updatePayload['Workflow Mode'] = 'MAINTENANCE';
        updatePayload['Site Status'] = 'ACTIVE';
      }

      await airtableWriteWithAutoDrop('Sites', updatePayload, targetedSite.id);

      if (highestGate > 0 && newlyVerifiedGates.length > 0) {
        await fireInstallationJoyCannon(targetedSite, highestGate);
      }
    }

    let installCard = `🏗️ *TITAN OS | FACILITY MILESTONE VERIFIED*\n` +
      `*(Hito de Instalación Verificado)*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏟️ *Venue:* ${courtLabel} (${siteCapacity} Court${siteCapacity > 1 ? 's' : ''})\n` +
      `👤 *Lead / Instalador:* ${workerName}\n` +
      `📊 *Progress:* ${Math.round(progressPercent * 100)}% (Leading at ${gateLabel})\n` +
      (breakdownText ? `${breakdownText}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👁️ *Visual Ground Truth:*\n${forensicAudit.facility_summary || cleanEn}\n\n`;

    if (weatherNotice) installCard += `${weatherNotice}\n\n`;
    installCard += `✅ *Facility digital twin updated in Sites ledger.*`;

    await sendWhatsAppMessage(dispatchTarget, installCard);

    // Consolidate Vault Logging: write only on milestone advance or critical alerts
    const hasMeaningfulMilestone = newlyVerifiedGates.length > 0 || highestGate === 12;
    const hasBlockerOrAlert = (forensicAudit.blockers_detected && forensicAudit.blockers_detected.length > 0) ||
                              forensicAudit.status_observed === 'ACTION_REQUIRED';

    if (hasMeaningfulMilestone || hasBlockerOrAlert) {
      try {
        const videoIndex = items.findIndex(item => item.type === 'video');
        const storageResult = storageResults[videoIndex >= 0 ? videoIndex : 0];
        const inboundRecord = await airtableWriteWithAutoDrop('Inbound Messages 2', {
          'Message ID': items[0]?.messageId,
          'Worker Phone Raw': fromPhone,
          'Message Type': hasVideo ? 'video' : 'image',
          'Caption Text': `[FACILITY SWEEP - Gate ${highestGate}/12]: ${cleanEn}`,
          'Media URL': storageResult?.signedUrl,
          'Media Path': storageResult?.storagePath,
          'Raw Payload JSON': JSON.stringify(items[0]?.rawMessage)
        });

        await airtableWriteWithAutoDrop('Reports 2', {
          'Inbound Messages 2': inboundRecord?.id ? [inboundRecord.id] : [],
          'Sites': targetedSite ? [targetedSite.id] : [],
          'Workflow Mode': 'INSTALLATION',
          'Overall Status': 'MILESTONE_PROGRESS',
          'Site Conditions': forensicAudit.site_conditions || 'Construction Active',
          'Action Items': (forensicAudit.action_items || []).join('\n'),
          'Status Observed': forensicAudit.status_observed || 'MILESTONE_PROGRESS',
          'Action Intent': 'MILESTONE_CLEARANCE',
          'WhatsApp Reply Text': installCard,
          'Clean JSON': JSON.stringify(forensicAudit, null, 2)
        });
      } catch (e) {
        console.warn('[INOC Vault Sync Warning]:', e.message);
      }
    } else {
      console.log(`[INOC Vault] Routine check with no milestone advancement; archived to Supabase Dark Matter.`);
    }

    return;
  }

  // ==================================================================
  // PIPELINE B: MAINTENANCE VIDEO DELTA (PRE-WORK -> POST-WORK)
  // ==================================================================
  if (hasVideo) {
    const videoIndex = items.findIndex(item => item.type === 'video');
    const videoStorageUrl = storageResults[videoIndex]?.signedUrl || '';

    if (!activeTicket) {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ Visual verified, but no active open work order was found for *${courtLabel}*.`);
      return;
    }

    const ticketExistingNotes = activeTicket.fields['Notes'] || '';
    const hasExistingPreWork = Boolean(
      activeTicket.fields['Pre-Work Media'] || ticketExistingNotes.includes('[PRE-WORK BASELINE VIDEO]')
    );

    const isIntakeBaseline = (forensicAudit.video_phase === 'INTAKE_BASELINE') ||
      (!hasExistingPreWork && forensicAudit.video_phase !== 'COMPLETION_CLOSEOUT');

    const cleanEn = forensicAudit.transcript_en || forensicAudit.transcription || 'Court sweep logged.';
    const cleanEs = forensicAudit.transcript_es || 'Barrido de cancha registrado.';

    if (isIntakeBaseline) {
      const blockers = forensicAudit.blockers_detected || [];
      const blockerList = blockers.length > 0 ? blockers.map(b => `• ${b}`).join('\n') : 'None reported / Ninguno';

      const updatedNotes = `${ticketExistingNotes}\n\n[PRE-WORK BASELINE VIDEO - ${timeStr} by ${workerName}]:\nURL: ${videoStorageUrl}\nEN: "${cleanEn}"\nES: "${cleanEs}"\nBlockers: ${blockers.join(', ') || 'None'}`.trim();

      await airtableWriteWithAutoDrop('Daily Assignments', {
        'Status': 'In Progress',
        'Pre-Work Media': videoStorageUrl,
        'Notes': updatedNotes
      }, activeTicket.id);

      if (targetedSite) {
        await airtableWriteWithAutoDrop('Sites', {
          'Last Note': `Intake baseline locked for Ticket #${activeTicket.fields['Assignment ID'] || activeTicket.id}: ${blockers.length ? `Blockers: ${blockers.join(', ')}` : 'Nominal'}`,
          'Last Intent': 'INTAKE_BASELINE_LOCKED'
        }, targetedSite.id);
      }

      let baselineCard = `🎥 *TITAN OS | PRE-WORK BASELINE LOCKED*\n` +
        `*(Línea Base Previa Bloqueada)*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 *Ticket #${activeTicket.fields['Assignment ID'] || activeTicket.id} Active / Activo*\n` +
        `🏟️ *Court / Cancha:* ${courtLabel}\n` +
        `👤 *Technician / Técnico:* ${workerName}\n` +
        `⏱️ *Time / Hora:* ${timeStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎙️ *Field Audio / Audio de Campo:*\n` +
        `🇺🇸 *EN:* "${cleanEn}"\n` +
        `🇪🇸 *ES:* "${cleanEs}"\n\n`;

      if (blockers.length > 0) {
        baselineCard += `⚠️ *Blockers Detected / Bloqueadores:*\n${blockerList}\n\n`;
      } else {
        baselineCard += `🟢 *Baseline Condition / Condición:* Nominal (No blockers logged)\n\n`;
      }

      if (weatherNotice) baselineCard += `${weatherNotice}\n\n`;

      baselineCard += `👉 *Status: IN PROGRESS / EN PROGRESO.*\n` +
        `Proceed with service. When finished, send a 10-second completion video to auto-verify and close hands-free.\n` +
        `_Realice el trabajo. Al terminar, envíe video de 10s para verificar y cerrar automáticamente._`;

      await sendWhatsAppMessage(dispatchTarget, baselineCard);
      return;
    }

    if (!isIntakeBaseline || forensicAudit.video_phase === 'COMPLETION_CLOSEOUT') {
      const workDone = (forensicAudit.work_verified && forensicAudit.work_verified.length > 0)
        ? forensicAudit.work_verified.join(', ')
        : (forensicAudit.resolution_summary || forensicAudit.worker_summary || 'Service and playability verified on-site.');

      const updatedNotes = `${ticketExistingNotes}\n\n[POST-WORK CLOSEOUT VIDEO - ${timeStr} by ${workerName}]:\nURL: ${videoStorageUrl}\nWork Verified: ${workDone}`.trim();

      await airtableWriteWithAutoDrop('Daily Assignments', {
        'Status': 'Complete',
        'Post-Work Media': videoStorageUrl,
        'Notes': updatedNotes
      }, activeTicket.id);

      await executeWorkOrderCloseout({
        site: targetedSite,
        targetCourtName: courtLabel,
        ticketId: activeTicket.fields['Assignment ID'],
        resolutionNotes: `Video Delta Verified: ${workDone}`,
        worker,
        dispatchTarget,
        fromPhone,
        isVideoDelta: true
      });
      return;
    }
  }

  let replyText = forensicAudit.whatsapp_status_text || 'Audit logged.';
  if (weatherNotice) replyText += `\n\n${weatherNotice}`;
  await sendWhatsAppMessage(dispatchTarget, replyText);
}

// ====================================================================
// 14. INGRESS DISPATCH CONTROLLER
// ====================================================================

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    console.log('[Meta Webhook] Verification successful.');
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
    if (processedMessageMap.has(messageId)) {
      console.log(`[Deduplicator] Dropped duplicate message ${messageId}`);
      return;
    }
    processedMessageMap.set(messageId, Date.now());

    const rawFrom = message.from || '';
    const rawAuthor = message.author || message.participant || '';
    const rawChatId = message.chat_id || message.group_id || changes?.metadata?.phone_number_id || '';

    const isGroupMessage = rawFrom.includes('@g.us') || rawChatId.includes('@g.us');
    const groupJid = rawFrom.includes('@g.us')
      ? rawFrom
      : (rawChatId.includes('@g.us') ? rawChatId : null);

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
    let site = callerIdentity.siteRecord || await lookupSite(groupJid || fromPhone);
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
    const isAmbientChannel = AMBIENT_CHAT_MODES.includes(currentMode);

    const senderSource = isAuthorizedClient
      ? 'Joy Cannon (Client)'
      : (currentMode === 'SPOT_VISIT' ? 'Exec Visit (Bob)' : 'Dispatch');

    const indoorSite = isIndoorSite(site);

    // INTERACTIVE BUTTON REPLIES
    if (message.type === 'interactive') {
      const interactive = message.interactive;
      const buttonReply = interactive?.button_reply;
      const selectedId = buttonReply?.id || '';
      const selectedTitle = buttonReply?.title || '';

      console.log(`[Interactive Button Tap] Received '${selectedTitle}' (${selectedId}) from ${fromPhone}`);

      if (selectedId.startsWith('DISPATCH_APPROVE_')) {
        const parts = selectedId.split('_');
        const nextTicketId = parts[2];
        const nextWorkerId = parts[3];

        let targetTicket = null;
        if (nextTicketId && nextTicketId !== 'any') {
          targetTicket = await findActiveTicketForSite(null, nextTicketId);
        }

        if (targetTicket) {
          const updateFields = { 'Status': 'In Progress' };
          if (nextWorkerId && nextWorkerId !== 'any') {
            updateFields['Worker'] = [nextWorkerId];
          }
          await airtableWriteWithAutoDrop('Daily Assignments', updateFields, targetTicket.id);

          const targetSiteId = targetTicket.fields['Sites']?.[0] || targetTicket.fields['Site']?.[0];
          const cachedSites = await getCachedSites();
          const targetSiteRecord = targetSiteId ? cachedSites.find(s => s.id === targetSiteId) : null;
          const targetCourtName = targetSiteRecord?.fields?.['Site Name'] || 'Assigned Court';
          const taskCategory = targetTicket.fields['Task Category'] || targetTicket.fields['Assignment Type'] || 'Service';

          let isCoLocated = false;
          let distanceKm = null;
          let targetCoords = null;

          if (targetSiteRecord) {
            targetCoords = await resolveCoordinates(targetSiteRecord);
          }

          if (site && targetSiteRecord) {
            if (site.id === targetSiteRecord.id) {
              isCoLocated = true;
              distanceKm = 0.0;
            } else {
              const currentCoords = await resolveCoordinates(site);
              if (currentCoords && targetCoords) {
                distanceKm = haversineDistanceKm(currentCoords.lat, currentCoords.lon, targetCoords.lat, targetCoords.lon);
                if (distanceKm <= 0.15) isCoLocated = true;
              }
            }
          }

          if (isCoLocated || distanceKm === 0.0) {
            const onSiteCard = `🎾 *TITAN OS | ON-SITE DISPATCH ACTIVATED*\n` +
              `*(Despacho en Sitio Activado)*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket #${nextTicketId} Activated / Activado*\n` +
              `🏟️ *Court / Cancha:* ${targetCourtName}\n` +
              `📍 *Distance / Distancia:* ~0.0 km (Co-located at venue / En el mismo club)\n` +
              `🔧 *Scope / Alcance:* ${taskCategory}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👉 *STEP 1: INTAKE SWEEP (BEFORE TOUCHING TOOLS)*\n` +
              `Record a 15-second walkaround video of the court. Speak conditions & blockers out loud.\n\n` +
              `👉 *PASO 1: BARRIDO DE ENTRADA (ANTES DE TOCAR HERRAMIENTAS)*\n` +
              `Grabe un video de 15 segundos alrededor de la cancha. Mencione el estado y cualquier impedimento.`;

            await dispatchReply(onSiteCard);
          } else {
            const navLink = targetCoords
              ? `https://www.google.com/maps/dir/?api=1&destination=${targetCoords.lat},${targetCoords.lon}`
              : 'Address logged in Sites directory';
            const distLabel = distanceKm !== null ? `~${distanceKm.toFixed(1)} km away` : 'En Route';

            const transitCard = `🚗 *TITAN OS | TRANSIT DISPATCH ACTIVATED*\n` +
              `*(Despacho en Tránsito Activado)*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket #${nextTicketId} Assigned / Asignado*\n` +
              `🏟️ *Destination / Destino:* ${targetCourtName} (${distLabel})\n` +
              `🗺️ *Google Maps:* ${navLink}\n` +
              `🔧 *Scope / Tarea:* ${taskCategory}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👉 *UPON ARRIVAL (STEP 1) / AL LLEGAR (PASO 1):*\n` +
              `Send a 15-second walkaround video before starting work / Envíe video de 15s antes de empezar.`;

            await dispatchReply(transitCard);
          }
        } else {
          await dispatchReply(`✅ *DISPATCH CONFIRMED*\nRoute verified and updated in Daily Assignments.`);
        }
        return;
      }

      if (selectedId.startsWith('PROMOTE_VAULT_')) {
        const vaultId = selectedId.replace('PROMOTE_VAULT_', '');
        try {
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
              'Source': 'Dark Matter Promotion',
              'Status': 'Open',
              'Notes': `[PROMOTED AMBIENT NOTE - ${item.category}]:\n"${item.raw_text}"`
            };

            if (item.site_id) assignmentPayload['Sites'] = [item.site_id];
            const created = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = created?.fields?.['Assignment ID'] ? `#${created.fields['Assignment ID']}` : 'NEW';

            await fetch(`${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.tableDarkMatter}?id=eq.${vaultId}`, {
              method: 'PATCH',
              headers: getSupabaseHeaders('application/json'),
              body: JSON.stringify({ status: 'PROMOTED', actionable_followup: `Ticket ${ticketId}` })
            });

            await dispatchReply(`📋 *PROMOTED TO TICKET ${ticketId}*\nAmbient note officially entered into Daily Assignments for ${item.site_name}.`);
            return;
          }
        } catch (e) {
          console.error('[Promotion Error]:', e);
        }
      }

      if (selectedId.startsWith('ROUTE_FACTORY_')) {
        await dispatchReply(`🏭 *RETURN ROUTE LOGGED / REGRESO A FÁBRICA*\nTechnician heading back to Orillia Factory for staging.`);
        return;
      }

      await dispatchReply(`✅ Selected: *${selectedTitle}* — Logged into Operations.`);
      return;
    }

    // LOCATION PIN-DROP (ADDITIVE 300M ARRIVAL TRIGGER)
    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;

      if (!site) {
        await dispatchReply(`⚠️ This group is not connected to a court yet. Type */group <Court Name>* to connect.`);
        return;
      }

      let siteCoords = await resolveCoordinates(site);

      if (!siteCoords) {
        const coordString = `${userLat.toFixed(5)}, ${userLon.toFixed(5)}`;
        await airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, site.id);
        siteCoords = { lat: userLat, lon: userLon };

        await dispatchReply(
          `📍 *COURT GPS ANCHORED*\n` +
          `Locked coordinates (*${coordString}*) to *${site.fields['Site Name']}*.\n` +
          `✅ 300m presence geofence and weather tripwires are now active!`
        );
        return;
      }

      const distanceMeters = haversineDistanceKm(userLat, userLon, siteCoords.lat, siteCoords.lon) * 1000;
      const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || (fromPhone ? `Crew (+${fromPhone.slice(-4)})` : 'Field Tech');
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (distanceMeters <= 300) {
        const checkinNote = `On-site presence verified for ${workerName} at ${timestamp} (${Math.round(distanceMeters)}m from court center).`;
        await airtableWriteWithAutoDrop('Sites', { 'Last Note': checkinNote, 'Last Intent': 'PRESENCE_VERIFIED' }, site.id);

        const activeTicket = await findActiveTicketForSite(site.id);

        let checkinResponse = `📍 *ON-SITE ARRIVAL VERIFIED / LLEGADA EN SITIO*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Technician / Técnico:* ${workerName}\n` +
          `🏟️ *Court / Cancha:* ${site.fields['Site Name']}\n` +
          `⏱️ *Time / Hora:* ${timestamp} (~${Math.round(distanceMeters)}m)\n`;

        if (activeTicket) {
          const ticketNum = activeTicket.fields['Assignment ID'] ? `#${activeTicket.fields['Assignment ID']}` : '';
          const taskCat = activeTicket.fields['Task Category'] || activeTicket.fields['Assignment Type'] || 'Service';

          await airtableWriteWithAutoDrop('Daily Assignments', { 'Status': 'In Progress' }, activeTicket.id);

          checkinResponse += `🎫 *Active Ticket / Boleto Activo:* ${ticketNum} (${taskCat})\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👉 *STEP 1: INTAKE SWEEP / PASO 1: ENTRADA*\n` +
            `Send your 15-second walkaround video before touching tools.\n` +
            `_Envíe su video de 15 segundos narrando impedimentos antes de empezar a trabajar._`;
        } else {
          checkinResponse += `\n🟢 No active work orders pending. Shift logged on court twin / Sin órdenes pendientes.`;
        }

        await dispatchReply(checkinResponse);
      } else {
        await dispatchReply(
          `📍 *LOCATION PIN RECEIVED / PIN RECIBIDO*\n\n` +
          `Distance to court: ${(distanceMeters / 1000).toFixed(1)} km from *${site.fields['Site Name']}*.\n` +
          `Arrival check-in requires being within 300m / El check-in requiere estar a menos de 300m.`
        );
      }
      return;
    }

    // TEXT PROCESSING & AMBIENT SIPHON
    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const intent = COMMAND_MAP[trigger.toLowerCase()];

      if (intent) {
        if (intent === 'LINK_SITE') {
          const targetSiteName = args.join(' ');
          const targetSite = await lookupSite(null, targetSiteName);
          if (!targetSite) {
            await dispatchReply(`❌ Could not find "${targetSiteName}". Check spelling in Airtable.`);
            return;
          }

          const targetBindingId = groupJid || fromPhone;
          await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': targetBindingId }, targetSite.id);
          await dispatchReply(`✅ *CONNECTED TO ${targetSite.fields['Site Name'].toUpperCase()}*`);
          return;
        }

        if (intent === 'LOCATION') {
          if (!site) {
            await dispatchReply(`⚠️ Please link a court first with /group <Court Name> to fetch coordinates.`);
            return;
          }
          const coords = await resolveCoordinates(site);
          if (!coords) {
            await dispatchReply(`📍 No GPS coordinates locked for *${site.fields['Site Name']}*. Drop a location pin to anchor!`);
            return;
          }
          const links = getGoogleMapsLinks(coords.lat, coords.lon);
          await dispatchReply(
            `📍 *${site.fields['Site Name'].toUpperCase()} | GPS ANCHOR*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `• *Coordinates:* ${coords.lat}, ${coords.lon}\n\n` +
            `🗺️ *Driving Directions / Ruta:*\n${links.directions}\n\n` +
            `🛰️ *Satellite Staging View (Yard & Tree Clearance):*\n${links.satellite}`
          );
          return;
        }

        if (intent === 'WEATHER') {
          if (!site) {
            await dispatchReply(`⚠️ Please link a court first with /group <Court Name> to check telemetry.`);
            return;
          }
          const coords = await resolveCoordinates(site);
          if (!coords) {
            await dispatchReply(`📍 Court coordinates not found. Drop a location pin first!`);
            return;
          }
          const weather = await getHyperlocalWeather(coords.lat, coords.lon);
          if (!weather) {
            await dispatchReply(`⚠️ Weather service temporarily unavailable.`);
            return;
          }
          const dewDelta = weather.temp - weather.dewPoint;
          const wReport = `🌤️ *HYPERLOCAL WEATHER | ${site.fields['Site Name'].toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `• Temperature: ${weather.temp}°C (Dew Point: ${weather.dewPoint}°C)\n` +
            `• Wind: ${weather.windSpeed} km/h (Gusts: ${weather.windGusts} km/h)\n` +
            `• Humidity: ${weather.humidity}% (Delta: ${dewDelta.toFixed(1)}°C)\n` +
            `• Rain Probability (Next 4h): ${weather.precipProbability4h}%\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `• Wind: ${weather.windGusts > 37 ? '⛔ Wind gusts > 20 kts. Glass seating suspended.' : '🟢 Wind nominal for glass.'}\n` +
            `• Moisture: ${weather.humidity > 85 || dewDelta <= 2 ? '⚠️ High moisture. Turf adhesive hold.' : '🟢 Surface dry for turf gluing.'}`;
          await dispatchReply(wReport);
          return;
        }

        if (intent === 'COURT_BOARD') {
          await handleCompoundScheduler('board', callerIdentity, dispatchTarget, fromPhone, site);
          return;
        }

        if (intent === 'FLEET_MAP_LINK') {
          await dispatchReply(`🗺️ *TITAN OS LIVE FLEET MAP*\n\nView continental digital twins and site conditions:\nhttps://${req.headers.host}/fleet-map`);
          return;
        }

        if (intent === 'READINESS_GATE_CHECK') {
          if (!site) {
            await dispatchReply(`⚠️ Please link a court first with /group <Court Name> to check readiness.`);
            return;
          }
          const gate = evaluateReadinessGate(site);
          const report = `🏗️ *BOUNCE PADEL | SPRING 2027 READINESS GATE*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🏟️ *Court:* ${site.fields['Site Name']}\n` +
            `🚦 *Status:* ${gate.status}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 *Verification Matrix:*\n` +
            `${gate.details}\n\n` +
            `👉 *Assigned Crew:* ${site.fields['Assigned Crew'] || 'Unassigned (Alpha/Beta)'}`;
          await dispatchReply(report);
          return;
        }

        if (intent === 'SITE_CONTEXT') {
          const targetName = args.join(' ') || site?.fields?.['Site Name'];
          if (!targetName) {
            await dispatchReply(`⚠️ Specify court: /context <Court Name>`);
            return;
          }

          const notes = await fetchRecentDarkMatter(targetName, 5);
          if (notes.length === 0) {
            await dispatchReply(`ℹ️ No ambient dark matter or field logs recorded yet for *${targetName}*.`);
            return;
          }

          let response = `🌌 *AMBIENT FIELD INTELLIGENCE | ${targetName.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n`;
          notes.forEach((n, idx) => {
            const time = new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            response += `${idx + 1}. [${n.category}] *${n.sender_name}* (${time}):\n   "${n.distilled_context || n.raw_text}"\n`;
          });
          response += `━━━━━━━━━━━━━━━━━━━━\n💡 Type */promote <number>* or reply to convert any note to an active ticket.`;

          await dispatchReply(response);
          return;
        }

        if (intent === 'SEARCH_VAULT') {
          const query = args.join(' ');
          if (!query) {
            await dispatchReply(`⚠️ Usage: */search <keyword>* (e.g. */search generator*, */search glass*)`);
            return;
          }

          const results = await searchDarkMatterVault(query, 5);
          if (results.length === 0) {
            await dispatchReply(`🔍 No field logs found matching "*${query}*".`);
            return;
          }

          let response = `🔍 *TITAN VAULT SEARCH | "${query}"*\n━━━━━━━━━━━━━━━━━━━━\n`;
          results.forEach((r, idx) => {
            const d = new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
            response += `• *${r.site_name}* (${d} by ${r.sender_name}):\n   "${r.distilled_context || r.raw_text}"\n`;
          });

          await dispatchReply(response);
          return;
        }

        if (intent === 'HELP') {
          await dispatchReply(`🤖 *TITAN OS COMMAND MATRIX (COMANDOS)*\n\n` +
            `• */w* — Hyperlocal Weather & Wind / Clima y Viento\n` +
            `• */map* — Google Maps Navigation & Satellite / Navegación y Satélite\n` +
            `• */s* — Site Status / Estado de Cancha\n` +
            `• */g* — Spring 2027 Mobilization Gate Check\n` +
            `• */context* [Court] — Review ambient field notes\n` +
            `• */search* <keyword> — Search dark matter field vault\n` +
            `• */board* — Compound Court Reservations Board\n` +
            `• */fleet* — Continental Fleet Map\n` +
            `• */group <Court Name>* — Bind WhatsApp Channel\n\n` +
            `🧾 Photos of receipts automatically log expense tickets with attachments into Daily Assignments.\n` +
            `🎥 Video sweeps automatically lock pre-work baselines & post-work completion deltas hands-free.`);
          return;
        }
      }

      if (isBoundGroupMember || callerIdentity.role === 'Family Member / Player' || callerIdentity.role === 'Compound Member') {
        const handled = await handleCompoundScheduler(rawText, callerIdentity, dispatchTarget, fromPhone, site);
        if (handled) return;
      }

      if (callerIdentity.role === 'Owner / Principal' || callerIdentity.role === 'Property Manager / Caretaker') {
        const lower = rawText.toLowerCase();
        if (lower.includes('sand') || lower.includes('groom') || lower.includes('clean') ||
            lower.includes('glass') || lower.includes('net') || lower.includes('tournament') || lower.includes('sweep')) {
          await handleVIPConcierge(rawText, callerIdentity, dispatchTarget, fromPhone);
          return;
        }
      }

      const isDirectOrAdmin = !isGroupMessage || (worker && worker.fields['Role'] === 'Admin') || isAmbientChannel || (site && AMBIENT_CHAT_MODES.includes(site.fields['Workflow Mode']));

      if (isDirectOrAdmin && rawText.length > 2) {
        try {
          const recentDarkMatter = site ? await fetchRecentDarkMatter(site.fields['Site Name'], 3) : [];
          const triage = await triageDispatchText(rawText, worker, site, recentDarkMatter);

          if (triage.exhaust_tier === 'PURE_NOISE') return;

          if (triage.exhaust_tier === 'DARK_MATTER') {
            const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
            const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Fleet General';

            const archivedRecord = await streamToDarkMatterVault({
              siteId: site?.id || null,
              siteName: siteLabel,
              senderPhone: fromPhone,
              senderName: senderName,
              rawText: rawText,
              category: triage.dark_matter_category || 'Site Conditions',
              distilledContext: triage.distilled_context || rawText,
              urgency: triage.urgency || 'LOW',
              gravityScore: triage.gravity_score || 1
            });

            if (site && (triage.gravity_score >= 4 || triage.urgency === 'HIGH')) {
              await airtableWriteWithAutoDrop('Sites', {
                'Last Note': `[FIELD NOTE - ${triage.dark_matter_category}]: ${triage.distilled_context}`,
                'Last Intent': 'AMBIENT_ALERT'
              }, site.id);

              if (archivedRecord?.id) {
                const alertPrompt = `⚠️ *FIELD INTELLIGENCE RECORDED*\n\n` +
                  `*Site:* ${siteLabel}\n` +
                  `*Issue:* ${triage.distilled_context}\n` +
                  `*Category:* ${triage.dark_matter_category} (Urgency: ${triage.urgency})\n\n` +
                  `Archived into Supabase vault. Want to promote this into an active dispatch ticket?`;

                const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Promote to Ticket' }];
                await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
              }
            }
            return;
          }

          if (triage.exhaust_tier === 'ACTIONABLE_STATE_CHANGE') {
            if (triage.intent === 'WORK_ORDER_CLOSEOUT') {
              await executeWorkOrderCloseout({
                site,
                targetCourtName: triage.matched_site_name,
                ticketId: triage.ticket_id,
                resolutionNotes: triage.resolution_summary || 'Task completed.',
                worker,
                dispatchTarget,
                fromPhone
              });
              return;
            }
          }
        } catch (triageErr) {
          console.warn('[Dispatch Triage Exception]:', triageErr.message);
        }
      }
      return;
    }

    // MULTIMODAL MEDIA BATCHING (PHOTOS, VIDEOS & AUDIO)
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || (isAudio ? '[Spoken Voice Memo]' : '');

    const reactionEmoji = isAudio ? '🎧' : (isVideo ? '🎥' : '🧾');
    sendWhatsAppReaction(dispatchTarget, messageId, reactionEmoji).catch(() => {});

    const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });
    const metaMediaData = await metaMediaRes.json().catch(() => ({}));

    if (!metaMediaRes.ok || !metaMediaData?.url) {
      if (metaMediaRes.status === 401 || metaMediaData?.error?.code === 190) {
        console.error(`[Meta Auth Error] WhatsApp Token expired or invalid (Code 190). Update META_ACCESS_TOKEN in Render environment variables!`);
      } else {
        console.error(`[Meta Graph Error] Could not resolve mediaId ${mediaId}:`, metaMediaData);
      }
      await dispatchReply(`⚠️ WhatsApp connection error. Please verify the system token.`);
      return;
    }

    const mediaBufferRes = await fetch(metaMediaData.url, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });

    if (!mediaBufferRes.ok) {
      console.error(`[CDN Error] Failed to stream binary (${mediaBufferRes.status})`);
      return;
    }

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
        senderSource,
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
// 15. GAMECAM OFF-HOURS 4K COURT HEALTH WEBHOOK GATEWAY
// ====================================================================

app.post('/api/webhooks/gamecam/snapshot', async (req, res) => {
  const apiKey = req.headers['x-gamecam-secret'];
  if (apiKey !== CONFIG.gamecam.webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid GameCam secret key' });
  }

  const { venue_name, court_number, image_url, captured_at, telemetry } = req.body;

  if (!venue_name || !image_url) {
    return res.status(400).json({ error: 'Missing venue_name or image_url payload parameter' });
  }

  res.status(200).json({ status: 'received', venue: venue_name, court: court_number || 1 });

  setImmediate(async () => {
    try {
      console.log(`[GameCam Webhook] Ingested snapshot for ${venue_name} - Court ${court_number || 1}`);

      const matchedSite = await lookupSite(null, venue_name);
      const siteLabel = matchedSite?.fields?.['Site Name'] || venue_name;

      const healthPrompt = `
You are the Titan OS Court Preservation & Maintenance Auditor.
Analyze this 4K snapshot from the elevated court camera for physical condition.

EVALUATE:
1. Silica Sand Distribution: Is infill uniform, or depleted at baseline/'T' boxes?
2. Turf Pile Wear: Is synthetic turf backing exposed? Compaction score (1-100).
3. Overhead LED Luminaires: Are any floodlights burned out or dark?
4. Tempered Glass: Smudges, cracks, or loose gaskets visible?

OUTPUT FORMAT (JSON ONLY):
{
  "court_health_score": number (1-100),
  "condition": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "sand_infill_uniformity_pct": number,
  "turf_wear_severity": "LOW" | "MODERATE" | "SEVERE",
  "led_fixtures_status": "ALL_LIT" | "PARTIAL_OUTAGE" | "OFFLINE",
  "defects_detected": ["string in English"],
  "recommended_action": "string in English",
  "estimated_remediation_hours": number
}
`;

      const payload = {
        system_instruction: { parts: [{ text: healthPrompt }] },
        contents: [
          {
            parts: [
              { text: `Evaluate asset health for ${siteLabel} - Court ${court_number || 1}. Image URL: ${image_url}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      };

      const gRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!gRes.ok) throw new Error(`Gemini health scan failed: ${await gRes.text()}`);

      const gData = await gRes.json();
      const audit = JSON.parse(gData.candidates?.[0]?.content?.parts?.[0]?.text || '{}');

      console.log(`[GameCam Audit Result] ${siteLabel} - Court ${court_number}: Score ${audit.court_health_score}/100 (${audit.condition})`);

      if (matchedSite) {
        const updateFields = {
          'Last Note': `[GAMECAM 4K AUDIT - Court ${court_number || 1}]: Score ${audit.court_health_score}/100 | ${audit.condition} | ${audit.recommended_action || 'Nominal'}`,
          'Last Intent': 'FACILITY_HEALTH_AUDIT'
        };
        await airtableWriteWithAutoDrop('Sites', updateFields, matchedSite.id);

        if (audit.condition === 'ACTION_REQUIRED' || audit.condition === 'HAZARD_OUT_OF_SERVICE') {
          const gmPhone = matchedSite.fields['Client Phone'] || matchedSite.fields['WhatsApp Group ID'];
          if (gmPhone) {
            const alertCard = `🎾 *TITAN OS × GAMECAM | COURT HEALTH ALERT*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🏟️ *Venue:* ${siteLabel} — Court ${court_number || 1}\n` +
              `📊 *Status:* ${audit.condition} 🟡 (Score: ${audit.court_health_score}/100)\n\n` +
              `👁️ *Visual Diagnostic:*\n` +
              (audit.defects_detected || []).map(d => `• ${d}`).join('\n') + `\n\n` +
              `💡 *Recommended Action:*\n${audit.recommended_action || 'Schedule grooming.'}\n\n` +
              `👉 Tap to dispatch service van or notify district team.`;

            await sendWhatsAppMessage(gmPhone, alertCard);
          }
        }
      }
    } catch (err) {
      console.error('[GameCam Processing Error]:', err.message);
    }
  });
});

// ====================================================================
// 16. HEALTH & RUNTIME
// ====================================================================

app.get('/api/admin/backfill-geo', async (req, res) => {
  try {
    console.log('🌍 [Google Geo] Starting continental fleet backfill & pin-nudging sweep...');
    const records = await getCachedSites(true);
    let updatedCount = 0;
    const coordTracker = new Map();

    for (const record of records) {
      const siteName = record.fields['Site Name'] || 'Unnamed Site';
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
        console.log(`📍 [Google Geo] Updated ${siteName} -> ${formatted}`);
        await new Promise(r => setTimeout(r, 150));
      }
    }

    invalidateAirtableCache('sites');
    res.json({
      status: 'success',
      courts_updated: updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Google Geo Backfill Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '5.2.1',
    engine: 'Titan OS V5.2.1 (Direct QuickBooks Attachment Pipeline & Expense Sync)',
    cache_status: {
      sites_cached: memoryCache.sites ? memoryCache.sites.length : 0,
      workers_cached: memoryCache.workers ? memoryCache.workers.length : 0,
      assignments_cached: memoryCache.assignments ? memoryCache.assignments.length : 0
    }
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V5.2.1 RUNNING ON PORT ${PORT}`);
  console.log(`🧾 EXPENSE INGESTION ENGINE: Receipts Auto-Routed & Attachments Synced to QB`);
  console.log(`🛡️ VISUAL TRIAGE ROUTER: Multimodal Bifurcation (Receipts vs Court Sweeps) Active`);
  console.log(`🛰️ GOOGLE GEO ENGINE: Millimeter Geocoding & Coordinate Auto-Heal Active`);
  console.log(`🎾 GAMECAM WEBHOOK GATEWAY: /api/webhooks/gamecam/snapshot Active`);
  console.log(`🛡️ API QUOTA PROTECTOR: In-Place Cache Mutation & Assignment Pooling Active`);
  console.log(`====================================================================`);

  try {
    await getCachedSites();
    await getCachedWorkers();
    await getCachedContacts();
    await getCachedOpenAssignments();
  } catch (err) {
    console.warn('[Cache Warmup Warning]:', err.message);
  }
});

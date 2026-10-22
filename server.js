/**
 * TITAN OS V5.3.5 — SILENT EXPENSE GHOST ROUTING & RESILIENT META DISPATCH
 * WITH ENTRY #088: ACOUSTIC RELATIONAL TICKET SYNTHESIS & FLEET OPEN-ISSUE ROUTING
 * 
 * Production Build Features:
 * 1. Silent Expense Ghost Routing: Expenses write to Daily Assignments with Status: 'Complete'
 *    and Task Category: 'Expense' so Automation 4 passes attachments to QuickBooks instantly
 *    without cluttering the active dispatch/punch-list board.
 * 2. Resilient Meta Dispatch with Auto-Retry: sendWhatsAppMessage includes automatic retry
 *    with exponential backoff, preventing dropped cards during transient Meta DNS/TCP timeouts.
 * 3. Autonomous Zero-Touch Provisioning: Field operators can drop a WhatsApp location pin
 *    and immediately reply "create new site [Name]" to automatically build a bound ledger
 *    record with live coordinates, triggering INOC prep-alerts.
 * 4. Open For Play Readiness Engine: Overrides pre-con checks for commissioned/maintenance courts
 *    ('OPEN FOR PLAY 🎾') and headquarters/operational nodes ('OPERATIONAL 🏢').
 * 5. Milestone-Aware Joy Cannon: Evaluates highest_gate advancement directly, eliminating
 *    missed client celebratory alerts when gates are in-progress or partial.
 * 6. E.164 Phone Sanitization: Automatically purges '+' and non-digit characters on all
 *    direct Meta Graph API calls to prevent HTTP 400 (#100) invalid parameter rejections.
 * 7. Proactive Weather Tripwire Matrix: Evaluates wind gust holds (>20 kts for glass),
 *    turf adhesive cold cure lockouts (<10°C / <5°C), surface condensation (dew point delta <=2.5°C),
 *    wet sand infill locks, active precipitation, and extreme heat flash-cure alerts (>35°C).
 * 8. On-Arrival Proactive Scan: Triggers live weather tripwire cards automatically upon 300m GPS arrival.
 * 9. Conversational Spoken Lookups & Relational Cross-Referencing (ENTRY #088): In-memory traversal
 *    from Sites to open Daily Assignments. Seamlessly synthesizes open repairs, chores, and commercial leads
 *    for natural voice queries ("Any tickets for Cynamon?", "Where is Levinsky?", "Status of RCOR").
 * 10. Google Geo Enterprise Engine: Millimeter geocoding, coordinate auto-healing, driving directions,
 *     zoom=20 satellite yard inspection, and twin-court 15m pin nudging.
 * 11. Simplified 8-Gate Field Rubric: Streamlined installer progression. Dropped lights gate.
 *     Rolled underlayment, seaming, gluing, and lines into Gate 5: 'Turf Laid'.
 * 12. Single-Court Targeting: Eliminates multi-court apron bleed so background courts
 *     never trigger false gate skips. Each court row is graded independently.
 * 13. Field Vernacular & Silicone Check: 'Glass Installed' and 'Posts'. Evaluates perimeter silicone
 *     as a quality check without blocking gate advancement.
 * 14. Turf Color Neutrality: Fully agnostic visual turf detection across all court surface colors.
 * 15. Clean Field Messaging: Removed developer jargon ('digital twin', 'vault', 'supabase') from all WhatsApp replies.
 * 16. In-Place RAM Cache Mutation: Updates Airtable memory cache instantly on write without API refetches.
 * 17. GameCam 4K Webhook Gateway: Ingestion endpoint (/api/webhooks/gamecam/snapshot) for elevated cameras.
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

const lastDroppedCoordinates = new Map();

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

  // 1. Bypass pre-con checks if the court is already built or in maintenance
  if (status === 'COMPLETE' || mode === 'MAINTENANCE') {
    return {
      status: 'OPEN FOR PLAY 🎾',
      details: 'Court is fully constructed and open for play.',
      isReady: true
    };
  }

  // 2. Bypass for internal headquarters, inventory, or production nodes
  if (['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY'].includes(mode)) {
    return {
      status: 'OPERATIONAL 🏢',
      details: 'Internal facility / operational node.',
      isReady: true
    };
  }

  // 3. Pre-Construction Mobilization Gate for active/upcoming builds
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
1. "FINANCIAL_RECEIPT": Store receipts (Home Depot, Lowe's, gas station, fuel, hardware store, Fastenal, restaurants/meals, lumber, supplies, equipment rental, parking), invoices, register slips.
2. "COURT_FACILITY": Padel court construction, court maintenance, turf, glass, mesh, frame, net, concrete pad, or sports facility walkaround.
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

  formattedNotes += `\nRECEIPT MEDIA URLS:\n` + storageResults.map(s => `• ${s.signedUrl}`).join('\n');

  const attachmentPayload = storageResults.map(s => ({ url: s.signedUrl }));

  const assignmentPayload = {
    'Date': todayStr,
    'Assignment Type': 'Expense',
    'Task Category': 'Expense',
    'Priority': 'Low',
    'Source': 'WhatsApp Receipt Intake',
    'Status': 'Complete',
    'Notes': formattedNotes,
    'Attachment(s)': attachmentPayload
  };

  if (worker?.id) assignmentPayload['Worker'] = [worker.id];
  if (site?.id) assignmentPayload['Sites'] = [site.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'EXP';

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
    actionableFollowup: `Expense ${ticketId}`
  });

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
// 7. SIMPLIFIED 8-GATE FORENSIC RUBRIC & VERNACULAR
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
  "blockers_detected": ["Specific impediment or missing hardware in English"],
  "work_verified": ["Specific verified stage completed in English"],
  "status_observed": "MILESTONE_PROGRESS" | "ACTION_REQUIRED" | "COMMISSIONED" | "NOMINAL",
  "site_conditions": "Short string in English",
  "action_items": ["Action item in English"],
  "summary": "1-2 sentence concise executive summary of visible court progress",
  "whatsapp_status_text": "Plaintext WhatsApp card"
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & VIP Field Concierge Engine.

CRITICAL DIRECTIVE:
1. "SMART VERBATIM": Purge speech hesitations ("uh", "ah", "um").
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

  // 1. Direct Regex Match on "lat, lon"
  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (directMatch) {
      const coords = { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
      memoryCache.coordinates.set(rawLocation, coords);
      return coords;
    }
  }

  // 2. Decode Airtable Native Map Cache
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

/**
 * Dedicated Proactive Weather Tripwire Engine
 * Evaluates physical construction constraints (wind, cold temp, condensation, wet turf, heat).
 */
function evaluateWeatherTripwires(weather, targetGate = null) {
  if (!weather) return { holds: [], warnings: [], nominal: true, summaryText: '' };

  const holds = [];
  const warnings = [];
  const dewDelta = weather.temp - weather.dewPoint;

  // 1. HIGH WIND GUST TRIPWIRE (>20 kts / 37 km/h) -> Glass Seating Hold
  if (weather.windGusts > 37) {
    holds.push(`⛔ *WIND HOLD (${weather.windGusts} km/h / >20 kts):* Crane & suction cup glass installation prohibited. High panel sail hazard.`);
  } else if (weather.windGusts > 28) {
    warnings.push(`💨 *WIND WARNING (${weather.windGusts} km/h):* Approach glass seating with caution; verify post anchoring.`);
  }

  // 2. TURF ADHESIVE COLD LOCKOUT (<10°C / 50°F) -> Chemical Cure Failure
  if (weather.temp < 5) {
    holds.push(`❄️ *COLD LOCKOUT (${weather.temp}°C):* Total freeze lockout on polyurethane turf adhesive. Chemical bonding fails below 5°C.`);
  } else if (weather.temp < 10) {
    holds.push(`⚠️ *TURF GLUE CURE HOLD (${weather.temp}°C / <50°F):* Adhesive curing requires >=10°C. Do not glue turf seams until ambient temp rises.`);
  }

  // 3. CONDENSATION & MOISTURE TRIPWIRE (Humidity > 85% or Dew Delta <= 2.5°C)
  if (weather.humidity > 85 || dewDelta <= 2.5) {
    holds.push(`💧 *CONDENSATION HOLD:* Dew delta is ${dewDelta.toFixed(1)}°C (Humidity: ${weather.humidity}%). Pad/carpet surface moisture will ruin adhesive bond.`);
  }

  // 4. PRECIPITATION / RAIN TRIPWIRE (Active Rain or >40% chance in 4h)
  if (weather.isRainingOrStorm || weather.precip > 0) {
    holds.push(`🌧️ *RAIN HOLD:* Active rain/storm detected. Hold all outdoor gluing, glass, and mesh.`);
  } else if (weather.precipProbability4h > 40) {
    warnings.push(`🌦️ *RAIN PROBABILITY (${weather.precipProbability4h}% in 4h):* Keep blue tarps staged over open turf rolls and seaming tape.`);
  }

  // 5. WET SAND INFILL LOCKOUT (Clumps silica sand)
  if (weather.isRainingOrStorm || weather.precip > 0 || weather.humidity > 90) {
    holds.push(`⏳ *SAND INFILL HOLD:* Wet conditions detected. Silica sand must strictly be applied to dry turf to prevent pile clumping.`);
  }

  // 6. EXTREME HEAT FLASH-CURE ALERT (>35°C / 95°F)
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

  if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

  const signUrl = `${CONFIG.supabase.url}/storage/v1/object/sign/${CONFIG.supabase.bucket}/${storagePath}`;
  const signRes = await fetch(signUrl, {
    method: 'POST',
    headers: getSupabaseHeaders('application/json'),
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 })
  });

  if (!signRes.ok) throw new Error(`Signing failed (${signRes.status})`);

  const signData = await signRes.json();
  const rawSignedPath = signData.signedURL || signData.signedUrl || '';
  const fullSignedUrl = rawSignedPath.startsWith('http')
    ? rawSignedPath
    : `${CONFIG.supabase.url}/storage/v1${rawSignedPath.startsWith('/') ? '' : '/'}${rawSignedPath}`;

  return { storagePath, signedUrl: fullSignedUrl };
}

async function airtableWriteWithAutoDrop(table, fields, recordId = null, attempt = 1) {
  const cleanFields = { ...fields };

  for (const [key, val] of Object.entries(cleanFields)) {
    if (Array.isArray(val) && val.length === 0) delete cleanFields[key];
    if (key === 'Completion %') delete cleanFields[key];
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
    const match = errorMsg.match(/(?:Unknown field name|Unknown field|Field|Column)\s*:?\s*["\\]+([^"\\]+)["\\]+/i) ||
                  errorMsg.match(/field\s*["\\]+([^"\\]+)["\\]+/i);
    if (match && match[1]) {
      delete cleanFields[match[1]];
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
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');
  const cleanDestination = isGroup ? toTarget.trim() : String(toTarget).replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanDestination,
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
      console.log(`🎾 [Joy Cannon] Dispatching Gate ${highestGate} to Client WhatsApp: ${clientGroup}`);
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

  if (targetSite) {
    await airtableWriteWithAutoDrop('Sites', {
      'Last Note': `Work Order #${activeTicket.fields['Assignment ID']} completed by ${workerName}: ${resolutionNotes}`,
      'Last Intent': 'WORK_ORDER_COMPLETED'
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
    `🟢 *Status:* Court Open for Play`;

  await sendWhatsAppMessage(dispatchTarget, voucherReceipt);
  return true;
}

// ====================================================================
// 12. NATURAL SPOKEN QUERY HANDLERS (LOCATION, WEATHER, STATUS, GATES)
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

  const siteName = targetSite.fields['Site Name'];
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

/**
 * ENTRY #088: Spoken Relational Ticket Cross-Referencing & Fleet Open-Issue Synthesis
 * Traverses memoryCache.sites to memoryCache.assignments to synthesize parent site
 * status with all active physical child work orders and commercial sales inquiries.
 */
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
  const lastNote = targetSite.fields['Last Note'] || 'No notes logged';

  // 1. Traverse memoryCache.assignments for all open tasks linked to this site
  const allOpenAssignments = await getCachedOpenAssignments();
  const linkedAssignments = allOpenAssignments.filter(record => {
    const s = record.fields['Sites'] || record.fields['Site'] || [];
    const siteIds = Array.isArray(s) ? s : [s];
    return siteIds.includes(siteId);
  });

  // 2. Partition physical field work orders from commercial inquiries & expenses
  const fieldTickets = linkedAssignments.filter(a => {
    const type = a.fields['Assignment Type'];
    return type !== 'Sales' && type !== 'Expense';
  });
  const salesLeads = linkedAssignments.filter(a => a.fields['Assignment Type'] === 'Sales');

  // 3. Assemble unified response card
  let responseCard = `🏟️ *${siteName.toUpperCase()} | ${isTicketOnly ? 'ACTIVE WORK ORDERS' : 'STATUS'}*\n━━━━━━━━━━━━━━━━━━━━\n`;

  if (!isTicketOnly) {
    responseCard += `• Mode: ${workflowMode}\n`;
    if (workflowMode === 'INSTALLATION') {
      responseCard += `• Gate: ${currentGate}\n`;
    }
    responseCard += `• Last Update: ${lastNote.slice(0, 100)}\n`;
    responseCard += `━━━━━━━━━━━━━━━━━━━━\n`;
  }

  // 4. Synthesize physical field tickets
  if (fieldTickets.length === 0) {
    responseCard += `✅ *Field Tickets:* No open work orders.\n`;
  } else {
    responseCard += `🛠️ *Open Field Tickets (${fieldTickets.length}):*\n`;
    fieldTickets.forEach(t => {
      const ticketNum = t.fields['Assignment ID'] ? `#${t.fields['Assignment ID']}` : 'WO';
      const priority = t.fields['Priority'] || 'Medium';
      
      // Resolve assigned workers
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

  // 5. Append commercial leads if present
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

// ====================================================================
// 13. CONVERSATIONAL TEXT & VOICE TRIAGE ENGINE
// ====================================================================

const INTENT_CLASSIFICATION_PROMPT = `
You are the Titan OS Ambient Intelligence Scribe & Operational Dispatcher for Bounce Padel.
Classify incoming spoken audio transcripts or text messages.

ROUTING INTENTS:
1. "LOCATION_QUERY": User is asking for the location, directions, pin, map, or address of a court (e.g. "Can you send the location for Levinsky?", "Where is Don Walker?", "Send me the pin for RCOR").
2. "WEATHER_QUERY": User is asking about weather, wind, rain, or site conditions (e.g. "What's the weather at Levinsky?", "Is it too windy for glass?").
3. "STATUS_QUERY": User is asking about general progress, gates, or status of a court (e.g. "What's the status of Mary's court?", "What gate are we on?").
4. "TICKET_QUERY": User is asking specifically about open tickets, support issues, work orders, chores, repairs, or pending tasks for a court (e.g. "Are there any open support tickets for Cynamon?", "What tickets are open for RCOR?", "Any chores for David?").
5. "READINESS_QUERY": User is asking if a court is ready to mobilize, foundation cured, or deposit received (e.g. "Is Levinsky ready to mobilize?").
6. "WORK_ORDER_CLOSEOUT": Spoken completion of a task/ticket.
7. "ACTIONABLE_STATE_CHANGE": Milestones reached, deposit received, concrete pour dates set.
8. "DARK_MATTER": Genuine jobsite notes (hardware delivered, GC delay, traffic notes).
9. "PURE_NOISE": Casual banter, greetings, emojis ("thanks", "ok", "coffee").

Extract "queried_court_name": string or null (e.g. "Levinsky", "Don Walker", "Mary", "RCOR", "Cynamon").

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "LOCATION_QUERY" | "WEATHER_QUERY" | "STATUS_QUERY" | "TICKET_QUERY" | "READINESS_QUERY" | "WORK_ORDER_CLOSEOUT" | "ACTIONABLE_STATE_CHANGE" | "DARK_MATTER" | "PURE_NOISE",
  "queried_court_name": "string or null",
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English or null",
  "dark_matter_category": "Logistics" | "Site Conditions" | "Hardware" | null,
  "distilled_context": "string or null",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | null,
  "gravity_score": integer | null,
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

async function triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity) {
  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  await Promise.all(uploadPromises);

  const triage = await triageSpokenOrTextNLP(null, true, items);
  if (!triage) return;

  console.log('[Voice Intent]:', { intent: triage.intent, querySite: triage.queried_court_name });

  if (triage.intent === 'PURE_NOISE') return;

  // New Site Provisioning Catch via Spoken Voice Memo
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
    }

    await airtableWriteWithAutoDrop('Sites', newRecordPayload);
    invalidateAirtableCache('sites');

    await sendWhatsAppMessage(dispatchTarget, `🏟️ *TITAN OS | NEW SITE CREATED*\n\n` +
      `• *Court:* ${newSiteName}\n` +
      (newRecordPayload['Site location'] ? `• *Coordinates:* ${newRecordPayload['Site location']}\n` : '') +
      `• *Mode:* PLANNING\n` +
      `• *Readiness:* HOLD: PRE-CON BLOCKED 🔴\n\n` +
      `📋 Queued for INOC to populate specs & deposit.`);
    return;
  }

  if (triage.intent === 'LOCATION_QUERY') {
    await handleSpokenLocationQuery(triage.queried_court_name, site, dispatchTarget);
    return;
  }

  if (triage.intent === 'WEATHER_QUERY') {
    await handleSpokenWeatherQuery(triage.queried_court_name, site, dispatchTarget);
    return;
  }

  if (triage.intent === 'STATUS_QUERY' || triage.intent === 'TICKET_QUERY') {
    await handleSpokenStatusQuery(triage.queried_court_name, site, dispatchTarget, triage.intent === 'TICKET_QUERY');
    return;
  }

  if (triage.intent === 'READINESS_QUERY') {
    await handleSpokenReadinessQuery(triage.queried_court_name, site, dispatchTarget);
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

  if (triage.intent === 'DARK_MATTER') {
    const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
    const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Fleet Operations';

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

    if (site && (triage.gravity_score >= 4 || triage.urgency === 'HIGH')) {
      await airtableWriteWithAutoDrop('Sites', {
        'Last Note': `[VOICE NOTE - ${triage.dark_matter_category}]: ${triage.distilled_context}`,
        'Last Intent': 'AMBIENT_ALERT'
      }, site.id);

      if (archivedRecord?.id) {
        const alertPrompt = `⚠️ *FIELD NOTE RECORDED*\n\n` +
          `*Site:* ${siteLabel}\n` +
          `*Observation:* "${triage.distilled_context}"\n\n` +
          `Want to convert this into an open dispatch ticket?`;

        const buttons = [{ id: `PROMOTE_VAULT_${archivedRecord.id}`, title: '📋 Create Ticket' }];
        await sendWhatsAppButtons(dispatchTarget, alertPrompt, buttons);
      }
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
Check silicone status on Gate 4 without treating it as a blocker.`;

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

  if (!hasVisualMedia) {
    await triageVoiceMemoBatch(items, cumulativeContext, worker, site, fromPhone, dispatchTarget, senderSource, callerIdentity);
    return;
  }

  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  const storageResults = await Promise.all(uploadPromises);

  // STAGE 0: RECEIPT TRIAGE
  if (!hasVideo) {
    const visualTriage = await classifyVisualMediaIntent(items);
    if (visualTriage.media_category === 'FINANCIAL_RECEIPT') {
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
      return;
    }

    if (visualTriage.media_category === 'IRRELEVANT_NOISE') {
      await sendWhatsAppMessage(dispatchTarget, `ℹ️ *TITAN OS | PHOTO LOGGED*\nPhoto saved, but no padel court milestone or receipt detected.`);
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

  let targetedSite = site;
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

  // Proactive Weather Scan
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

  // PIPELINE A: INSTALLATION MILESTONE ENGINE (8-GATES)
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
    const isNewMilestone = highestGate > 0 && !previouslyCleared.includes(`Gate ${highestGate}`);

    const newlyVerifiedGates = (forensicAudit.verified_gates || []).map(g => {
      const num = parseInt(String(g).replace(/\D/g, ''));
      return isNaN(num) ? String(g) : `Gate ${num}`;
    });

    if (highestGate > 0) {
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
        'Last Intent': 'MILESTONE_PROGRESS'
      };

      if (highestGate >= TOTAL_GATES) {
        updatePayload['Workflow Mode'] = 'MAINTENANCE';
        updatePayload['Site Status'] = 'ACTIVE';
      }

      await airtableWriteWithAutoDrop('Sites', updatePayload, targetedSite.id);

      // Fire Joy Cannon once whenever a new milestone is reached
      if (isNewMilestone) {
        console.log(`🎾 [Joy Cannon Triggered] Firing Gate ${highestGate} for ${courtLabel}`);
        await fireInstallationJoyCannon(targetedSite, highestGate);
      }
    }

    let installCard = `🏗️ *TITAN OS | MILESTONE VERIFIED*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏟️ *Court:* ${courtLabel}\n` +
      `👤 *Lead:* ${workerName}\n` +
      `📊 *Progress:* ${Math.round(progressPercent * 100)}% (${gateLabel})\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👁️ *Observation:*\n${cleanSummary}\n` +
      (siliconeStatusText ? `${siliconeStatusText}\n` : '');

    if (weatherTripwires.summaryText) {
      installCard += `\n📋 *Weather Telemetry:*${weatherTripwires.summaryText}\n`;
    }

    installCard += `\n✅ *Progress updated in Sites ledger.*`;

    await sendWhatsAppMessage(dispatchTarget, installCard);
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
// 14. INGRESS DISPATCH CONTROLLER
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

    // INTERACTIVE BUTTON TAPS
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

          if (item.site_id) assignmentPayload['Sites'] = [item.site_id];
          const created = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
          const ticketId = created?.fields?.['Assignment ID'] ? `#${created.fields['Assignment ID']}` : 'NEW';

          await dispatchReply(`📋 *Ticket ${ticketId} Created*\nNote added to Daily Assignments for ${item.site_name}.`);
          return;
        }
      }
      return;
    }

    // LOCATION PIN-DROP (PROACTIVE ARRIVAL WEATHER SCAN & NEW SITE STAGING)
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

    // TEXT & SPOKEN CONVERSATIONAL DISPATCH
    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const explicitIntent = COMMAND_MAP[trigger.toLowerCase()];

      // New Site Provisioning Catch via Text
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
        }

        await airtableWriteWithAutoDrop('Sites', newRecordPayload);
        invalidateAirtableCache('sites');

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
        await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': groupJid || fromPhone }, targetSite.id);
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
        await handleSpokenStatusQuery(args.join(' '), site, dispatchTarget, explicitIntent === 'TICKET_QUERY');
        return;
      }

      if (explicitIntent === 'READINESS_GATE_CHECK') {
        await handleSpokenReadinessQuery(args.join(' '), site, dispatchTarget);
        return;
      }

      if (explicitIntent === 'HELP') {
        await dispatchReply(`🤖 *TITAN OS COMMANDS*\n\n` +
          `• Ask naturally via voice note or text:\n` +
          `  _"Where is Levinsky?"_ (returns pin & directions)\n` +
          `  _"What's the weather at RCOR?"_ (returns tripwires & wind holds)\n` +
          `  _"What gate is Don Walker on?"_\n` +
          `  _"Any open tickets for Cynamon?"_ (returns active work orders & leads)\n` +
          `• Send photo of receipt -> Instant QuickBooks sync\n` +
          `• Send video walkaround -> Instant milestone progression\n` +
          `• Drop a pin and text _"Create new site Burk"_ -> Auto-provisions in Airtable`);
        return;
      }

      // Natural language conversational text classification
      if (rawText.length > 2) {
        const nlp = await triageSpokenOrTextNLP(rawText, false);
        if (nlp) {
          if (nlp.intent === 'LOCATION_QUERY') {
            await handleSpokenLocationQuery(nlp.queried_court_name, site, dispatchTarget);
            return;
          }
          if (nlp.intent === 'WEATHER_QUERY') {
            await handleSpokenWeatherQuery(nlp.queried_court_name, site, dispatchTarget);
            return;
          }
          if (nlp.intent === 'STATUS_QUERY' || nlp.intent === 'TICKET_QUERY') {
            await handleSpokenStatusQuery(nlp.queried_court_name, site, dispatchTarget, nlp.intent === 'TICKET_QUERY');
            return;
          }
          if (nlp.intent === 'READINESS_QUERY') {
            await handleSpokenReadinessQuery(nlp.queried_court_name, site, dispatchTarget);
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
          if (nlp.intent === 'DARK_MATTER') {
            const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
            const siteLabel = site?.fields?.['Site Name'] || nlp.matched_site_name || 'Fleet Operations';
            await streamToDarkMatterVault({
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
            return;
          }
        }
      }
      return;
    }

    // MULTIMODAL INGESTION (IMAGES, VIDEOS, AUDIO)
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || '';

    sendWhatsAppReaction(dispatchTarget, messageId, isAudio ? '🎧' : (isVideo ? '🎥' : '🧾')).catch(() => {});

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
// 15. GAMECAM 4K COURT HEALTH WEBHOOK
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

// ====================================================================
// 16. HEALTH & RUNTIME
// ====================================================================

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

      // Twin-Court Pin Nudging: offset longitude by ~15m if coordinates collide
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
    version: '5.3.5',
    engine: 'Titan OS V5.3.5 (Silent Expense Ghost Routing & Resilient Meta Dispatch + ENTRY #088)'
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V5.3.5 RUNNING ON PORT ${PORT}`);
  console.log(`🧾 EXPENSE GHOSTING: Auto-Complete & Filtered from Active Dispatch Active`);
  console.log(`📡 RESILIENT DISPATCH: Auto-Retry on Meta Timeout Active`);
  console.log(`📍 ZERO-TOUCH PROVISIONING: Drop a Pin & Say 'Create New Site' Active`);
  console.log(`🎾 OPEN FOR PLAY: Readiness Gate Overrides Active`);
  console.log(`🎉 JOY CANNON: Direct Milestone Advancement & Number Sanitizer Active`);
  console.log(`🌤️ PROACTIVE WEATHER ENGINE: Wind, Cold Glue (<10°C), Moisture & Heat Active`);
  console.log(`📍 GOOGLE GEO ENTERPRISE: Geocoding, Driving, Satellite & Twin Nudging Active`);
  console.log(`🗣️ SPOKEN LOOKUPS & ENTRY #088: Relational Ticket Synthesis Active`);
  console.log(`🏗️ 8-GATE FIELD RUBRIC: Single-Court Evaluation Active`);
  console.log(`====================================================================`);

  try {
    await getCachedSites();
    await getCachedWorkers();
    await getCachedContacts();
    await getCachedOpenAssignments();
  } catch (err) {}
});

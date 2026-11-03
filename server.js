/**
 * TITAN OS V6.0.19 — HEADLESS ERP & CONVERSATIONAL DATABASE ADMIN
 * Model: Gemini 2.5 Pro
 * 
 * 44. Executive Maintenance Ticket Rollups
 * 45. Terminology scrub (Fleet/Global -> Maintenance/All) & UTC to EST Timezone Lock
 * 46. INOC Nomenclature Sync (Nominal -> Operational)
 * 47. Technical Oracle RAG Engine (Autonomous PDF Ingestion)
 * 48. Autonomous Bulk Site Creation via Multimodal NLP (CREATE_SITES)
 * 49. Complete Turf Supplier Taxonomy Alignment
 * 50. Autonomous Bulk State Mutation (Multi-Site ACTIONABLE_STATE_CHANGE)
 * 51. INOC Financial Dropdown Integration
 * 52. The Blameless Machine (Production Feedback Loop) & 9-Gate Expansion
 * 53. Relational Ticket Cross-Referencing & Kanban Status Transitions
 * 54. Auto-Healer Null Payload Catch & Unified Bulk BOM Reservation Loop
 * 55. BPC-Exclusive Inventory Burn
 * 56. Global Oracle Document Dispatch
 * 57. Role-Based Access Control (RBAC) & Dynamic Help Menu
 * 58. Frictionless Sales Pipeline (Strict Assignment Mapping, No Phantom Sites)
 * 59. Gmail Inbound Monitor, Single-Ticket CRM Logging & AI Actionability Filter
 * 60. Rob Wharton Executive Pipeline & /estimate /invoice Quick Commands
 * 61. Hardened CREATE_SITES Entity Extraction & Schema Mapping
 * 62. Autonomous Multimodal Inventory Count Engine & Dynamic Role-Based /help
 * 63. Intelligent Maintenance Routing & Expanded Universal Help Directory
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {}

const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

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
    apiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEO_KEY,
    gmailClientId: process.env.GMAIL_CLIENT_ID,
    gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
    gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN
  }
};

const supabase = createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.serviceRoleKey,
  { auth: { persistSession: false } }
);

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;

const lastDroppedCoordinates = new Map();
const userActiveSiteMap = new Map(); 
const dailyEasterEggTracker = new Map(); 

let oracleFileURIs = [];
let robExecEnabled = false;
const ROB_WHARTON_PHONE = '13435405666';

// ====================================================================
// 1A. GLOBAL PROMPTS & CONSTANTS
// ====================================================================
const GATE_NAMES = {
  1: 'Foundation & Slab',
  2: 'Steel Frame',
  3: 'Mesh Panels',
  4: 'Glass Installed',
  5: 'Turf Laid',
  6: 'Sand Infill',
  7: 'Net & Posts',
  8: 'Clean & Handover',
  9: 'Lead installer final sign off'
};
const TOTAL_GATES = 9;

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
  '/l': 'EXPLICIT_LINK',
  '/link': 'EXPLICIT_LINK',
  '/map': 'LOCATION',
  '/loc': 'LOCATION',
  '/location': 'LOCATION',
  '/gps': 'LOCATION',
  '/g': 'READINESS_GATE_CHECK',
  '/gate': 'READINESS_GATE_CHECK',
  '/r': 'READINESS_GATE_CHECK',
  '/readiness': 'READINESS_GATE_CHECK',
  '/video': 'MEDIA_RETRIEVAL',
  '/media': 'MEDIA_RETRIEVAL',
  '/ar': 'AR_LOOKUP', 
  '/invoice': 'INVOICE_APPROVAL',
  '/estimate': 'INVOICE_APPROVAL',
  '/specs': 'TECH_SPECS',
  '/border': 'BORDER_CLEARANCE',
  '/carm': 'BORDER_CLEARANCE',
  '/inv': 'INVENTORY_QUERY',
  '/inventory': 'INVENTORY_QUERY',
  '/stock': 'INVENTORY_QUERY',
  '/count': 'INVENTORY_COUNT',
  '/docs': 'DOCUMENT_RETRIEVAL',
  '/plan': 'DOCUMENT_RETRIEVAL',
  '/plans': 'DOCUMENT_RETRIEVAL',
  '/help': 'HELP',
  '/?': 'HELP',
  '/new': 'NEW_SITE_TEMPLATE',
  '/exec': 'EXECUTIVE_MODE_TOGGLE',
  '/route': 'ROUTING'
};

const VISUAL_TRIAGE_PROMPT = `
You are the Titan OS Universal Visual Triage Engine for Bounce Padel.
Analyze the provided image(s) or video frames to classify the primary operational subject.

CATEGORIES:
1. "FINANCIAL_RECEIPT": Store receipts (Home Depot, Lowe's, fuel, Fastenal, restaurants, lumber, supplies, equipment rental), invoices, register slips.
2. "COMMERCIAL_LEAD": Screenshots of emails, text messages, quote inquiries, client forwards, RFPs, business cards, or partner forwards (Mondo, club developers).
3. "COURT_FACILITY": Padel court construction, court maintenance, turf, glass, mesh, frame, net, concrete pad, or sports facility walkaround.
4. "FREIGHT_LOGISTICS": Wooden crates, pallets, glass shipping A-frames, shipping bills of lading (BOL), delivery trucks, flatbed offloading, shipping containers, inventory logs.
5. "IRRELEVANT_NOISE": Personal selfies, casual non-work objects, pet photos, random memes with no business context.
6. "INVENTORY_COUNT": Handwritten inventory tally sheets, stockroom clipboards, or digital warehouse counting lists showing asset quantities.

OUTPUT FORMAT (JSON ONLY):
{
  "media_category": "FINANCIAL_RECEIPT" | "COMMERCIAL_LEAD" | "COURT_FACILITY" | "FREIGHT_LOGISTICS" | "INVENTORY_COUNT" | "IRRELEVANT_NOISE",
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
  "receipts": [
    {
      "vendor": "string",
      "total_amount": number,
      "category": "string",
      "items_summary": "string",
      "date": "string"
    }
  ],
  "inventory_counts": [
    {
      "item_name": "string",
      "new_quantity": number
    }
  ]
}
`;

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine for Bounce Padel.

SINGLE-COURT EVALUATION MANDATE:
Evaluate strictly the single primary court in the foreground being inspected.
DO NOT evaluate background courts or adjacent courts. Disregard courts seen in the distance.

PADEL COURT 9-GATE PHYSICAL CONSTRUCTION RUBRIC (SUPER PANORAMIC SPEC):
When inspecting video frames, visually identify completed physical stages:
- Gate 1: "Foundation & Slab" (Cured concrete pad, existing sport court, or existing tennis foundation)
- Gate 2: "Steel Frame" (Vertical steel posts and perimeter frame beams bolted upright. NOTE: Super Panoramic courts do NOT have corner posts)
- Gate 3: "Mesh Panels" (Lower and upper wire mesh fencing panels bolted to steel posts)
- Gate 4: "Glass Installed" (Tempered glass panels mounted and secured via glass tabs. NOTE: Do not look for frame channels)
- Gate 5: "Turf Laid" (Synthetic turf rolled out, seamed, glued, and white regulation boundary lines cut in. Turf can be ANY color)
- Gate 6: "Sand Infill" (Silica sand distributed and brushed evenly across turf carpet fibers)
- Gate 7: "Net & Posts" (Center net posts mounted, regulation net installed and tensioned)
- Gate 8: "Clean & Handover" (STRICT: Construction tools, trash, and active debris MUST be entirely cleared. Court must be pristine and ready for tournament play).
- Gate 9: "Lead installer final sign off" (Only verify if explicitly spoken by the installer on camera).

FRICTIONLESS PROGRESSION & PUNCH LIST QA:
- Job sites operate in parallel. If multiple physical gates are happening at once (e.g. turf and nets), list ALL of them in the "in_progress_gates" array.
- Evaluate the qa_checklist items (bolts, entrance plates, bolt caps, silicone, doors, jobsite cleanliness).
- CRITICAL: Pending cosmetic or hardware punch list items (missing bolt caps, entrance plates, or pending cleanup) ARE NOT blocking gates. Allow milestone progression to advance based on physical construction gates even if punch list items remain pending.

SPECIFIC QUALITY AUDIT CHECKS:
- "entrance_plates_installed": Look ONLY at the bottom threshold of the door openings for "Bounce Padel Courts" branded plates. Do NOT confuse with corner plates.
- "anchor_bolts_fully_installed": Look closely at the square green base plates at the bottom of the structural columns holding up the glass and mesh. If the holes are empty, anchor bolts are pending.
- "black_bolt_caps_installed": Look at the bolts holding the green steel frame together. Do they have black plastic caps covering them?
- "silicone_sealant_applied": Is there visible silicone along the glass panel joints?
- "doors_oriented_correctly": Check door orientations. Doors must be RIGHT and RIGHT (not left and right). If a left door is installed, flag it.
- "jobsite_is_clean": Are there tools, debris, cords, or ladders left on the court? (If yes, this is false).

SMART VERBATIM: Purge all speech hesitations ("uh", "um", stutters). Disregard ambient jobsite noise.

COLLABORATIVE TONE DIRECTIVE:
Never shame the installers. Do not use dictatorial terms like "ACTION REQUIRED", "FAIL", "MISSING", or "Address immediately". 
Use supportive, professional terms like "Pending", "To-Do", "Awaiting", or "Punch list". Ensure the "whatsapp_status_text" observation is friendly and collaborative.

OUTPUT SPECIFICATION (JSON ONLY):
Write the "whatsapp_status_text" receipt card strictly in the designated TARGET_LANGUAGE provided in the audit context. All other JSON fields MUST remain strictly in English for the HQ database.
{
  "qa_checklist": {
    "entrance_plates_installed": boolean,
    "anchor_bolts_fully_installed": boolean,
    "black_bolt_caps_installed": boolean,
    "silicone_sealant_applied": boolean,
    "doors_oriented_correctly": boolean,
    "jobsite_is_clean": boolean
  },
  "transcript_en": "Clean polished English transcript or visual scene summary",
  "transcript_es": "Transcripción limpia o resumen visual profesional en español",
  "spoken_court_name": "string or null",
  "spoken_ticket_id": integer or null,
  "video_phase": "INSTALLATION_SWEEP" | "INTAKE_BASELINE" | "COMPLETION_CLOSEOUT" | "GENERAL_AUDIT",
  "verified_gates": [1, 2, 3],
  "in_progress_gates": [4, 5],
  "highest_gate": 5,
  "defect_origin": "FABRICATION" | "SITE_CONDITION" | "TRANSIT_DAMAGE" | null,
  "qa_component": "TABS" | "POSTS" | "MESH" | "GLASS" | "HARDWARE" | "DOORS" | null,
  "blockers_detected": ["Specific impediment, dimensional error, or pending hardware in English"],
  "work_verified": ["Specific verified stage completed in English"],
  "status_observed": "MILESTONE_PROGRESS" | "ACTION_REQUIRED" | "COMMISSIONED" | "OPERATIONAL",
  "site_conditions": "Short string in English",
  "action_items": ["Pending black bolt caps", "Pending entrance plates", "Silicone pending", "Swap left door for right door"],
  "summary": "1-2 sentence concise executive summary of visible court progress or defect",
  "whatsapp_status_text": "Plaintext friendly observation"
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance & VIP Field Concierge Engine.

CRITICAL DIRECTIVE:
1. "SMART VERBATIM": Purge speech hesitations ("uh", "ah", "um").
2. DUAL-TRACK BILINGUAL OUTPUT: Provide both transcript_en and transcript_es.

OUTPUT SPECIFICATION (JSON ONLY):
Write the "whatsapp_status_text" receipt card strictly in the designated TARGET_LANGUAGE provided in the audit context. All other JSON fields (summary, blockers, action_items) MUST remain strictly in English for the HQ database.
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
  "status_observed": "OPERATIONAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item in English"],
  "site_conditions": "Short string in English",
  "worker_summary": "1-2 sentence executive summary in English",
  "whatsapp_status_text": "Plaintext friendly observation"
}
`;

const INTENT_CLASSIFICATION_PROMPT = `
You are the Titan OS Ambient Intelligence Scribe & Operational Dispatcher for Bounce Padel.
Classify incoming spoken audio transcripts or text messages.

ROUTING INTENTS:
1. "LOCATION_QUERY": User is asking for the location, directions, pin, map, or address of a court.
2. "WEATHER_QUERY": User is asking about weather, wind, rain, or site conditions.
3. "STATUS_QUERY": User is asking about general progress, gates, or status of a court.
4. "TICKET_QUERY": User is asking specifically about open tickets, support issues, work orders, chores, repairs, or pending tasks.
5. "READINESS_QUERY": User is asking if a court is ready to mobilize, foundation cured, or deposit received.
6. "WORK_ORDER_CLOSEOUT": Spoken completion of a task/ticket.
7. "TICKET_UPDATE": User is providing a status update, note, pasting an email response to a prospect, or asking to reassign, move, or allocate an active ticket/chore/supply request to a different site or worker, OR explicitly change a ticket's status (e.g., "Starting work", "Paused", "Cancelled").
8. "ACTIONABLE_STATE_CHANGE": Specific commands to update database fields on existing Sites (deposit status, slab dates, crews, site status, foundation type, steel color, turf color, turf supplier, year installed, model type, glass thickness, light presence).
9. "DARK_MATTER": Genuine jobsite notes (hardware delivered, GC delay, traffic notes, logistical reminders, supplier updates).
10. "PURE_NOISE": Casual banter, greetings, emojis ("thanks", "ok", "coffee").
11. "SUPPLY_REQUEST": Installer or field crew requesting missing parts, hardware, tools, or supplies.
12. "FREIGHT_UPDATE": Driver or warehouse staff providing transit updates, crate counts, or BOL arrivals.
13. "HISTORICAL_REFERENCE": User is sharing an old photo, throwback, or past memory. Disregard physical evaluation.
14. "MEDIA_RETRIEVAL": User is asking to see, view, or retrieve the latest video walkthrough, photo, or media for a specific site/court.
15. "AR_LOOKUP": User is asking about outstanding balances, what someone owes, or payment status.
16. "INVOICE_APPROVAL": User is commanding to send an invoice, convert an estimate, or bill a client based on an existing estimate.
17. "CREATE_INVOICE": User is commanding to create a brand new invoice from scratch for an existing client.
18. "COURT_SPECS_QUERY": User is asking about the physical specifications, colors, materials, year, model/court type, or suppliers of a specific court.
19. "MAINTENANCE_QUERY": User is specifically asking to see open maintenance tickets, repair tasks, or service calls across the network.
20. "ASSET_TRANSFER": User is moving, staging, dropping off, or assigning equipment/tools (e.g. hilti, suction cups, laser level) to a site.
21. "ASSET_QUERY": User is asking where a specific tool, asset, or piece of equipment is currently located.
22. "INVENTORY_QUERY": User is asking about warehouse inventory levels, stock on hand, available turf, glass, steel, fasteners, or reorder status.
23. "DOCUMENT_RETRIEVAL": User is asking to retrieve, download, or get technical documents, foundation plans, brochures, blueprints, or CAD files for a specific site or generally.
24. "ORACLE_QUERY": User is asking a deep technical, engineering, structural, foundation, glass specification, or dimension question that requires reading proprietary blueprints, manuals, or engineering files.
25. "CREATE_SITES": User is requesting to create entirely NEW sites/courts. Extract the exact list of new court names into the "target_site_names" array, along with any provided construction specifications to apply across all of them.
26. "INVENTORY_COUNT": User is reporting a physical inventory count of items/SKUs via voice, text, or tally sheet. Extract the item name and the quantity.

Extract:
"queried_court_name": string or null,
"matched_site_name": string or null,
"target_site_names": ["string"] or [],
"ticket_id": integer or null,
"referenced_ticket_id": integer or null,
"referenced_entity_name": string or null,
"reassign_site_name": string or null,
"assign_worker_name": string or null,
"ticket_status_update": "Open" | "In Progress" | "Complete" | "Paused" | "Cancelled" | null,
"update_note": string or null,
"freight_bol": string or null,
"freight_integer_count": number or null,
"freight_status": "In Transit" | "Delivered" | "Damaged" | null,
"requested_items": "string describing what is missing or needed or null",
"qbo_estimate_number": string or null,
"qbo_invoice_percentage": number or null,
"qbo_customer_name": string or null,
"qbo_amount": number or null,
"qbo_line_items": string or null,
"asset_name": "string (the tool or equipment) or null",
"a_frames_retrieved": boolean,

DATABASE FIELD MAPPING OVERRIDES:
"workflow_mode": "INSTALLATION" | "MAINTENANCE" | "SPOT_VISIT" | "EXECUTIVE" | "PRODUCTION" | "LOGISTICS" | "INVENTORY" | "PLANNING" | null
"site_status_update": "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETE" | "BLOCKED_WEATHER" | "BLOCKED_PARTS" | "END_OF_DAY" | "OPEN_FOR_PLAY" | "WINTERIZED_CLOSED" | "UNDER_MAINTENANCE" | "IN_CONSTRUCTION" | "Materials Staged" | null
"deposit_status": "Pending Deposit" | "40% Delivery Payment" | "50% Deposit Received" | "10% Final Payment" | "Paid in Full" | "40% Deposit Reeeived" | null
"foundation_type": "Poured Concrete Slab" | "Existing Tennis Conversion" | "Indoor Commercial Slab" | "Post-Tensioned Slab" | null
"slab_pour_date": "YYYY-MM-DD" | null
"assigned_crew": "Team Alpha" | "Team Beta" | "Logistics" | "Unassigned" | null
"manufacturer": "BPC" | "Mejor Set" | "AFP" | "Chinese" | "Padel Tech" | "Spanish" | null
"steel_color": "Black" | "Pearl Mouse" | "Blue" | "Green" | null
"turf_color": "Blue" | "Green" | "Terracotta" | "Black" | "Red" | null
"turf_supplier": "Real Turf" | "Mondo" | "House" | "Padel Magic" | "Other" | null
"year_installed": number | null
"model_type": "Standard" | "Hurricane" | "Indoor" | "Outdoor Super Panoramic" | "Indoor Super Panoramic" | "Hurricane Super Panoramic" | "Pickleball" | "Sport Court" | "Decorative" | null
"glass_thickness": "10mm" | "12mm" | null
"light_presence": "Yes" | "No" | null

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "LOCATION_QUERY" | "WEATHER_QUERY" | "STATUS_QUERY" | "TICKET_QUERY" | "READINESS_QUERY" | "WORK_ORDER_CLOSEOUT" | "TICKET_UPDATE" | "ACTIONABLE_STATE_CHANGE" | "DARK_MATTER" | "PURE_NOISE" | "FREIGHT_UPDATE" | "SUPPLY_REQUEST" | "HISTORICAL_REFERENCE" | "MEDIA_RETRIEVAL" | "AR_LOOKUP" | "INVOICE_APPROVAL" | "CREATE_INVOICE" | "COURT_SPECS_QUERY" | "ASSET_TRANSFER" | "ASSET_QUERY" | "INVENTORY_QUERY" | "DOCUMENT_RETRIEVAL" | "MAINTENANCE_QUERY" | "ORACLE_QUERY" | "CREATE_SITES" | "INVENTORY_COUNT",
  "queried_court_name": "string or null",
  "matched_site_name": "string or null",
  "target_site_names": ["string"],
  "ticket_id": integer or null,
  "referenced_ticket_id": integer or null,
  "referenced_entity_name": "string or null",
  "reassign_site_name": "string or null",
  "assign_worker_name": "string or null",
  "ticket_status_update": "string or null",
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
  "asset_name": "string or null",
  "a_frames_retrieved": boolean,
  "workflow_mode": "string or null",
  "site_status_update": "string or null",
  "deposit_status": "string or null",
  "foundation_type": "string or null",
  "slab_pour_date": "string or null",
  "assigned_crew": "string or null",
  "manufacturer": "string or null",
  "steel_color": "string or null",
  "turf_color": "string or null",
  "turf_supplier": "string or null",
  "year_installed": number | null,
  "model_type": "string or null",
  "glass_thickness": "string or null",
  "light_presence": "string or null",
  "transcript_en": "Clean English transcript",
  "transcript_es": "Clean Spanish transcript",
  "inventory_counts": [
    {
      "item_name": "string",
      "new_quantity": number
    }
  ]
}
`;

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
    console.log(`[Cache Engine] Refreshed ${memoryCache.assignments.length} Open Assignments into RAM`);
    return memoryCache.assignments;
  } catch (err) {
    console.warn('[Cache Engine] Assignments refresh failed:', err.message);
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
// 1B. ROLE-BASED ACCESS CONTROL (RBAC) & CRON JOBS
// ====================================================================
function isAuthorizedForFinance(callerIdentity) {
  const role = String(callerIdentity.role || '').toLowerCase();
  return role.includes('finance') || role.includes('executive') || role.includes('admin') || role.includes('management');
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
        headers: getSupabaseHeaders('application/json')
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
              
  const execPhones = '14379287172, 13435405666';
  await fanOutToSubscribers(execPhones, msg);
}

// ====================================================================
// 2A. DATABASE WRITE & AUTO-HEALER (AIRTABLE) + MEDIA UPLOAD (SUPABASE)
// ====================================================================

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
  
  try {
    const { data, error } = await supabase.storage
      .from(CONFIG.supabase.bucket)
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`[Supabase Upload Error]: ${error.message}`);
      return { storagePath: null, signedUrl: null };
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(CONFIG.supabase.bucket)
      .createSignedUrl(filename, 604800);

    if (signError) {
      console.error(`[Supabase Sign Error]: ${signError.message}`);
      return { storagePath: null, signedUrl: null };
    }

    return { storagePath: filename, signedUrl: signedData.signedUrl };
  } catch (err) {
    console.error('[Supabase Upload Exception]:', err.message);
    return { storagePath: null, signedUrl: null };
  }
}

// ====================================================================
// 2B. QUICKBOOKS ONLINE REST API WRAPPER WITH TOKEN ROTATION
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
      if (data.refresh_token) {
        process.env.QBO_REFRESH_TOKEN = data.refresh_token;
      }
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
// 2D. GMAIL REST API ENGINE (OAUTH2 REFRESH & MESSAGE DISPATCH)
// ====================================================================

const userPendingEmailMap = new Map();

async function getGmailAccessToken() {
  if (!CONFIG.google.gmailClientId || !CONFIG.google.gmailRefreshToken) {
    console.error('[Gmail Engine] Missing Gmail OAuth credentials in CONFIG.');
    return null;
  }
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CONFIG.google.gmailClientId,
        client_secret: CONFIG.google.gmailClientSecret,
        refresh_token: CONFIG.google.gmailRefreshToken,
        grant_type: 'refresh_token'
      })
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error('[Gmail Engine] Access token refresh failed:', err.message);
    return null;
  }
}

async function fetchLatestInboundEmail() {
  const token = await getGmailAccessToken();
  if (!token) return null;

  try {
    const query = encodeURIComponent('is:unread newer_than:1h -category:promotions -category:social');
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) return null;

    const msgId = listData.messages[0].id;
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const msg = await msgRes.json();

    const headers = msg.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const messageIdHeader = getHeader('Message-ID');

    let bodyText = '';
    if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain') || msg.payload.parts[0];
      if (textPart?.body?.data) {
        bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
      }
    } else if (msg.payload?.body?.data) {
      bodyText = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
    }

    bodyText = bodyText.replace(/---------- Forwarded message ---------[\s\S]*?(Subject:|To:|Date:|From:).*?\n/gi, '').trim();
    bodyText = bodyText.replace(/On .*? wrote:\s*>?/gi, '').trim();

    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
    });

    return {
      id: msgId,
      threadId: msg.threadId,
      from,
      to,
      subject,
      messageIdHeader,
      snippet: msg.snippet,
      body: bodyText.slice(0, 1500)
    };
  } catch (err) {
    console.error('[Gmail Engine] Inbound email fetch failed:', err.message);
    return null;
  }
}

async function sendGmailReply({ to, fromAlias, subject, body, threadId, inReplyTo }) {
  const token = await getGmailAccessToken();
  if (!token) return false;

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    `From: ${fromAlias}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit'
  ];

  if (inReplyTo) messageParts.push(`In-Reply-To: ${inReplyTo}`);
  if (threadId) messageParts.push(`References: ${inReplyTo || threadId}`);

  messageParts.push('', body);

  const rawMessage = Buffer.from(messageParts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payload = { raw: rawMessage };
  if (threadId) payload.threadId = threadId;

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.error('[Gmail Outbound] Send failed:', err.message);
    return false;
  }
}

async function evaluateEmailActionability(subject, body) {
  const prompt = `You are the Titan OS Executive Inbox Filter for Bounce Padel. 
  Your job is to keep the WhatsApp dispatch strictly focused on "action and immediacy" (communication, predictability, compliance).
  
  Evaluate this email. DOES IT REQUIRE AN ACTION OR RESPONSE FROM THE BUSINESS OWNER?
  - TRUE (Actionable): Inquiries for courts/pricing from actual prospects, requests for foundation plans, technical questions, scheduling requests, client support needs, or direct task asks.
  - FALSE (Noise): B2B sales pitches, vendor solicitations, SEO/marketing agency outreach, software demos, real estate listings, newsletters, automated system alerts (e.g., Airtable, QuickBooks), generic CC'd chatter, spam, "Thank you" wrap-ups, or pure FYIs with no ask.
  
  CRITICAL: If the email appears to be someone trying to sell YOU a service, product, or scheduling a "quick call" for their own gain, you MUST mark it FALSE.
  
  Respond strictly with JSON: {"is_actionable": boolean, "reason": "short explanation"}
  
  Subject: "${subject}"
  Body: "${(body || '').slice(0, 1000)}"`;
  
  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
    };
    const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Email Filter Error]:', err.message);
    return { is_actionable: true, reason: 'Error fallback' }; 
  }
}

// ====================================================================
// 2C. TECHNICAL ORACLE RAG ENGINE (PDF AUTO-INGESTION & RAG)
// ====================================================================

async function syncOracleDocs() {
  try {
    console.log('[Oracle Engine] Commencing synchronization with Airtable Knowledge Base...');
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Oracle%20Docs?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) {
       console.warn(`[Oracle Engine] Table "Oracle Docs" returned HTTP ${res.status}. Skipping.`);
       return;
    }
    const data = await res.json();
    const records = data.records || [];
    
    let newUris = [];
    for (const rec of records) {
       const attachments = rec.fields['Attachments'] || rec.fields['Attachment'] || rec.fields['Document'] || [];
       const docTitle = rec.fields['Name'] || rec.fields['Title'] || 'Technical Document';
       
       if (!Array.isArray(attachments) || attachments.length === 0) continue;

       for (const att of attachments) {
          const downloadUrl = att.url;
          const fileName = att.filename || 'manual.pdf';

          if (downloadUrl && (downloadUrl.toLowerCase().includes('.pdf') || fileName.toLowerCase().endsWith('.pdf'))) {
             try {
               const pdfRes = await fetch(downloadUrl);
               if (!pdfRes.ok) {
                 console.warn(`[Oracle Engine] Failed to fetch PDF (${pdfRes.status}) for ${docTitle}`);
                 continue;
               }
               const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
               
               const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${CONFIG.gemini.apiKey}`, {
                  method: 'POST',
                  headers: {
                      'X-Goog-Upload-Protocol': 'raw',
                      'X-Goog-Upload-Command': 'start, upload, finalize',
                      'X-Goog-Upload-Header-Content-Length': pdfBuffer.length,
                      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
                      'Content-Type': 'application/pdf'
                  },
                  body: pdfBuffer
               });
               
               if (!uploadRes.ok) {
                 const errTxt = await uploadRes.text();
                 console.error(`[Oracle Engine] Gemini File API upload error for ${docTitle}:`, errTxt);
                 continue;
               }

               const uploadData = await uploadRes.json();
               if (uploadData.file && uploadData.file.uri) {
                  newUris.push({
                    uri: uploadData.file.uri,
                    title: docTitle,
                    filename: fileName,
                    downloadUrl: downloadUrl
                  });
                  console.log(`[Oracle Engine] Successfully ingested: "${docTitle}" (${fileName})`);
               }
             } catch (fetchErr) {
               console.error(`[Oracle Engine] Exception streaming ${docTitle}:`, fetchErr.message);
             }
          }
       }
    }

    oracleFileURIs = newUris;
    console.log(`[Oracle Engine] Sync complete. ${oracleFileURIs.length} technical documents active in AI memory.`);
  } catch (e) {
    console.error('[Oracle Engine] Sync failed:', e.message);
  }
}

setInterval(syncOracleDocs, 24 * 60 * 60 * 1000);

async function handleOracleQuery(nlp, dispatchTarget) {
  if (!oracleFileURIs || oracleFileURIs.length === 0) {
     await sendWhatsAppMessage(
       dispatchTarget, 
       `⚠️ *TITAN OS | TECHNICAL ORACLE*\n━━━━━━━━━━━━━━━━━━━━\nThe Oracle is currently empty or syncing.\n\nPlease upload foundation plans or technical PDFs into the *Attachments* column of the "Oracle Docs" Airtable table.`
     );
     return;
  }
  
  const parts = oracleFileURIs.map(item => ({ 
    file_data: { 
      mime_type: 'application/pdf', 
      file_uri: item.uri 
    } 
  }));

  const userQuery = nlp.transcript_en || nlp.update_note || 'Explain structural specifications.';
  parts.push({ 
    text: `You are the Titan OS Technical Oracle for Bounce Padel court installations. 
Answer the following engineering, foundation, or structural question based STRICTLY on the attached proprietary PDF documents. 
If the answer cannot be verified within the documents, state that clearly without guessing.
Use clean, concise, field-friendly WhatsApp markdown formatting with bullet points.

Question: ${userQuery}` 
  });
  
  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.0 }
  };
  
  try {
     const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
     });
     
     if (!res.ok) {
       throw new Error(`Gemini API HTTP ${res.status}: ${await res.text()}`);
     }

     const data = await res.json();
     const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'The Oracle could not parse a valid technical answer.';
     
     const docCitations = oracleFileURIs.map(d => `• ${d.title}`).join('\n');
     const msg = `🧠 *TITAN OS | TECHNICAL ORACLE*\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 `${answer.trim()}\n\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 `📚 *Referenced Blueprints:*\n${docCitations}`;

     await sendWhatsAppMessage(dispatchTarget, msg);
  } catch (err) {
     console.error('[Oracle Query Error]:', err.message);
     await sendWhatsAppMessage(dispatchTarget, `⚠️ Technical Oracle lookup failed. Engineering team has been notified.`);
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
    site_name: siteName || 'Central Operations',
    sender_phone: senderPhone || null,
    sender_name: senderName || 'Field Tech',
    raw_text: rawText,
    category: category || 'General Logistics',
    distilled_context: distilledContext || rawText.slice(0, 150),
    urgency,
    gravityScore: gravityScore,
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
// 4. SPRING MOBILIZATION GATE ENGINE
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
  const hasDeposit = (deposit === '50% Deposit Received' || deposit === 'Paid in Full' || deposit === '40% Delivery Payment' || deposit === '10% Final Payment' || deposit === '40% Deposit Reeeived');

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
      details: `${cureMsg} • ${roadMsg} • Deposit Cleared`,
      isReady: true
    };
  } else {
    const blockers = [];
    if (!hasDeposit) blockers.push('Deposit Pending');
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
// 5. UNIVERSAL VISUAL TRIAGE ENGINE (RECEIPTS, LEADS, FREIGHT)
// ====================================================================
async function classifyVisualMediaIntent(items) {
  const contentParts = [{ text: "Determine the primary subject of these images. If receipts, extract financial data. If email/lead screenshot, extract all contact and project details. If freight, extract shipping metadata. If an inventory tally sheet, extract counts." }];

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
      responseMimeType: 'application/json'
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
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true });
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
    siteName: site?.fields?.['Site Name'] || 'Central Operations',
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
    siteName: title,
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
  if (site?.id) {
    assignmentPayload['Sites'] = [site.id];
    await airtableWriteWithAutoDrop('Sites', { 'Site Status': 'Materials Staged', 'Last Note': `[FREIGHT STAGED] ${contents}` }, site.id);
  }

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'FRT';

  streamToDarkMatterVault({
    siteId: site?.id || null,
    siteName: site?.fields?.['Site Name'] || 'Central Operations',
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
 * CONVERSATIONAL TICKET & LEAD UPDATE HANDLER (WITH RELATIONAL REASSIGNMENT)
 */
async function handleTicketOrLeadUpdate({ rawText, entityName, explicitTicketId, worker, dispatchTarget, fromPhone, nlp = {} }) {
  const openAssignments = await getCachedOpenAssignments();
  const workerName = worker?.fields?.['Full Name'] || 'Bob';
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true });

  let targetTicket = null;

  const regexTicket = rawText.match(/#(\d+)/) || rawText.match(/ticket\s*#?(\d+)/i);
  const parsedTicketNum = explicitTicketId || nlp.referenced_ticket_id || nlp.ticket_id || (regexTicket ? parseInt(regexTicket[1]) : null);

  if (parsedTicketNum) {
    const cleanNum = parseInt(String(parsedTicketNum).replace(/\D/g, ''));
    targetTicket = openAssignments.find(a => a.fields['Assignment ID'] === cleanNum || a.id === String(parsedTicketNum));
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
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not locate an open ticket or lead to update.`);
    return false;
  }

  const existingNotes = targetTicket.fields['Notes'] || '';
  const cleanUpdate = rawText.trim();
  const appendedNotes = `${existingNotes}\n\n[UPDATE - ${workerName} at ${timeStr}]:\n${cleanUpdate}`.trim();

  const updatePayload = {
    'Notes': appendedNotes
  };

  let reassignedSiteName = null;
  const siteCandidate = nlp.reassign_site_name || nlp.queried_court_name || nlp.referenced_entity_name || nlp.matched_site_name;
  
  let targetSite = null;
  if (siteCandidate) {
    targetSite = await lookupSite(null, siteCandidate);
  } else {
    const siteMatch = rawText.match(/(?:re-?assign|assign|move|transfer)\s+(?:to\s+)?(?:site\s+)?([a-zA-Z0-9\s'-]+)/i);
    if (siteMatch) {
      targetSite = await lookupSite(null, siteMatch[1].trim());
    }
  }

  if (targetSite) {
    updatePayload['Sites'] = [targetSite.id];
    reassignedSiteName = targetSite.fields['Site Name'];
  }

  let assignedWorkerName = null;
  const workerCandidate = nlp.assign_worker_name;
  if (workerCandidate) {
    const workers = await getCachedWorkers();
    const matchedWorker = workers.find(w => {
      const wName = (w.fields['Full Name'] || w.fields['Worker Name'] || '').toLowerCase();
      return wName.includes(workerCandidate.toLowerCase());
    });
    if (matchedWorker) {
      updatePayload['Worker'] = [matchedWorker.id];
      assignedWorkerName = matchedWorker.fields['Full Name'] || matchedWorker.fields['Worker Name'];
    }
  }

  if (nlp.ticket_status_update) {
    updatePayload['Status'] = nlp.ticket_status_update;
  }

  await airtableWriteWithAutoDrop('Daily Assignments', updatePayload, targetTicket.id);
  invalidateAirtableCache('assignments');

  const ticketId = targetTicket.fields['Assignment ID'] ? `#${targetTicket.fields['Assignment ID']}` : 'TICKET';
  const type = targetTicket.fields['Assignment Type'] || 'Task';
  const newStatusStr = nlp.ticket_status_update ? `\n📊 *New Status:* ${nlp.ticket_status_update}` : '';

  let confirmCard = `📝 *TITAN OS | ${type.toUpperCase()} UPDATED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Ticket:* ${ticketId}\n` +
    `👤 *Logged By:* ${workerName}\n` +
    `⏱️ *Time:* ${timeStr}` +
    newStatusStr +
    (reassignedSiteName ? `\n🏟️ *Reassigned Site:* ${reassignedSiteName}` : '') +
    (assignedWorkerName ? `\n👷 *Assigned Tech:* ${assignedWorkerName}` : '') +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Added Note:*\n"${cleanUpdate}"\n\n` +
    `✅ *Airtable ledger updated.*`;

  await sendWhatsAppMessage(dispatchTarget, confirmCard);
  return true;
}

// ====================================================================
// 6. DECOUPLED BLIND VISION CLASSIFIER & MEDIA EVALUATOR
// ====================================================================

async function inspectBlindVisualGroundTruth(mediaItem, batchText = '', dispatchTarget, targetedSiteOverride, site) {
  const payload = {
    system_instruction: { parts: [{ text: INDUSTRIAL_SYSTEM_PROMPT.split('OUTPUT SPECIFICATION')[0] + '\nClassify the physical environment. Is this a padel court? Output JSON {"is_padel_court": boolean, "detected_scene": string}' }] },
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
      responseMimeType: 'application/json'
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
    const visualTruth = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    
    if (visualTruth.is_padel_court === false) {
      console.log(`[Vision Bypass] Partial/Macro photo detected (${visualTruth.detected_scene}). Logging to dark matter instead of blocking.`);
      
      const bypassNotes = `[PARTIAL SWEEP LOGGED]: \nDetected Scene: ${visualTruth.detected_scene || 'Unknown Hardware / Macro Shot'}\nCaption: ${batchText || 'No caption provided.'}`;
      
      if (targetedSiteOverride || site) {
         await airtableWriteWithAutoDrop('Sites', {
          'Last Note': bypassNotes,
          'Last Intent': 'PARTIAL_MEDIA_LOG'
        }, (targetedSiteOverride || site).id);
      }
      
      const fallbackCard = `📸 *TITAN OS | PARTIAL MEDIA ARCHIVED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Camera Detected:* ${visualTruth.detected_scene || 'Macro shot / Non-court structure'}\n` +
        `✅ *Action:* Media has been securely logged to the site ledger.\n\n` +
        `_Note: To verify a full physical gate milestone, ensure the primary court structure is visible in the frame._`;
        
      await sendWhatsAppMessage(dispatchTarget, fallbackCard);
    }
    
    return visualTruth;
  } catch (err) {
    return { is_padel_court: true, detected_scene: 'Bypassed on parse error' };
  }
}

async function evaluateCourtMediaBatch(items, cumulativeContext) {
  const contentParts = [
    { text: `Context: You are evaluating a Padel court at site: ${cumulativeContext.siteName}. The workflow mode is ${cumulativeContext.workflowMode}. The site is currently at Status: ${cumulativeContext.siteStatus}. The target language for the output receipt card is ${cumulativeContext.workerLanguage}.` }
  ];

  for (const item of items) {
    if (item.type === 'video' || item.type === 'image') {
      contentParts.push({
        inline_data: {
          mime_type: item.mimeType,
          data: item.buffer.toString('base64')
        }
      });
    }
  }

  const payload = {
    system_instruction: { parts: [{ text: cumulativeContext.workflowMode === 'MAINTENANCE' ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT }] },
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
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
      console.error('[Gemini Evaluation API Error]:', await res.text());
      return { highest_gate: 0, blockers_detected: [], summary: "API evaluation failed." };
    }

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) return { highest_gate: 0, blockers_detected: [], summary: "Failed to generate evaluation." };

    return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Gemini Evaluation Exception]:', err.message);
    return { highest_gate: 0, blockers_detected: [], summary: "Exception during evaluation." };
  }
}

// ====================================================================
// 6. SITE CONTEXT BINDING & CHECK-IN
// ====================================================================
async function bindSiteContext(site, worker, callerIdentity, dispatchTarget, fromPhone, distanceMeters, userLat, userLon) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Tech';
  userActiveSiteMap.set(fromPhone, site.id);
  
  if (worker && worker.id) {
    try {
        await airtableWriteWithAutoDrop('Workers', { 'Current Site Bound': [site.id] }, worker.id);
    } catch (e) {
        console.warn(`[Airtable Auto-Healer] Ignored missing 'Current Site Bound' field for worker ${worker.id}`);
    }
  }

  airtableWriteWithAutoDrop('Sites', {
    'Last Note': `[SITE BOUND] ${workerName} checked in (${Math.round(distanceMeters)}m from court).`,
    'Last Intent': 'PRESENCE_VERIFIED'
  }, site.id).catch(() => {});

  const isIndoor = isIndoorSite(site);
  let arrivalWeather = '';
  if (!isIndoor && userLat && userLon) {
    const weather = await getHyperlocalWeather(userLat, userLon);
    if (weather) arrivalWeather = evaluateWeatherTripwires(weather).summaryText;
  }

  let checkinCard = `📍 *TITAN OS | SITE CONTEXT BOUND*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏟️ *Court:* ${site.fields['Site Name']}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `📏 *Distance:* ${Math.round(distanceMeters)}m from court pin\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Gate Status:* ${site.fields['Current Gate'] || 'Active'}\n` +
    (arrivalWeather ? `\n🌤️ *Site Telemetry:*${arrivalWeather}\n` : '') +
    `\n👉 Ready for pre-work sweep, punch list updates, or supply requests.`;

  const prefLang = worker?.fields?.['Language'] || 'English';
  const todayStr = new Date().toISOString().split('T')[0];
  if (dailyEasterEggTracker.get(fromPhone) !== todayStr) {
    const egg = await generateMorningEasterEgg(prefLang);
    checkinCard += egg;
    dailyEasterEggTracker.set(fromPhone, todayStr);
  }

  await sendWhatsAppMessage(dispatchTarget, checkinCard);
}

// ====================================================================
// 8. GEOSPATIAL & METEOROLOGICAL TELEMETRY (CRANE-FREE TRIPWIRES)
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
  if (!weather) return { criticalAlerts: [], holds: [], warnings: [], nominal: true, summaryText: '' };

  const criticalAlerts = [];
  const holds = [];
  const warnings = [];
  const dewDelta = weather.temp - weather.dewPoint;

  // 1. CRITICAL SAFETY & CHEMICAL LOCKOUTS (Proactive Push-Worthy)
  if (weather.weatherCode >= 95 && weather.weatherCode <= 99) {
    criticalAlerts.push(`⛈️ *SEVERE WEATHER / LIGHTNING:* Evacuate court frame. Immediate safety stand-down.`);
  }
  if (weather.windGusts > 60) {
    criticalAlerts.push(`🌪️ *EXTREME WIND HAZARD (${weather.windGusts} km/h):* Secure all loose materials. Frame and glass hazard.`);
  }
  if (weather.temp < 10) {
    criticalAlerts.push(`❄️ *TURF GLUE CURE HOLD (${weather.temp}°C):* Polyurethane adhesive failure risk. Do not glue turf seams.`);
  }

  // 2. STANDARD OPERATIONAL TRIPWIRES (Morning Pin-Drop Briefing Only)
  if (weather.windGusts > 37 && weather.windGusts <= 60) {
    holds.push(`⛔ *WIND HOLD (${weather.windGusts} km/h):* Suction cup glass installation prohibited.`);
  } else if (weather.windGusts > 28) {
    warnings.push(`💨 *WIND WARNING (${weather.windGusts} km/h):* Approach glass seating with caution.`);
  }

  if (weather.humidity > 85 || dewDelta <= 2.5) {
    holds.push(`💧 *CONDENSATION HOLD:* Dew delta is ${dewDelta.toFixed(1)}°C (Humidity: ${weather.humidity}%). Pad/carpet moisture will ruin adhesive bond.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0) {
    holds.push(`🌧️ *RAIN HOLD:* Active rain detected. Hold outdoor gluing, glass, and mesh.`);
  } else if (weather.precipProbability4h > 40) {
    warnings.push(`🌦️ *RAIN PROBABILITY (${weather.precipProbability4h}% in 4h):* Keep blue tarps staged over open turf rolls.`);
  }

  if (weather.isRainingOrStorm || weather.precip > 0 || weather.humidity > 90) {
    holds.push(`⏳ *SAND INFILL HOLD:* Wet conditions detected. Silica sand must strictly be applied to dry turf.`);
  }

  if (weather.temp > 35) {
    warnings.push(`☀️ *HIGH HEAT ALERT (${weather.temp}°C):* Adhesive pot-life drops to <5 minutes. Mandatory crew shade rest cycles.`);
  }

  const isNominal = holds.length === 0 && criticalAlerts.length === 0 && warnings.length === 0;
  let summaryText = '';

  if (criticalAlerts.length > 0) summaryText += `\n` + criticalAlerts.join('\n');
  if (holds.length > 0) summaryText += `\n` + holds.join('\n');
  if (warnings.length > 0) summaryText += `\n` + warnings.join('\n');
  if (isNominal) {
    summaryText += `\n🟢 *Conditions Clear:* Wind (${weather.windSpeed} km/h), Temp (${weather.temp}°C), and moisture clear for work.`;
  }

  return { criticalAlerts, holds, warnings, nominal: isNominal, summaryText };
}

async function generateMorningEasterEgg(workerLanguage = 'English') {
  const prompt = `You are a friendly dispatcher for a Bounce Padel court construction crew. 
  Generate a short, clean, construction-themed dad joke. 
  Write the response entirely in ${workerLanguage}.
  Keep it brief (1-2 sentences max). Add a relevant emoji at the start. Do not use quotes or conversational filler.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8 }
  };

  try {
    const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? `\n\n🎁 *Morning Bonus:*\n${text.trim()}` : '';
  } catch (err) {
    return '';
  }
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
        facilityTier: siteRecord?.fields?.['Facility Tier'] || 'Standard Residential',
        phone: fromPhone
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
        workerRecord: worker,
        phone: fromPhone
      };
    }
  } catch (err) {}

  return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: fromPhone };
}

// ====================================================================
// 10. WHATSAPP MESSAGING & JOY CANNON ENGINE
// ====================================================================

async function sendWhatsAppReaction(toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId || !CONFIG.meta.phoneNumberId) return false;
  let cleanDestination = String(toTarget).replace(/\D/g, ''); 
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

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
  if (!toTarget || !CONFIG.meta.phoneNumberId) {
    console.warn(`[Meta Outbound] Aborted: Target missing.`);
    return false;
  }
  
  let cleanDestination = String(toTarget).replace(/\D/g, '');
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanDestination,
    type: 'text',
    text: { body: messageBody }
  };

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
      if (attempt <= retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        return false;
      }
    }
  }
  return false;
}

async function sendWhatsAppButtons(toTarget, textBody, buttons = []) {
  if (!toTarget || !buttons || buttons.length === 0 || !CONFIG.meta.phoneNumberId) return false;
  
  let cleanDestination = String(toTarget).replace(/\D/g, '');
  if (cleanDestination.length === 10) cleanDestination = '1' + cleanDestination;

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${idx}_${Date.now()}`,
      title: (btn.title || 'Select').slice(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanDestination,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: textBody },
      action: { buttons: actionButtons }
    }
  };

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

async function fanOutToSubscribers(phoneNumbersString, messageBody, buttons = []) {
  if (!phoneNumbersString) return;
  
  const rawNumbers = String(phoneNumbersString).split(',');
  const cleanNumbers = rawNumbers.map(n => {
      let num = n.replace(/\D/g, '').trim();
      if (num.length === 10) num = '1' + num;
      return num;
  }).filter(n => n.length >= 10);
  
  const uniqueTargets = [...new Set(cleanNumbers)];

  for (const target of uniqueTargets) {
    if (buttons.length > 0) {
      await sendWhatsAppButtons(target, messageBody, buttons);
    } else {
      await sendWhatsAppMessage(target, messageBody);
    }
  }
}

async function fireInstallationJoyCannon(siteRecord, highestGate, workerName = 'A crew member') {
  try {
    const staticExecutivePhones = '14379287172, 13435405666'; 
    
    const subscribedPhones = siteRecord.fields['Subscribed Phones'];
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

    console.log(`[Joy Cannon] Dispatching to Static Executives: ${staticExecutivePhones}`);
    await fanOutToSubscribers(staticExecutivePhones, celebrationCard);

    if (subscribedPhones) {
      console.log(`[Joy Cannon] Dispatching to Subscribed Phones: ${subscribedPhones}`);
      await fanOutToSubscribers(subscribedPhones, celebrationCard);
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

    const assignedCrewName = siteRecord.fields['Assigned Crew'];
    if (assignedCrewName) {
      const workers = await getCachedWorkers();
      const crewMembers = workers.filter(w => w.fields['Assigned Crew'] === assignedCrewName && w.fields['Active']);
      const crewPhones = crewMembers.map(w => w.fields['Phone E164'] || w.fields['WhatsApp Number']).filter(Boolean).join(',');
      
      const crewCard = `🤜🤛 *TITAN OS | CREW SYNC*\n━━━━━━━━━━━━━━━━━━━━\n${workerName} just locked in Gate ${highestGate} at ${siteRecord.fields['Site Name']}.\n\n` + 
                       celebrationCard.replace('🎾 *BOUNCE PADEL | PROGRESS UPDATE*\n━━━━━━━━━━━━━━━━━━━━\n', '');
      
      await fanOutToSubscribers(crewPhones, crewCard);
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
  await refreshInventoryCache();

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
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true });
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
// 12. TECHNICAL SPECS & CBSA BORDER KNOWLEDGE COPILOT
// ====================================================================

function handleTechnicalSpecsQuery(rawText, dispatchTarget) {
  const query = rawText.toLowerCase();

  if (/carm|border|pars|paps|customs|manifest|carrier code|dunnage|crate exemption/i.test(query)) {
    const card = `🇨🇦 *TITAN OS | CBSA & BORDER COPILOT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Approved Carrier Code:* C13MM (PARS barcode: C13MM...)\n` +
      `• *US Bound SCAC:* BOWB (PAPS barcode: BOWB...)\n` +
      `• *Declaration Type:* Use *Type AB* (With Release) or Type V. Never Type F!\n` +
      `• *Trip Number:* Must be unique and DIFFERENT from the Cargo Control Number (e.g. Trip: 13MM102526, CCN: 13MM01000).\n` +
      `• *Empty Crates / A-Frames:* Select *Instrument of International Trade (IIT)* exemption attached to trailer AD978S.\n` +
      `• *Commercial Cargo:* 12 rolls RealTurf, 8 glass panes on A-frame under PARS 13MM01000.\n` +
      `• *1-Hour Mandate:* Driver must wait 60 minutes after status hits "On file with CBSA" before approaching the booth!`;
    sendWhatsAppMessage(dispatchTarget, card);
    return true;
  }

  if (/spec|dimension|height|net|sand|ral|color|colour|mesh|rivnut|torque|bolt/i.test(query)) {
    const card = `📐 *TITAN OS | ENGINEERING & SPECS ORACLE*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Net Dimensions:* 88cm (34.6") center height, 92cm (36.2") at post. Knotted net mandatory for outdoor courts.\n` +
      `• *Silica Sand:* 77 bags (~3,500 lbs) per court (50lb bags). Kiln-dried (0.2–0.8mm).\n` +
      `• *Turf Layout:* 3 rolls per court (A, B, C). White lines trimmed with 1.2m inset. Polyurethane bond requires >=10°C.\n` +
      `• *Paint Colors:* Standard Black: RAL 9005 (Jet Black). Blue: Pantone 533 C / Oxford Blue. Pearl Mouse for custom.\n` +
      `• *Fasteners:* M8 hex socket cap screws (450 pcs), 1/2"x4" & 1/2"x6" hex head anchor bolts (50 pcs, 17mm head).\n` +
      `• *Rivnuts:* M8 for standard frames, M10 for Hurricane courts. Through-bolts on all upper 2x8 beams.\n` +
      `• *Wind Hold:* >20 kts (37 km/h) prohibits suction-cup glass installations.`;
    sendWhatsAppMessage(dispatchTarget, card);
    return true;
  }

  return false;
}

// ====================================================================
// 13. SPOKEN QUERY HANDLERS & MEDIA RETRIEVAL
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

async function handleSpokenStatusQuery(queriedName, fallbackSite, dispatchTarget, isTicketOnly = false, isMaintenanceOnly = false) {
  let targetSite = null;
  let isAllSites = false;

  if (queriedName && (queriedName.toLowerCase() === 'all' || queriedName.toLowerCase() === 'network')) {
    isAllSites = true;
  } else {
    if (queriedName) targetSite = await lookupSite(null, queriedName);
    if (!targetSite) targetSite = fallbackSite;
  }

  if (!isAllSites && !targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Court not found. Check spelling in Airtable.`);
    return;
  }

  const workflowMode = targetSite ? (targetSite.fields['Workflow Mode'] || 'INSTALLATION') : 'EXECUTIVE';
  if (workflowMode === 'EXECUTIVE') isAllSites = true;

  const allOpenAssignments = await getCachedOpenAssignments();
  
  let linkedAssignments = [];
  if (isAllSites) {
    linkedAssignments = allOpenAssignments;
  } else {
    const siteId = targetSite.id;
    linkedAssignments = allOpenAssignments.filter(record => {
      const s = record.fields['Sites'] || record.fields['Site'] || [];
      const siteIds = Array.isArray(s) ? s : [s];
      return siteIds.includes(siteId);
    });
  }

  const fieldTickets = linkedAssignments.filter(a => {
    const type = a.fields['Assignment Type'] || '';
    const cat = a.fields['Task Category'] || '';
    if (isMaintenanceOnly) {
       return type.toLowerCase().includes('maintenance') || type.toLowerCase().includes('repair') || type.toLowerCase().includes('service') || cat.toLowerCase().includes('maintenance');
    }
    return type !== 'Sales' && type !== 'Expense';
  });
  
  const salesLeads = linkedAssignments.filter(a => a.fields['Assignment Type'] === 'Sales');

  const titleContext = isMaintenanceOnly ? 'MAINTENANCE TICKETS' : 'ACTIVE WORK ORDERS';
  let responseCard = isAllSites 
    ? `🌐 *TITAN OS | ALL ${titleContext}*\n━━━━━━━━━━━━━━━━━━━━\n`
    : `🏟️ *${targetSite.fields['Site Name'].toUpperCase()} | ${isTicketOnly ? titleContext : 'STATUS'}*\n━━━━━━━━━━━━━━━━━━━━\n`;

  if (!isTicketOnly && !isAllSites) {
    responseCard += `• Mode: ${workflowMode}\n`;
    responseCard += `• Status: ${targetSite.fields['Site Status'] || 'ACTIVE'}\n`;
    if (workflowMode === 'INSTALLATION') {
      responseCard += `• Gate: ${targetSite.fields['Current Gate'] || 'No Gate Set'}\n`;
    }
    responseCard += `• Last Update: ${(targetSite.fields['Last Note'] || 'No notes logged').slice(0, 100)}\n`;
    responseCard += `━━━━━━━━━━━━━━━━━━━━\n`;
  }

  if (fieldTickets.length === 0) {
    responseCard += `✅ *Field Tickets:* No open field tickets.\n`;
  } else {
    const headerText = isMaintenanceOnly ? 'Maintenance Tickets' : 'Field Tickets';
    const header = isAllSites ? `🛠️ *All Open ${headerText} (${fieldTickets.length}):*` : `🛠️ *Open ${headerText} (${fieldTickets.length}):*`;
    responseCard += `${header}\n`;
    fieldTickets.forEach(t => {
      const ticketNum = t.fields['Assignment ID'] ? `#${t.fields['Assignment ID']}` : 'WO';
      const priority = t.fields['Priority'] || 'Medium';
      const status = t.fields['Status'] || 'Open';
      
      let siteLabel = '';
      if (isAllSites && t.fields['Sites'] && memoryCache.sites) {
        const matchedSite = memoryCache.sites.find(s => s.id === t.fields['Sites'][0]);
        if (matchedSite) siteLabel = ` [${matchedSite.fields['Site Name']}]`;
      }
      
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

      const category = t.fields['Task Category'] || t.fields['Assignment Type'] || 'Task';
      const rawNote = t.fields['Notes'] || '';
      const cleanNote = rawNote.replace(/\n/g, ' ').replace(/^\[.*?\]\s*/, '').slice(0, 80);
      
      let statusIcon = '⏳';
      if (status === 'In Progress') statusIcon = '🛠️';
      if (status === 'Paused') statusIcon = '⏸️';
      
      responseCard += `• *${ticketNum}*${siteLabel} [${priority}] *${category}*${assignedWorkers}\n  └ ${statusIcon} Status: ${status}\n  └ _${cleanNote || 'No details provided.'}_\n\n`;
    });
  }

  if (salesLeads.length > 0 && !isTicketOnly) {
    responseCard += `\n💼 *Commercial Leads (${salesLeads.length}):*\n`;
    salesLeads.forEach(s => {
      const leadNum = s.fields['Assignment ID'] ? `#${s.fields['Assignment ID']}` : 'LEAD';
      const rawNote = s.fields['Notes'] || '';
      const cleanDesc = rawNote.split('\n')[0].replace(/\[COMMERCIAL LEAD —\s*/i, '').replace(/\]/, '').slice(0, 45);
      responseCard += `• *${leadNum}*: ${cleanDesc || 'Inbound Sales Lead'}\n`;
    });
  }

  if (responseCard.length > 3500) {
      responseCard = responseCard.slice(0, 3500) + `\n\n... (List truncated. View Airtable for full list).`;
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
    const directLink = targetSite.fields['Latest Video Link'];
    let mediaUrl = directLink || null;
    let date = 'Recent';
    let ticketId = 'N/A';
    let workerName = 'Tech';

    if (!mediaUrl) {
      const formula = `AND(SEARCH('${siteNameSafe}', {Sites} & "") > 0, OR({Post-Work Media} != '', {Pre-Work Media} != ''))`;
      const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=1`;
      
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.records && data.records.length > 0) {
          const record = data.records[0];
          mediaUrl = record.fields['Post-Work Media'] || record.fields['Pre-Work Media'];
          date = record.fields['Date'];
          ticketId = record.fields['Assignment ID'];
          
          if (record.fields['Worker'] && record.fields['Worker'].length > 0 && memoryCache.workers) {
            const w = memoryCache.workers.find(wk => wk.id === record.fields['Worker'][0]);
            if (w) workerName = w.fields['Full Name'] || w.fields['Worker Name'] || 'Tech';
          }
        }
      }
    }

    if (mediaUrl) {
      const msg = `🎥 *LATEST MEDIA | ${targetSite.fields['Site Name'].toUpperCase()}*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `📅 *Date:* ${date}\n` +
                  `👤 *Logged By:* ${workerName}\n` +
                  `🎫 *Ticket Ref:* #${ticketId}\n` +
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

async function handleDocumentRetrieval(nlp, fallbackSite, dispatchTarget) {
  const query = (nlp.referenced_entity_name || nlp.queried_court_name || nlp.matched_site_name || nlp.transcript_en || '').toLowerCase();
  
  if (oracleFileURIs.length > 0 && query) {
     const matchedDoc = oracleFileURIs.find(d => 
        query.includes(d.title.toLowerCase()) || 
        d.title.toLowerCase().includes(query) ||
        (d.filename && d.filename.toLowerCase().includes(query))
     );
     
     if (matchedDoc && matchedDoc.downloadUrl) {
         const docCard = `📐 *TITAN OS | TECHNICAL ORACLE*\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n` +
                         `📄 *Document:* ${matchedDoc.title}\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n` +
                         `🔗 *Secure Download Link:*\n${matchedDoc.downloadUrl}`;
         await sendWhatsAppMessage(dispatchTarget, docCard);
         return;
     }
  }

  let targetSite = null;
  const siteQuery = nlp.queried_court_name || nlp.matched_site_name || nlp.referenced_entity_name;
  if (siteQuery) targetSite = await lookupSite(null, siteQuery);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not locate a general document for "${query}" or a specific court. Check spelling.`);
    return;
  }

  const siteName = targetSite.fields['Site Name'] || 'Requested Court';
  const docUrl = targetSite.fields['Technical Docs'];

  if (docUrl) {
    const docCard = `📐 *TITAN OS | SITE DOCUMENT*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `🏟️ *Court:* ${siteName}\n` +
                    `📄 *Resource:* Foundation / Technical Plan\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔗 *Secure Download Link:*\n${docUrl}`;
    await sendWhatsAppMessage(dispatchTarget, docCard);
  } else {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ No Technical Docs URL found in the ledger for *${siteName}*. Please add the link in Airtable.`);
  }
}

async function handleSpokenARLookup(queriedEntity, dispatchTarget) {
  const query = `select * from Invoice where Balance > '0' maxresults 50`;
  const qboData = await qboApiRequest(query);

  if (!qboData || !qboData.QueryResponse || !qboData.QueryResponse.Invoice) {
    await sendWhatsAppMessage(dispatchTarget, `💼 *TITAN OS | AR LOOKUP*\nNo open invoices found in QuickBooks or API is disconnected.`);
    return;
  }

  let invoices = qboData.QueryResponse.Invoice;
  const isGenericAgingQuery = !queriedEntity || /all|aging|30|total|current/i.test(queriedEntity);

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
    
    const lateString = daysLate > 30 ? ` — *${daysLate} Days Late* 🔴` : (daysLate > 0 ? ` — *${daysLate} Days Late* 🟡` : ' — Current 🟢');
    
    if (!queriedEntity || !queriedEntity.includes('30') || daysLate > 30) {
        lines.push(`• *${inv.CustomerRef.name}* (Inv #${inv.DocNumber}): $${balance.toFixed(2)}${lateString}`);
    }
  });

  if (lines.length === 0) {
      await sendWhatsAppMessage(dispatchTarget, `💼 *TITAN OS | AR LOOKUP*\nNo invoices found matching that aging criteria.`);
      return;
  }

  const headerTitle = isGenericAgingQuery ? 'MASTER AGING REPORT' : invoices[0].CustomerRef.name.toUpperCase();

  const arCard = `💼 *TITAN OS | AR LOOKUP: ${headerTitle}*\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 `💰 *Total Outstanding:* $${totalOwing.toFixed(2)}\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 lines.join('\n');

  await sendWhatsAppMessage(dispatchTarget, arCard);
}

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

async function handleInvoiceCreation(nlp, dispatchTarget) {
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const amount = nlp.qbo_amount;
  const lineItems = nlp.qbo_line_items || 'Standard Service';

  if (!customerNameTarget || !amount) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the client name and total amount to create a new invoice.`);
    return;
  }

  const cleanName = customerNameTarget.replace(/'/g, "\\'");
  const custQuery = `select * from Customer where DisplayName LIKE '${cleanName}%' MAXRESULTS 1`;
  const qboData = await qboApiRequest(custQuery);

  if (!qboData || !qboData.QueryResponse || !qboData.QueryResponse.Customer || qboData.QueryResponse.Customer.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Client "${customerNameTarget}" not found in QuickBooks.`);
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

async function handleActionableStateChange(nlp, site, worker, callerIdentity, dispatchTarget, rawText = '') {
  let targetSiteId = site?.id;
  let targetSiteName = site?.fields?.['Site Name'] || 'Assigned Court';

  if (nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name) {
    const matched = await lookupSite(null, nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name);
    if (matched) {
      targetSiteId = matched.id;
      targetSiteName = matched.fields['Site Name'];
    }
  }

  const updatePayload = {};
  const updateNotes = [];

  if (nlp.workflow_mode) { updatePayload['Workflow Mode'] = nlp.workflow_mode; updateNotes.push(`Workflow Mode: ${nlp.workflow_mode}`); }
  if (nlp.site_status_update) { updatePayload['Site Status'] = nlp.site_status_update; updateNotes.push(`Site Status: ${nlp.site_status_update}`); }
  
  if (nlp.deposit_status) { 
    updatePayload['Deposit Status'] = nlp.deposit_status; 
    updateNotes.push(`Deposit: ${nlp.deposit_status}`); 
  }
  
  if (nlp.foundation_type) { updatePayload['Foundation Type'] = nlp.foundation_type; updateNotes.push(`Foundation: ${nlp.foundation_type}`); }
  if (nlp.slab_pour_date) { updatePayload['Slab Pour Date'] = nlp.slab_pour_date; updateNotes.push(`Slab Poured: ${nlp.slab_pour_date}`); }
  if (nlp.assigned_crew) { updatePayload['Assigned Crew'] = nlp.assigned_crew; updateNotes.push(`Crew: ${nlp.assigned_crew}`); }
  if (nlp.manufacturer) { updatePayload['Manufacturer'] = nlp.manufacturer; updateNotes.push(`Manufacturer: ${nlp.manufacturer}`); }
  
  if (nlp.steel_color) { updatePayload['Steel Color'] = nlp.steel_color; updateNotes.push(`Steel: ${nlp.steel_color}`); }
  if (nlp.turf_color) { updatePayload['Turf Color'] = nlp.turf_color; updateNotes.push(`Turf: ${nlp.turf_color}`); }
  if (nlp.turf_supplier) { updatePayload['Turf Supplier'] = nlp.turf_supplier; updateNotes.push(`Supplier: ${nlp.turf_supplier}`); }
  if (nlp.year_installed) { updatePayload['Year Installed'] = nlp.year_installed; updateNotes.push(`Year: ${nlp.year_installed}`); }
  if (nlp.model_type) { updatePayload['Model Type'] = nlp.model_type; updateNotes.push(`Model: ${nlp.model_type}`); }
  if (nlp.glass_thickness) { updatePayload['Glass Thickness'] = nlp.glass_thickness; updateNotes.push(`Glass: ${nlp.glass_thickness}`); }
  if (nlp.court_type) { updatePayload['Model Type'] = nlp.court_type; updateNotes.push(`Type: ${nlp.court_type}`); }
  if (nlp.a_frames_retrieved) { updatePayload['A-Frames Retrieved'] = true; updateNotes.push(`A-Frames: Picked up`); }
  
  // New Lights Column Logic
  if (nlp.light_presence) { 
      updatePayload['Light'] = nlp.light_presence; 
      updateNotes.push(`Lights: ${nlp.light_presence}`); 
  }

  if (Object.keys(updatePayload).length === 0) {
    if (/assign|ticket|chore|task|#\d+|reassign/i.test(rawText)) {
      console.log('[Routing Auto-Heal] Re-routing misclassified ACTIONABLE_STATE_CHANGE to handleTicketOrLeadUpdate');
      return await handleTicketOrLeadUpdate({
        rawText,
        entityName: nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name,
        explicitTicketId: nlp.referenced_ticket_id || nlp.ticket_id,
        worker,
        dispatchTarget,
        fromPhone: callerIdentity.phone || '',
        nlp
      });
    }

    await sendWhatsAppMessage(dispatchTarget, `⚠️ Heard your update for ${targetSiteName}, but no specific database dropdown fields were detected.`);
    return;
  }

  const targetSiteIds = [];
  const targetSiteRecords = [];
  
  if (nlp.target_site_names && nlp.target_site_names.length > 0) {
     for (const sName of nlp.target_site_names) {
        const matched = await lookupSite(null, sName);
        if (matched) {
           targetSiteIds.push(matched.id);
           targetSiteRecords.push(matched);
        }
     }
  } else if (targetSiteId) {
     const matched = await lookupSite(null, targetSiteName);
     if (matched) {
        targetSiteIds.push(targetSiteId);
        targetSiteRecords.push(matched);
     }
  }

  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'HQ Admin';
  updatePayload['Last Note'] = `[DATABASE OVERRIDE - ${workerName}]: ${updateNotes.join(', ')}`;
  updatePayload['Last Intent'] = 'ACTIONABLE_STATE_CHANGE';

  for (const [idx, tId] of targetSiteIds.entries()) {
     await airtableWriteWithAutoDrop('Sites', updatePayload, tId);
     
     if (nlp.deposit_status && (nlp.deposit_status.includes('50%') || nlp.deposit_status.includes('Paid') || nlp.deposit_status.includes('40%'))) {
        const fullRecord = targetSiteRecords[idx];
        const recordManufacturer = updatePayload['Manufacturer'] || fullRecord.fields['Manufacturer'] || '';
        
        if (recordManufacturer === 'BPC') {
            await reserveCourtBOM(fullRecord.fields['Site Name'], dispatchTarget);
        } else {
            console.log(`[BOM Engine] Bypassing BOM reservation for ${fullRecord.fields['Site Name']} (Manufacturer: ${recordManufacturer} is non-BPC).`);
        }
     }
  }
  
  invalidateAirtableCache('sites');
  const targetSiteNamesText = targetSiteRecords.map(r => r.fields['Site Name']);

  const confirmCard = `🎛️ *TITAN OS | SITE LEDGER UPDATED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏟️ *Target(s):* ${targetSiteNamesText.length > 3 ? `${targetSiteNamesText.length} courts updated` : targetSiteNamesText.join(', ')}\n` +
    `👤 *Updated By:* ${workerName}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Database Fields Modified:* \n• ${updateNotes.join('\n• ')}\n\n` +
    `_Airtable synced. No login required._`;

  await sendWhatsAppMessage(dispatchTarget, confirmCard);
}

async function handleBulkSiteCreation(nlp, dispatchTarget, fromPhone) {
  const siteNames = nlp.target_site_names || nlp.new_site_names || [];

  if (!siteNames || siteNames.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ I heard a bulk creation command, but couldn't extract the specific court names.`);
    return;
  }

  const recentPin = lastDroppedCoordinates.get(fromPhone);
  let locationString = null;
  if (recentPin && (Date.now() - recentPin.timestamp < 10 * 60 * 1000)) {
    locationString = `${recentPin.lat.toFixed(6)}, ${recentPin.lon.toFixed(6)}`;
    lastDroppedCoordinates.delete(fromPhone);
  }

  const createdSites = [];
  const specsToApply = {};

  if (nlp.foundation_type) specsToApply['Foundation Type'] = nlp.foundation_type;
  if (nlp.manufacturer) specsToApply['Manufacturer'] = nlp.manufacturer;
  if (nlp.steel_color) specsToApply['Steel Color'] = nlp.steel_color;
  if (nlp.turf_color) specsToApply['Turf Color'] = nlp.turf_color;
  if (nlp.turf_supplier) specsToApply['Turf Supplier'] = nlp.turf_supplier;
  if (nlp.model_type) specsToApply['Model Type'] = nlp.model_type;
  if (nlp.glass_thickness) specsToApply['Glass Thickness'] = nlp.glass_thickness;
  if (nlp.year_installed) specsToApply['Year Installed'] = nlp.year_installed;
  if (nlp.deposit_status) specsToApply['Deposit Status'] = nlp.deposit_status;

  try {
    for (const siteName of siteNames) {
      const newRecordPayload = {
        'Site Name': siteName.trim(),
        'Workflow Mode': 'PLANNING',
        'Site Status': 'ACTIVE',
        'Last Note': `[SITE BATCH CREATED - Specs Synced]`,
        ...specsToApply
      };

      if (locationString) {
        newRecordPayload['Site location'] = locationString;
      }

      const createdSite = await airtableWriteWithAutoDrop('Sites', newRecordPayload);
      if (createdSite?.id) {
        createdSites.push(siteName.trim());
      }
    }

    if (createdSites.length > 0) {
      invalidateAirtableCache('sites');

      let specSummary = Object.entries(specsToApply).map(([k, v]) => `• ${k}: ${v}`).join('\n');
      if (!specSummary) specSummary = "No bulk specs provided. Populated with defaults.";

      const msg = `🏟️ *TITAN OS | BULK SITES CREATED*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `✅ Successfully created ${createdSites.length} sites:\n` +
                  createdSites.map(s => `• ${s}`).join('\n') + `\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `📋 *Specs Applied to All:*\n${specSummary}\n\n` +
                  (locationString ? `📍 *Coordinates Locked:* ${locationString}\n` : '') +
                  `_Airtable ledger updated._`;
      
      await sendWhatsAppMessage(dispatchTarget, msg);
    } else {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to create the sites in Airtable. Check API schema logs.`);
    }
  } catch (e) {
    console.error('[Bulk Site Creation Exception]:', e);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Exception during bulk site creation.`);
  }
}

async function handleSpokenSpecsQuery(queriedName, fallbackSite, dispatchTarget) {
  let targetSite = null;
  if (queriedName) targetSite = await lookupSite(null, queriedName);
  if (!targetSite) targetSite = fallbackSite;

  if (!targetSite) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Court not found to check specifications.`);
    return;
  }

  const siteName = targetSite.fields['Site Name'] || 'Assigned Court';
  const courtType = targetSite.fields['Model Type'] || 'Padel Court'; 
  const steelColor = targetSite.fields['Steel Color'] || 'Unspecified';
  const turfColor = targetSite.fields['Turf Color'] || 'Unspecified';
  const turfSupplier = targetSite.fields['Turf Supplier'] || 'Unspecified';

  const specCard = `📍 *${siteName}* is a ${courtType} featuring ${steelColor} steel and ${turfColor} ${turfSupplier} turf.`;
  await sendWhatsAppMessage(dispatchTarget, specCard);
}

async function handleAssetTransfer(nlp, site, worker, callerIdentity, dispatchTarget) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Tech';
  const assetName = nlp.asset_name || nlp.requested_items || 'Equipment';
  let targetSiteId = site?.id;
  let targetSiteName = site?.fields?.['Site Name'] || 'Unknown Location';

  if (nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name) {
    const matched = await lookupSite(null, nlp.matched_site_name || nlp.queried_court_name || nlp.referenced_entity_name);
    if (matched) {
      targetSiteId = matched.id;
      targetSiteName = matched.fields['Site Name'];
    }
  }

  const payload = {
    'Asset Name': assetName,
    'Last Note': nlp.transcript_en || `Logged at ${targetSiteName}`
  };
  
  if (targetSiteId) payload['Current Location'] = [targetSiteId];
  if (worker?.id) payload['Last Updated By'] = [worker.id];

  await airtableWriteWithAutoDrop('Equipment', payload);

  const confirmCard = `🧰 *TITAN OS | ASSET TRACKER*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Item:* ${assetName}\n` +
    `📍 *Logged At:* ${targetSiteName}\n` +
    `👤 *Transferred By:* ${workerName}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Asset registered in equipment ledger._`;

  await sendWhatsAppMessage(dispatchTarget, confirmCard);
}

async function handleAssetQuery(nlp, dispatchTarget) {
  const assetName = nlp.asset_name || nlp.requested_items;
  if (!assetName) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify which tool or equipment you are looking for.`);
    return;
  }
  
  try {
    const formula = `SEARCH('${assetName.toLowerCase().replace(/'/g, "\\'")}', LOWER({Asset Name})) > 0`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Equipment?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Last%20Modified&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=1`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    const data = await res.json();

    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      const name = record.fields['Asset Name'];
      let locName = 'Unknown Location';
      let workerName = 'Unknown Tech';

      if (record.fields['Current Location'] && memoryCache.sites) {
         const s = memoryCache.sites.find(site => site.id === record.fields['Current Location'][0]);
         if (s) locName = s.fields['Site Name'];
      }
      if (record.fields['Last Updated By'] && memoryCache.workers) {
         const w = memoryCache.workers.find(wk => wk.id === record.fields['Last Updated By'][0]);
         if (w) workerName = w.fields['Full Name'] || w.fields['Worker Name'];
      }

      await sendWhatsAppMessage(dispatchTarget, `🧰 *TITAN OS | ASSET LOCATOR*\n\nThe *${name}* was last logged at *${locName}* by ${workerName}.`);
    } else {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ No asset matching "${assetName}" found in the equipment ledger.`);
    }
  } catch (err) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Equipment ledger lookup failed.`);
  }
}

// ====================================================================
// TITAN OS V6.0.18 — INVENTORY & ASSET STATE ENGINE
// ====================================================================

let memoryInventory = [];

async function refreshInventoryCache() {
  try {
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Inventory?maxRecords=200`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    memoryInventory = data.records.map(r => ({
      id: r.id,
      name: r.fields['Item Name'] || '',
      qty: parseFloat(r.fields['Quantity on hand']) || 0,
      committed: parseFloat(r.fields['Committed']) || 0,
      available: parseFloat(r.fields['Available']) || 0,
      category: r.fields['Category'] || 'Uncategorized',
      cost: parseFloat(r.fields['Unit Cost']) || 0,
      bomQty: parseFloat(r.fields['Standard BOM Qty']) || 0,
      leadTimeDays: parseFloat(r.fields['Lead Time (Days)']) || 0
    }));
    console.log(`📦 [Inventory Engine] Cached ${memoryInventory.length} SKUs in RAM`);
  } catch (err) {
    console.error('❌ [Inventory Engine] Failed to cache inventory:', err.message);
  }
}

async function executeInventoryCount(inventoryCounts, dispatchTarget, workerName = 'HQ Admin') {
  if (!inventoryCounts || inventoryCounts.length === 0) return;
  await refreshInventoryCache();
  
  let updatedList = [];
  let notFoundList = [];

  for (const count of inventoryCounts) {
    const query = (count.item_name || '').toLowerCase();
    const newQty = parseFloat(count.new_quantity);
    
    if (isNaN(newQty) || !query) continue;

    const matchedItem = memoryInventory.find(i => i.name.toLowerCase().includes(query) || query.includes(i.name.toLowerCase()));
    
    if (matchedItem) {
      await airtableWriteWithAutoDrop('Inventory', {
        'Quantity on hand': newQty,
        'Count Status': 'Verified'
      }, matchedItem.id);
      updatedList.push(`• *${matchedItem.name}:* ${newQty}`);
    } else {
      notFoundList.push(`• "${count.item_name}"`);
    }
  }

  let card = `📋 *TITAN OS | INVENTORY AUDIT LOGGED*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Auditor:* ${workerName}\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (updatedList.length > 0) {
    card += `✅ *Stock Updated:*\n${updatedList.join('\n')}\n\n`;
  }
  if (notFoundList.length > 0) {
    card += `⚠️ *Unknown SKUs:*\n${notFoundList.join('\n')}\n\n`;
  }
  card += `_Airtable Inventory Ledger synchronized._`;
  await sendWhatsAppMessage(dispatchTarget, card.trim());
}

async function processMilestoneBOMDeduction(siteRecord, clearedGate) {
  const siteName = siteRecord.fields['Site Name'] || 'Unknown Site';
  if (siteRecord.fields['Manufacturer'] !== 'BPC') {
     console.log(`[BOM Engine] Bypassing BOM deduction for ${siteName} (Manufacturer is ${siteRecord.fields['Manufacturer']}, not BPC).`);
     return;
  }
  
  let deductedItems = [];

  if (clearedGate === 'Gate 2') {
    console.log(`⚙️ [BOM Engine] Gate 2 cleared at ${siteName}. Deducting Steel & Fasteners.`);
    
    for (const item of memoryInventory) {
      if (['Steel Inventory', 'Fasteners', 'Consumables'].includes(item.category) && item.bomQty > 0) {
        const newQty = Math.max(0, item.qty - item.bomQty);
        item.qty = newQty; 
        
        await airtableWriteWithAutoDrop('Inventory', { 'Quantity on hand': newQty }, item.id);
        deductedItems.push(`${item.name} (-${item.bomQty})`);
      }
    }
  }
  
  if (clearedGate === 'Gate 4') {
    console.log(`⚙️ [BOM Engine] Gate 4 cleared at ${siteName}. Shifting Glass/Turf from Committed to Consumed.`);
    
    for (const item of memoryInventory) {
      if (['Glass', 'Turf'].includes(item.category) && item.bomQty > 0) {
        const newQty = Math.max(0, item.qty - item.bomQty);
        const newCommitted = Math.max(0, item.committed - item.bomQty);
        item.qty = newQty;
        item.committed = newCommitted;
        
        await airtableWriteWithAutoDrop('Inventory', { 
          'Quantity on hand': newQty,
          'Committed': newCommitted 
        }, item.id);
        deductedItems.push(`${item.name} (-${item.bomQty})`);
      }
    }
  }

  if (deductedItems.length > 0) {
    console.log(`✅ [BOM Engine] Successfully deducted: ${deductedItems.join(', ')}`);
    await checkLowStockRadar(CONFIG.meta.targetVerifiedPhone);
  }
}

async function reserveCourtBOM(siteName, dispatchTarget = null) {
  console.log(`📦 [BOM Engine] Deposit received for ${siteName}. Reserving materials in Committed pipeline.`);
  
  for (const item of memoryInventory) {
    if (item.bomQty > 0) {
      const newCommitted = item.committed + item.bomQty;
      item.committed = newCommitted;
      await airtableWriteWithAutoDrop('Inventory', { 'Committed': newCommitted }, item.id);
    }
  }

  await checkLowStockRadar(dispatchTarget || CONFIG.meta.targetVerifiedPhone);
}

async function checkLowStockRadar(dispatchTarget) {
  if (!dispatchTarget) return;
  const alerts = [];

  for (const item of memoryInventory) {
    const avail = item.qty - item.committed;
    if ((item.bomQty > 0 || item.leadTimeDays >= 30) && avail <= 2 && item.qty > 0) {
      alerts.push(`• *${item.name}:* ${Math.max(0, avail)} Avail (${item.leadTimeDays ? item.leadTimeDays + 'd lead time' : 'Reorder needed'})`);
    }
  }

  if (alerts.length > 0) {
    const alertCard = `⚠️ *TITAN OS | REORDER RADAR ALERT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Available buffer has reached critical threshold:\n\n` +
      alerts.slice(0, 5).join('\n') + `\n\n` +
      `👉 *Action:* Initiate supplier PO to protect forward installation runway.`;
    await sendWhatsAppMessage(dispatchTarget, alertCard);
  }
}

async function handleSpokenInventorySnapshot(dispatchTarget) {
  await refreshInventoryCache();
  
  if (!memoryInventory || memoryInventory.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Inventory cache is currently empty or updating.`);
    return;
  }

  const turf = memoryInventory.filter(i => (i.category || '').toLowerCase().includes('turf'));
  const glass = memoryInventory.filter(i => (i.category || '').toLowerCase().includes('glass'));
  const steel = memoryInventory.filter(i => (i.category || '').toLowerCase().includes('steel'));
  const lights = memoryInventory.filter(i => (i.category || '').toLowerCase().includes('light'));
  const keyConsumables = memoryInventory.filter(i => (i.category || '').toLowerCase().includes('consumable') && i.bomQty > 0);

  const formatLine = (item) => {
    const avail = Math.max(0, item.qty - item.committed);
    const commStr = item.committed > 0 ? ` (Comm: ${item.committed})` : '';
    return `• *${item.name}:* ${avail} Avail / ${item.qty} On Hand${commStr}`;
  };

  let card = `📦 *TITAN OS | YARD & INVENTORY SNAPSHOT*\n` +
             `━━━━━━━━━━━━━━━━━━━━\n`;

  if (turf.length > 0) {
    card += `🌱 *Turf Rolls & Kits:*\n` + turf.slice(0, 5).map(formatLine).join('\n') + `\n\n`;
  }

  if (glass.length > 0) {
    card += `🪟 *Glass Panes:*\n` + glass.slice(0, 3).map(formatLine).join('\n') + `\n\n`;
  }

  if (steel.length > 0) {
    card += `🏗️ *Steel & Frames:*\n` + steel.slice(0, 4).map(formatLine).join('\n') + `\n\n`;
  }

  if (lights.length > 0) {
    card += `💡 *LED Lighting:*\n` + lights.slice(0, 2).map(formatLine).join('\n') + `\n\n`;
  }

  if (keyConsumables.length > 0) {
    card += `🧪 *Key Consumables:*\n` + keyConsumables.slice(0, 3).map(formatLine).join('\n') + `\n\n`;
  }

  const lowStock = memoryInventory.filter(i => (i.bomQty > 0 || i.leadTimeDays >= 14) && (i.qty - i.committed) <= 2 && i.qty > 0);
  if (lowStock.length > 0) {
    card += `⚠️ *REORDER RADAR (Low Stock):*\n`;
    lowStock.slice(0, 5).forEach(i => {
      const avail = Math.max(0, i.qty - item.committed);
      card += `• *${i.name}:* ${avail} Avail (${i.leadTimeDays ? i.leadTimeDays + 'd lead time' : 'Reorder needed'})\n`;
    });
    card += `\n`;
  }

  card += `━━━━━━━━━━━━━━━━━━━━\n` +
          `📍 *Node:* Central Warehouse & Inventory\n` +
          `_Text /inv anytime for live yard status._`;

  await sendWhatsAppMessage(dispatchTarget, card.trim());
}

async function handleSpokenRoutingQuery(worker, fromPhone, dispatchTarget, callerIdentity) {
  const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Technician';

  // 1. Establish Origin
  const recentPin = lastDroppedCoordinates.get(fromPhone);
  let originStr = "655 Harvie Settlement Road, Unit 8, Orillia ON (Central Warehouse)";
  let hasLivePin = false;

  if (recentPin && (Date.now() - recentPin.timestamp < 12 * 60 * 60 * 1000)) {
    originStr = `${recentPin.lat.toFixed(6)}, ${recentPin.lon.toFixed(6)}`;
    hasLivePin = true;
  }

  // 2. Fetch Maintenance Assignments
  const allAssignments = await getCachedOpenAssignments(true);
  const workerAssignments = allAssignments.filter(a => {
    const wId = a.fields['Worker'];
    const isAssigned = Array.isArray(wId) ? wId.includes(worker?.id) : wId === worker?.id;
    const isMaintenance = a.fields['Assignment Type'] === 'Service' || (a.fields['Task Category'] || '').toLowerCase().includes('maintenance');
    return isAssigned && isMaintenance;
  });

  if (workerAssignments.length === 0) {
    await sendWhatsAppMessage(dispatchTarget, `🗺️ *TITAN OS | ROUTING*\nNo active maintenance jobs found for ${workerName}.`);
    return;
  }

  // 3. Resolve Site Locations
  const sites = await getCachedSites();
  const routePoints = [];

  for (const job of workerAssignments) {
    const siteIds = job.fields['Sites'] || job.fields['Site'] || [];
    const siteArray = Array.isArray(siteIds) ? siteIds : [siteIds];
    for (const sId of siteArray) {
        const jobSite = sites.find(s => s.id === sId);
        if (jobSite) {
          const coords = await resolveCoordinates(jobSite);
          if (coords) {
             routePoints.push({
                ticket: job.fields['Assignment ID'] ? `#${job.fields['Assignment ID']}` : 'WO',
                siteName: jobSite.fields['Site Name'],
                notes: (job.fields['Notes'] || '').split('\n')[0].substring(0, 50),
                lat: coords.lat,
                lon: coords.lon
             });
          }
        }
    }
  }

  if (routePoints.length === 0) {
      await sendWhatsAppMessage(dispatchTarget, `🗺️ *TITAN OS | ROUTING*\nFound ${workerAssignments.length} jobs, but could not resolve geospatial coordinates for them.`);
      return;
  }

  // 4. Gemini Spatial Optimization
  const prompt = `You are Titan OS Logistics. Optimize this driving route for ${workerName}.
  ORIGIN: ${originStr}
  STOPS: ${JSON.stringify(routePoints)}

  Calculate the most efficient order. Output a clean WhatsApp message strictly starting with "🗺️ *OPTIMIZED ROUTE FOR ${workerName.toUpperCase()}*"
  List the stops in order 1, 2, 3... with the site name, ticket number, and a brief note. Keep it highly concise.`;

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    };
    const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    let routingCard = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Route calculation failed.';

    if (!hasLivePin) {
       routingCard += `\n\n_Note: Route calculated from Central Warehouse. Drop a location pin to route from your current location._`;
    }

    await sendWhatsAppMessage(dispatchTarget, routingCard);
  } catch (err) {
    console.error('[Routing Engine Error]:', err.message);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to calculate intelligent route for your ${workerAssignments.length} jobs.`);
  }
}

// ====================================================================
// 14. CONVERSATIONAL TEXT & VOICE TRIAGE ENGINE
// ====================================================================

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
      responseMimeType: 'application/json'
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

  if (triage.intent === 'PURE_NOISE' || triage.intent === 'HISTORICAL_REFERENCE') return;

  if (triage.intent === 'INVENTORY_COUNT') {
    await executeInventoryCount(triage.inventory_counts, dispatchTarget, worker?.fields?.['Full Name'] || callerIdentity.name);
    return;
  }

  if (triage.intent === 'CREATE_SITES') {
    if (!isAuthorizedForFinance(callerIdentity)) {
        await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Your profile lacks permissions to create new sites.`);
        return;
    }
    await handleBulkSiteCreation(triage, dispatchTarget, fromPhone);
    return;
  }

  if (triage.intent === 'ORACLE_QUERY') {
    await handleOracleQuery(triage, dispatchTarget);
    return;
  }

  if (triage.intent === 'INVENTORY_QUERY') {
    await handleSpokenInventorySnapshot(dispatchTarget);
    return;
  }

  if (triage.intent === 'DOCUMENT_RETRIEVAL') {
    const targetQuery = triage.queried_court_name || triage.matched_site_name || triage.referenced_entity_name;
    await handleDocumentRetrieval({ transcript_en: targetQuery }, site, dispatchTarget);
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

  if (triage.intent === 'COURT_SPECS_QUERY') {
    const targetQuery = triage.queried_court_name || triage.matched_site_name || triage.referenced_entity_name;
    await handleSpokenSpecsQuery(targetQuery, site, dispatchTarget);
    return;
  }
  
  if (triage.intent === 'MAINTENANCE_QUERY') {
    await handleSpokenStatusQuery('all', site, dispatchTarget, true, true);
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
    if (!isAuthorizedForFinance(callerIdentity)) {
        await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Your profile (${callerIdentity.role}) lacks permissions to query QuickBooks.`);
        return;
    }
    await handleSpokenARLookup(triage.referenced_entity_name, dispatchTarget);
    return;
  }

  if (triage.intent === 'INVOICE_APPROVAL') {
    if (!isAuthorizedForFinance(callerIdentity)) {
        await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Action requires Finance permissions.`);
        return;
    }
    await handleInvoiceApproval(triage, dispatchTarget);
    return;
  }

  if (triage.intent === 'CREATE_INVOICE') {
    if (!isAuthorizedForFinance(callerIdentity)) {
        await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Action requires Finance permissions.`);
        return;
    }
    await handleInvoiceCreation(triage, dispatchTarget);
    return;
  }
  
  if (triage.intent === 'ACTIONABLE_STATE_CHANGE') {
    await handleActionableStateChange(triage, site, worker, callerIdentity, dispatchTarget, triage.transcript_en);
    return;
  }
  
  if (triage.intent === 'ASSET_TRANSFER') {
    await handleAssetTransfer(triage, site, worker, callerIdentity, dispatchTarget);
    return;
  }

  if (triage.intent === 'ASSET_QUERY') {
    await handleAssetQuery(triage, dispatchTarget);
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
      fromPhone,
      nlp: triage
    });
    return;
  }

  if (triage.intent === 'DARK_MATTER') {
    const senderName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Field Crew';
    const siteLabel = site?.fields?.['Site Name'] || triage.matched_site_name || 'Central Operations';

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

async function processMediaBatch(batch) {
  const { items, site, worker, dispatchTarget, fromPhone, indoorSite, callerIdentity } = batch;

  const hasVisualMedia = items.some(item => item.type === 'image' || item.type === 'video');
  const hasVideo = items.some(item => item.type === 'video');

  const batchText = items.map(i => i.caption || i.rawMessage?.text?.body || '').filter(Boolean).join(' ').trim();
  if (hasVisualMedia && !batchText && !site) {
    const errorCard = `⚠️ *TITAN OS | SITE UNKNOWN*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `I received your media, but I don't know which court you are at right now.\n\n` +
      `👉 *Action required:* Please drop a location pin or text the court name, then re-send the video.`;
    await sendWhatsAppMessage(dispatchTarget, errorCard);
    return;
  }

  const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';

  const cumulativeContext = {
    siteName: site?.fields?.['Site Name'] || 'Padel Court',
    workflowMode: currentMode,
    siteStatus: site?.fields?.['Site Status'] || 'ACTIVE',
    openTickets: site?.fields?.['Open Tickets'] || 0,
    clearedMilestones: site?.fields?.['Cleared Milestones'] || [],
    lastNote: site?.fields?.['Last Note'] || '',
    isIndoor: indoorSite,
    workerLanguage: worker?.fields?.['Language'] || 'English'
  };

  let storageResults = [];
  if (hasVisualMedia || items.some(i => i.type === 'audio' || i.type === 'voice')) {
    const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
    storageResults = await Promise.all(uploadPromises);
  }

  let targetedSiteOverride = null;

  if (hasVisualMedia && batchText.length > 3) {
      const triage = await triageSpokenOrTextNLP(batchText, false, []);
      if (triage && triage.intent === 'HISTORICAL_REFERENCE') return;
      
      if (triage && triage.queried_court_name) {
          const matched = await lookupSite(null, triage.queried_court_name);
          if (matched) targetedSiteOverride = matched;
      }
  }

  if (!hasVisualMedia) return;

  if (!hasVideo) {
    const visualTriage = await classifyVisualMediaIntent(items);
    if (visualTriage.media_category === 'FINANCIAL_RECEIPT') {
       return await handleFinancialReceiptBatch({ items, storageResults, visualTriage, worker, site, dispatchTarget, fromPhone, callerIdentity });
    }
    if (visualTriage.media_category === 'COMMERCIAL_LEAD') {
       return await handleCommercialLeadBatch({ items, storageResults, visualTriage, worker, dispatchTarget, fromPhone, callerIdentity });
    }
    if (visualTriage.media_category === 'FREIGHT_LOGISTICS') {
       return await handleFreightLogisticsBatch({ items, storageResults, visualTriage, worker, site, dispatchTarget, fromPhone, callerIdentity });
    }
    if (visualTriage.media_category === 'INVENTORY_COUNT') {
       const workerName = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Auditor';
       return await executeInventoryCount(visualTriage.inventory_counts, dispatchTarget, workerName);
    }
  }

  if (hasVideo) {
    const videoItem = items.find(item => item.type === 'video');
    const visualTruth = await inspectBlindVisualGroundTruth(videoItem, batchText, dispatchTarget, targetedSiteOverride, site);
    
    if (visualTruth.is_padel_court === false) return;
  }

  const forensicAudit = await evaluateCourtMediaBatch(items, cumulativeContext);
  let targetedSite = targetedSiteOverride || site;
  const courtLabel = targetedSite?.fields?.['Site Name'] || 'Assigned Court';
  const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || 'Installer';
  
  if (forensicAudit.defect_origin === 'FABRICATION' || 
      (forensicAudit.blockers_detected && forensicAudit.blockers_detected.some(b => /tab|jig|weld|hole|cut|offset|measurement|fabrication|shop|door/i.test(b)))) {
      
      const factoryPhones = '14379287172';
      const validVideo = items.find(i => i.type === 'video');
      let videoLink = null;
      if (validVideo && storageResults.length > 0) {
          const videoIndex = items.indexOf(validVideo);
          if (storageResults[videoIndex] && storageResults[videoIndex].signedUrl) {
              videoLink = storageResults[videoIndex].signedUrl;
          }
      }
      
      const toleranceAlert = `🏭 *TITAN OS | PRODUCTION TOLERANCE ALERT*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Defect Origin:* FABRICATION\n` +
        `📍 *Location:* ${courtLabel}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Issue Detected:*\n${forensicAudit.blockers_detected ? forensicAudit.blockers_detected.join('\n') : forensicAudit.summary}\n\n` +
        (videoLink ? `🎥 *Forensic Video Record:*\n${videoLink}\n\n` : '') +
        `_Action: Check active jig alignments and weld tolerances._`;
        
      console.log(`[Blameless Machine] Triggering Fabrication Alert for ${courtLabel}`);
      await fanOutToSubscribers(factoryPhones, toleranceAlert);
  }

  const siteMode = targetedSite?.fields?.['Workflow Mode'] || cumulativeContext.workflowMode || 'INSTALLATION';
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true });

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

  const checklist = forensicAudit.qa_checklist || {};
  const hasBlockers = (forensicAudit.blockers_detected && forensicAudit.blockers_detected.length > 0) ||
    checklist.doors_oriented_correctly === false;

  const validVideo = items.find(i => i.type === 'video');
  let videoLink = null;
  if (validVideo && storageResults.length > 0) {
      const videoIndex = items.indexOf(validVideo);
      if (storageResults[videoIndex] && storageResults[videoIndex].signedUrl) {
          videoLink = storageResults[videoIndex].signedUrl;
      }
  }

  if (siteMode === 'INSTALLATION') {
    const highestGate = forensicAudit.highest_gate ||
      (forensicAudit.verified_gates?.length ? Math.max(...forensicAudit.verified_gates) : 0);

    const progressPercent = Math.min(1.0, highestGate / TOTAL_GATES);
    const inProgressGates = forensicAudit.in_progress_gates || (forensicAudit.in_progress_gate ? [forensicAudit.in_progress_gate] : (highestGate < TOTAL_GATES ? [highestGate + 1] : []));
    
    const inProgressLabels = inProgressGates.map(g => `${g}. ${GATE_NAMES[g] || 'Task'}`).join(', ');
    const gateLabel = GATE_NAMES[highestGate] ? `${highestGate}. ${GATE_NAMES[highestGate]}` : `Gate ${highestGate}`;

    const cleanSummary = forensicAudit.summary || forensicAudit.transcript_en || 'Construction sweep recorded.';
    const compactGateStatus = inProgressLabels ? `${highestGate}. ${GATE_NAMES[highestGate] || 'Verified'} (${inProgressGates.join(' & ')} In Progress)` : gateLabel;

    const previouslyCleared = targetedSite?.fields?.['Cleared Milestones'] || [];
    const isNewMilestone = highestGate > 0 && !previouslyCleared.includes(`Gate ${highestGate}`);

    const newlyVerifiedGates = (forensicAudit.verified_gates || []).map(g => {
      const num = parseInt(String(g).replace(/\D/g, ''));
      return isNaN(num) ? String(g) : `Gate ${num}`;
    });

    if (highestGate > 0) {
      newlyVerifiedGates.push(`Gate ${highestGate}`);
    }

    let qaSection = `\n🔍 *PUNCH LIST QA:*\n`;
    if (Object.keys(checklist).length > 0) {
      if (checklist.anchor_bolts_fully_installed !== undefined) qaSection += `• Anchor Bolts: ${checklist.anchor_bolts_fully_installed ? '✅ Secured' : '⏳ Pending'}\n`;
      if (checklist.entrance_plates_installed !== undefined) qaSection += `• Entrance Plates: ${checklist.entrance_plates_installed ? '✅ Installed' : '⏳ Pending'}\n`;
      if (checklist.black_bolt_caps_installed !== undefined) qaSection += `• Black Bolt Caps: ${checklist.black_bolt_caps_installed ? '✅ Capped' : '⏳ Pending'}\n`;
      if (checklist.silicone_sealant_applied !== undefined) qaSection += `• Silicone: ${checklist.silicone_sealant_applied ? '✅ Applied' : '⏳ Pending'}\n`;
      if (checklist.doors_oriented_correctly !== undefined) qaSection += `• Doors: ${checklist.doors_oriented_correctly ? '✅ Right/Right' : '⚠️ Left Door Detected'}\n`;
      if (checklist.jobsite_is_clean !== undefined) qaSection += `• Jobsite Clean: ${checklist.jobsite_is_clean ? '✅ Cleared' : '🧹 Sweep Pending'}\n`;
    }

    let milestoneTimestamps = {};
    try {
      if (targetedSite?.fields?.['Milestone Timestamps']) {
        milestoneTimestamps = JSON.parse(targetedSite.fields['Milestone Timestamps']);
      }
    } catch (e) {}

    let velocityMessage = '';
    if (highestGate > 0 && !milestoneTimestamps[highestGate]) {
      milestoneTimestamps[highestGate] = new Date().toISOString();
    }

    if (highestGate >= TOTAL_GATES && milestoneTimestamps['1'] && isNewMilestone) {
      const start = new Date(milestoneTimestamps['1']);
      const end = new Date(milestoneTimestamps[highestGate]);
      const diffHrs = Math.abs(end - start) / 36e5;
      const days = Math.floor(diffHrs / 24);
      const hours = Math.round(diffHrs % 24);
      velocityMessage = `\n⏱️ *Build Velocity:* ${days} Days, ${hours} Hours (Gate 1 to Final)`;
    }

    if (targetedSite) {
      const allCleared = Array.from(new Set([...previouslyCleared, ...newlyVerifiedGates]));

      const updatePayload = {
        'Cleared Milestones': allCleared,
        'Current Gate': compactGateStatus,
        'Milestone Timestamps': JSON.stringify(milestoneTimestamps),
        'Last Note': `[SWEEP - ${workerName} at ${timeStr}]:\n${cleanSummary}`,
        'Last Intent': hasBlockers ? 'ACTION_REQUIRED' : 'MILESTONE_PROGRESS',
        'Blocker Active': hasBlockers
      };
      
      if (videoLink) {
        updatePayload['Latest Video Link'] = videoLink;
      }

      if (highestGate >= TOTAL_GATES && !hasBlockers) {
        updatePayload['Workflow Mode'] = 'MAINTENANCE';
        updatePayload['Site Status'] = 'ACTIVE';
      }

      await airtableWriteWithAutoDrop('Sites', updatePayload, targetedSite.id);

      if (isNewMilestone) {
        console.log(`🎾 [Joy Cannon Triggered] Firing Gate ${highestGate} for ${courtLabel}`);
        await fireInstallationJoyCannon(targetedSite, highestGate, workerName);
        
        if (highestGate === 2 || highestGate === 4) {
          await processMilestoneBOMDeduction(targetedSite, `Gate ${highestGate}`);
        }
      }
    }

    const cardHeader = hasBlockers
      ? `📋 *TITAN OS | QA CHECKLIST — GATE ${inProgressGates.join(', ')}*`
      : `🏗️ *TITAN OS | MILESTONE VERIFIED*`;

    let installCard = `${cardHeader}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏟️ *Court:* ${courtLabel}\n` +
      `👤 *Lead:* ${workerName}\n` +
      `📊 *Progress:* ${Math.round(progressPercent * 100)}% (${gateLabel})\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👁️ *Observation:*\n${forensicAudit.whatsapp_status_text || cleanSummary}\n` +
      qaSection +
      velocityMessage;

    if (weatherTripwires.summaryText) {
      installCard += `\n📋 *Weather Telemetry:*${weatherTripwires.summaryText}\n`;
    }

    installCard += hasBlockers
      ? `\n📋 *Punch list logged to Daily Assignments.*`
      : `\n✅ *Progress updated in Sites ledger.*`;

    await sendWhatsAppMessage(dispatchTarget, installCard);
    return;
  }

  const phaseMap = {
    'INTAKE_BASELINE': 'MAINTENANCE BASELINE',
    'COMPLETION_CLOSEOUT': 'SERVICE COMPLETED',
    'GENERAL_AUDIT': 'FACILITY AUDIT',
    'INSTALLATION_SWEEP': 'MILESTONE VERIFIED'
  };
  const uiPhaseTitle = phaseMap[forensicAudit.video_phase] || 'FIELD SWEEP';
  
  let actionItemsList = '';
  if (forensicAudit.action_items && forensicAudit.action_items.length > 0) {
      actionItemsList = `\n📋 *Action Items:*\n` + forensicAudit.action_items.map(a => `• ${a}`).join('\n');
  }

  let blockersList = '';
  if (forensicAudit.blockers_detected && forensicAudit.blockers_detected.length > 0) {
      blockersList = `\n⚠️ *Blockers / Defects:*\n` + forensicAudit.blockers_detected.map(b => `• ${b}`).join('\n');
  }
  
  if (targetedSite) {
      const updatePayload = {
        'Last Note': `[SWEEP - ${workerName} at ${timeStr}]:\n${forensicAudit.summary || 'Audit logged.'}`,
        'Last Intent': hasBlockers ? 'ACTION_REQUIRED' : 'OPERATIONAL',
        'Blocker Active': hasBlockers
      };
      
      if (videoLink) {
        updatePayload['Latest Video Link'] = videoLink;
      }
      
      await airtableWriteWithAutoDrop('Sites', updatePayload, targetedSite.id);
  }

  const genericCardHeader = `🏗️ *TITAN OS | ${uiPhaseTitle}*`;
  let replyCard = `${genericCardHeader}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏟️ *Court:* ${courtLabel}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `⏱️ *Verified:* ${timeStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👁️ *Observation:*\n${forensicAudit.whatsapp_status_text || forensicAudit.summary || 'Audit logged.'}\n` +
    actionItemsList + 
    blockersList;

  if (weatherTripwires.summaryText) replyCard += `\n\n${weatherTripwires.summaryText}`;
  
  await sendWhatsAppMessage(dispatchTarget, replyCard);
}

// ====================================================================
// 15. INGRESS DISPATCH CONTROLLER & WEBHOOKS
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

app.post('/webhook/gamecam', async (req, res) => {
  res.sendStatus(200);
});

// ====================================================================
// 15B. GMAIL PUB/SUB WEBHOOK INGESTION
// ====================================================================

app.post('/webhook/gmail', async (req, res) => {
  res.sendStatus(200);

  try {
    const email = await fetchLatestInboundEmail();
    if (!email) return;

    console.log(`[Gmail Webhook] Received inbound email from: ${email.from} | Subject: "${email.subject}"`);

    const fromMatch = email.from.match(/(.*?)\s*<(.+@.+?)>/) || [null, email.from, email.from];
    const senderName = fromMatch[1].replace(/['"]/g, '').trim() || 'Inbound Prospect';
    const senderEmail = fromMatch[2].trim();

    const sanitizeWA = (str) => String(str || '').replace(/[^\w\s@.,?!-]/g, ' ').replace(/\s+/g, ' ').trim();
    const safeName = sanitizeWA(senderName).slice(0, 30);
    const safeSubject = sanitizeWA(email.subject).slice(0, 50);
    const rawPreview = email.body ? email.body.slice(0, 600) : email.snippet;
    const safePreview = sanitizeWA(rawPreview);

    const filterDecision = await evaluateEmailActionability(email.subject, safePreview);
    if (!filterDecision.is_actionable) {
       console.log(`[Gmail Filter] 🛑 Dropped noise: ${email.subject} | Reason: ${filterDecision.reason}`);
       return; 
    }
    console.log(`[Gmail Filter] ✅ Passed actionable email: ${email.subject} | Reason: ${filterDecision.reason}`);
    
    const toMatch = email.to.match(/(.*?)\s*<(.+@.+?)>/) || [null, email.to, email.to];
    const aliasReceivedAt = toMatch[2] ? toMatch[2].trim() : (email.to || 'Unknown');

    let dispatchTarget = CONFIG.meta.targetVerifiedPhone;
    const lowerAlias = aliasReceivedAt.toLowerCase();
    
    if (robExecEnabled && (lowerAlias.includes('rob') || lowerAlias.includes('wharton') || lowerAlias.includes('rw'))) {
        dispatchTarget = ROB_WHARTON_PHONE;
    }

    let airtableRecordId = null;
    let ticketIdStr = 'NEW';
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const ticketNotes = `[INBOUND EMAIL LEAD]\nFrom: ${safeName} (${senderEmail})\nTo: ${aliasReceivedAt}\nSubject: ${email.subject}\n\nMessage Body Preview:\n"${rawPreview}"`;
      
      let targetSiteId = null;
      let targetTicket = null;
      
      const sites = await getCachedSites(true);
      const existingSite = sites.find(s => String(s.fields['Site Name']).toLowerCase() === String(safeName).toLowerCase());
      
      if (existingSite) {
         targetSiteId = existingSite.id;
         const openTickets = await getCachedOpenAssignments(true);
         targetTicket = openTickets.find(t => {
            const tSites = t.fields['Sites'] || [];
            const siteArray = Array.isArray(tSites) ? tSites : [tSites];
            return siteArray.includes(targetSiteId) && (t.fields['Assignment Type'] === 'Sales');
         });
      } 

      if (targetTicket) {
         airtableRecordId = targetTicket.id;
         ticketIdStr = targetTicket.fields['Assignment ID'] ? `#${targetTicket.fields['Assignment ID']}` : 'EXISTING';
         const existingNotes = targetTicket.fields['Notes'] || '';
         const appendedNotes = `${existingNotes}\n\n[NEW INBOUND EMAIL]:\n"${rawPreview}"`;
         await airtableWriteWithAutoDrop('Daily Assignments', { 'Notes': appendedNotes }, targetTicket.id);
      } else {
         const assignmentPayload = {
            'Date': todayStr,
            'Assignment Type': 'Sales',
            'Task Category': 'Commercial Sales',
            'Priority': 'High',
            'Status': 'Open',
            'Notes': ticketNotes
         };
         if (targetSiteId) assignmentPayload['Sites'] = [targetSiteId];
         const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
         airtableRecordId = createdAssignment?.id || null;
         ticketIdStr = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
      }
      
      invalidateAirtableCache('assignments');
    } catch (crmErr) {
      console.error('[Gmail CRM Log Error]:', crmErr.message);
    }

    userPendingEmailMap.set(dispatchTarget, {
      senderEmail,
      senderName,
      aliasReceivedAt,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      threadId: email.threadId,
      messageIdHeader: email.messageIdHeader,
      airtableRecordId,
      timestamp: Date.now()
    });

    const emailCard = `📬 *TITAN OS | INBOUND EMAIL*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *From:* ${safeName} (${senderEmail})\n` +
      `📥 *To Alias:* ${String(aliasReceivedAt).slice(0, 40)}\n` +
      `📌 *Subject:* ${safeSubject}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💬 *Body Preview:*\n"${safePreview}..."\n\n` +
      `👉 *To reply:* Reply to this message with a voice note or text. Titan OS will polish it and dispatch the email directly.\n\n` +
      `🎫 *Logged as Sales Ticket ${ticketIdStr}*`;

    await sendWhatsAppMessage(dispatchTarget, emailCard);
  } catch (err) {
    console.error('[Gmail Webhook Exception]:', err.message);
  }
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
    if (processedMessageMap.has(messageId)) return;
    processedMessageMap.set(messageId, Date.now());

    const callerIdentity = await resolveCallerIdentity(fromPhone);
    const sessionSiteId = userActiveSiteMap.get(fromPhone);
    let site = null;
    
    if (sessionSiteId) {
      const allSites = await getCachedSites();
      site = allSites.find(s => s.id === sessionSiteId) || null;
    }
    if (!site) {
      site = callerIdentity.siteRecord || await lookupSite(fromPhone);
    }

    const worker = callerIdentity.workerRecord || (fromPhone ? await lookupWorker(fromPhone) : null);

    // --- GMAIL REPLY INTERCEPTOR ---
    const pendingEmail = userPendingEmailMap.get(fromPhone);
    
    // SYSTEM COMMAND PREEMPTION SHIELD
    let isSystemCommand = false;
    if (message.type === 'text') {
      const bTxt = message.text?.body?.trim().toLowerCase() || '';
      if (bTxt.startsWith('/') || bTxt === 'help' || bTxt === '?') {
        isSystemCommand = true;
      }
    }

    if (pendingEmail && (Date.now() - pendingEmail.timestamp < 15 * 60 * 1000) && message.type !== 'location' && message.type !== 'interactive' && !isSystemCommand) {
      userPendingEmailMap.delete(fromPhone);
      let userReplyText = 'Thanks for reaching out.';
      
      if (message.type === 'text') {
        userReplyText = message.text?.body?.trim();
      } else if (message.type === 'audio' || message.type === 'voice') {
        const mediaId = message[message.type].id;
        const metaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
        const metaData = await metaRes.json().catch(() => ({}));
        if (metaData?.url) {
          const bufRes = await fetch(metaData.url, { headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` } });
          if (bufRes.ok) {
            const buf = Buffer.from(await bufRes.arrayBuffer());
            const triage = await triageSpokenOrTextNLP(null, true, [{buffer: buf, mimeType: message[message.type].mime_type || 'audio/ogg'}]);
            userReplyText = triage?.transcript_en || userReplyText;
          }
        }
      }

      const prompt = `You are Bob Burk from Bounce Padel. Turn this quick field tech note into a professional, courteous executive email reply.\n\nNote: "${userReplyText}"\n\nReturn ONLY the email body text.`;
      const geminiRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const gData = await geminiRes.json();
      const polishedBody = gData.candidates?.[0]?.content?.parts?.[0]?.text || userReplyText;

      const sent = await sendGmailReply({
        to: pendingEmail.senderEmail,
        fromAlias: pendingEmail.aliasReceivedAt,
        subject: pendingEmail.subject,
        body: polishedBody,
        threadId: pendingEmail.threadId,
        inReplyTo: pendingEmail.messageIdHeader
      });

      if (sent) {
        let ticketUpdateMsg = '';
        if (pendingEmail.airtableRecordId) {
          const openTickets = await getCachedOpenAssignments(true);
          const targetTicket = openTickets.find(t => t.id === pendingEmail.airtableRecordId);
          
          let updatedNotes = `[EMAIL CRM LOG - Replied via Titan OS]\nClient: ${pendingEmail.senderName}\nTitan OS Dispatched Reply:\n"${polishedBody}"`;
          
          if (targetTicket && targetTicket.fields['Notes']) {
             updatedNotes = `${targetTicket.fields['Notes']}\n\n[TITAN OS REPLY DISPATCHED]:\n"${polishedBody}"`;
          }

          const updatePayload = {
            'Status': 'In Progress',
            'Notes': updatedNotes
          };
          
          if (worker && worker.id) {
            updatePayload['Worker'] = [worker.id];
          }
          
          await airtableWriteWithAutoDrop('Daily Assignments', updatePayload, pendingEmail.airtableRecordId);
          invalidateAirtableCache('assignments');
          ticketUpdateMsg = `\n\n🎫 *Ticket updated to In Progress.*`;
        }
        await sendWhatsAppMessage(dispatchTarget, `✅ *Email Dispatched to ${pendingEmail.senderName}*\n\n"${polishedBody}"${ticketUpdateMsg}`);
      } else {
        await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to send email to ${pendingEmail.senderEmail}.`);
      }
      return;
    }
    // ---------------------------------


    // ROUTE 1: LOCATION PIN
    if (message.type === 'location') {
      sendWhatsAppReaction(dispatchTarget, messageId, '📍').catch(() => {});
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;
      lastDroppedCoordinates.set(fromPhone, { lat: userLat, lon: userLon, timestamp: Date.now() });

      const allSites = await getCachedSites();
      const nearby = [];
      for (const s of allSites) {
        const coords = await resolveCoordinates(s);
        if (coords) {
          const dist = haversineDistanceKm(userLat, userLon, coords.lat, coords.lon) * 1000;
          if (dist <= 800) nearby.push({ site: s, distance: dist });
        }
      }
      nearby.sort((a, b) => a.distance - b.distance);

      if (nearby.length === 0) {
        await sendWhatsAppMessage(dispatchTarget, `📍 Pin received (${userLat.toFixed(4)}, ${userLon.toFixed(4)}), but no Bounce Padel courts are located within 800m.`);
        return;
      }
      if (nearby.length > 1) {
        const buttons = nearby.slice(0, 3).map(n => ({
          id: `BIND_${n.site.id}`,
          title: (n.site.fields['Site Name'] || 'Court').slice(0, 20)
        }));
        await sendWhatsAppButtons(dispatchTarget, `📍 Multiple courts detected within 800m. Select your court:`, buttons);
        return;
      }
      await bindSiteContext(nearby[0].site, worker, callerIdentity, dispatchTarget, fromPhone, nearby[0].distance, userLat, userLon);
      return;
    }

    // ROUTE 2: INTERACTIVE BUTTON SELECTIONS
    if (message.type === 'interactive') {
      const btnId = message.interactive?.button_reply?.id || '';
      
      if (btnId.startsWith('BIND_')) {
        const sId = btnId.replace('BIND_', '');
        const allSites = await getCachedSites();
        const selSite = allSites.find(s => s.id === sId);
        if (selSite) {
          const pin = lastDroppedCoordinates.get(fromPhone) || { lat: null, lon: null };
          await bindSiteContext(selSite, worker, callerIdentity, dispatchTarget, fromPhone, 0, pin.lat, pin.lon);
        }
        return;
      }

      if (btnId.startsWith('QBO_CONVERT_')) {
        const parts = btnId.split('_');
        const estimateId = parts[2];
        const percentage = parts[3];
        await sendWhatsAppMessage(dispatchTarget, `✅ QuickBooks API called. Generated ${percentage}% Draw Invoice for Estimate #${estimateId}.`);
        return;
      }
      
      return;
    }

    // ROUTE 3: VOICE MEMO / AUDIO ONLY
    if (message.type === 'audio' || message.type === 'voice') {
      sendWhatsAppReaction(dispatchTarget, messageId, '🎧').catch(() => {});
      const mediaId = message[message.type].id;
      const mimeType = message[message.type].mime_type || 'audio/ogg';

      const metaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
      });
      const metaData = await metaRes.json().catch(() => ({}));

      if (metaData?.url) {
        const bufRes = await fetch(metaData.url, {
          headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
        });
        if (bufRes.ok) {
          const buf = Buffer.from(await bufRes.arrayBuffer());
          
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
              indoorSite: false,
              callerIdentity
            });
          }
          
          const queue = mediaDebounceQueues.get(queueKey);
          queue.items.push({
            buffer: buf,
            mimeType,
            messageId,
            caption: '',
            type: message.type,
            rawMessage: message
          });
          queue.site = site;
          queue.worker = worker;
          queue.callerIdentity = callerIdentity;

          if (queue.timer) clearTimeout(queue.timer);
          queue.timer = setTimeout(async () => {
            const currentBatch = mediaDebounceQueues.get(queueKey);
            mediaDebounceQueues.delete(queueKey);
            if (currentBatch && currentBatch.items.length > 0) {
               await triageVoiceMemoBatch(currentBatch.items, {}, worker, site, fromPhone, dispatchTarget, 'Dispatch', callerIdentity);
            }
          }, DEBOUNCE_DELAY_MS);
        }
      }
      return;
    }

    // ROUTE 4: TEXT COMMANDS & INTENT DISPATCH
    if (message.type === 'text') {
      const txt = message.text?.body?.trim() || '';
      const lTxt = txt.toLowerCase();
      
      if (lTxt === '/exec') {
          if (fromPhone === CONFIG.meta.targetVerifiedPhone || fromPhone === ROB_WHARTON_PHONE) {
              robExecEnabled = !robExecEnabled;
              await sendWhatsAppMessage(fromPhone, `👔 *TITAN OS | EXECUTIVE MODE*\n━━━━━━━━━━━━━━━━━━━━\nRob Wharton's Gmail-to-WhatsApp dispatch pipeline is now ${robExecEnabled ? '*ACTIVE 🟢*' : '*DISABLED 🔴*'}.`);
          }
          return;
      }

      if (lTxt.startsWith('/estimate') || lTxt.startsWith('/invoice')) {
          if (!isAuthorizedForFinance(callerIdentity)) {
              await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Action requires Finance permissions.`);
              return;
          }
          const triage = await triageSpokenOrTextNLP(txt, false, []);
          if (triage) {
              await handleInvoiceApproval(triage, dispatchTarget);
          } else {
              await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to parse estimate/invoice details. Please specify client name and percentage.`);
          }
          return;
      }

      if (lTxt.startsWith('/count')) {
          const triage = await triageSpokenOrTextNLP(txt, false, []);
          if (triage && triage.inventory_counts) {
              await executeInventoryCount(triage.inventory_counts, dispatchTarget, worker?.fields?.['Full Name'] || callerIdentity.name);
          } else {
              await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to parse inventory count. Please use format: /count [item] [qty] or send a clear voice note.`);
          }
          return;
      }

      if (lTxt.startsWith('/link ') || lTxt.startsWith('/l ')) {
        const targetQuery = txt.split(' ').slice(1).join(' ').trim();
        const matched = await lookupSite(null, targetQuery);
        if (matched) {
          await bindSiteContext(matched, callerIdentity.workerRecord, callerIdentity, fromPhone, fromPhone, 0, null, null);
        } else {
          await sendWhatsAppMessage(fromPhone, `⚠️ Could not find site "${targetQuery}" to link to.`);
        }
        return;
      }
      
      if (lTxt.startsWith('/t') || lTxt.startsWith('/status') || lTxt.startsWith('/s')) {
        const isTicketOnly = lTxt.startsWith('/t');
        const targetQuery = txt.split(' ').slice(1).join(' ').trim();
        await handleSpokenStatusQuery(targetQuery, site, fromPhone, isTicketOnly);
        return;
      }

      if (lTxt.startsWith('/help') || lTxt === 'help' || lTxt === '?') {
        let helpCard = `🤖 *TITAN OS COMMANDS*\n\n`;
        
        if (isAuthorizedForFinance(callerIdentity)) {
            helpCard += `*Finance & Executive:*\n` +
                        `• "what is my 30+ AR?" ➔ QBO lookup\n` +
                        `• /estimate or /invoice [client] [%] ➔ QBO approvals\n` +
                        `• /exec ➔ Toggle executive pipeline\n` +
                        `• /new ➔ Bulk court creation template\n` +
                        `• /count [item] [qty] ➔ Log inventory audit\n\n`;
        }
        
        helpCard += `*Field Operations:*\n` +
          `• Drop location pin ➔ Check-In & Set Route Origin\n` +
          `• /route ➔ Optimize route for maintenance jobs\n` +
          `• /status ➔ Active court gate & tickets\n` +
          `• /w or /weather ➔ Local wind & adhesive status\n` +
          `• Send video ➔ Milestone & QA Sweep\n` +
          `• Send audio ➔ Voice note / Parts request\n` +
          `• /inv ➔ Yard stock on hand & committed\n` +
          `• /docs ➔ Pull blueprints\n` +
          `• /t ➔ Open field tickets\n` +
          `• /specs ➔ Tech dimensions & CBSA rules`;
          
        await sendWhatsAppMessage(dispatchTarget, helpCard);
        return;
      }

      if (lTxt.startsWith('/route')) {
        await handleSpokenRoutingQuery(worker, fromPhone, dispatchTarget, callerIdentity);
        return;
      }
      
      if (lTxt.startsWith('/new')) {
        if (!isAuthorizedForFinance(callerIdentity)) {
           await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Your profile lacks permissions to create new sites.`);
           return;
        }
        const template = `🏟️ *TITAN OS | NEW SITE TEMPLATE*\n\n` +
          `To create one or multiple new courts, reply with a voice note or text using this format (you can skip any unknown details):\n\n` +
          `*Court Name(s):* (e.g., Fairgrounds Vaughan 1 and 2)\n` +
          `*Manufacturer:* (e.g., BPC, Mejor Set, AFP)\n` +
          `*Model Type:* (e.g., Outdoor Super Panoramic)\n` +
          `*Steel Color:* (e.g., Black, Blue)\n` +
          `*Turf Color:* (e.g., Blue, Green, Red, Black)\n` +
          `*Turf Supplier:* (e.g., Mondo, Real Turf, Padel Magic, House, Other)\n` +
          `*Foundation:* (e.g., Poured Concrete Slab)\n` +
          `*Deposit Status:* (e.g., 50% Deposit Received, Paid in Full)`;
        
        await sendWhatsAppMessage(dispatchTarget, template);
        return;
      }

      if (lTxt.startsWith('/inv') || lTxt.startsWith('/inventory') || lTxt.startsWith('/stock') || lTxt === 'inv' || lTxt === 'inventory' || lTxt === 'stock') {
        await handleSpokenInventorySnapshot(dispatchTarget);
        return;
      }

      if (lTxt.startsWith('/docs') || lTxt.startsWith('/plan')) {
        const targetQuery = txt.split(' ').slice(1).join(' ').trim();
        await handleDocumentRetrieval({ transcript_en: targetQuery }, site, dispatchTarget);
        return;
      }

      if (lTxt.startsWith('/weather') || lTxt.startsWith('/w')) {
        if (!site) {
          await sendWhatsAppMessage(dispatchTarget, `⚠️ Drop a pin first to lock your active court, or ask "What's the weather at [Court Name]?"`);
          return;
        }
        const coords = await resolveCoordinates(site);
        if (coords) {
          const w = await getHyperlocalWeather(coords.lat, coords.lon);
          await sendWhatsAppMessage(dispatchTarget, `🌤️ *WEATHER | ${site.fields['Site Name']}*${evaluateWeatherTripwires(w).summaryText}`);
        } else {
          await sendWhatsAppMessage(dispatchTarget, `📍 No coordinates locked for ${site.fields['Site Name']} to check weather.`);
        }
        return;
      }

      if (lTxt.startsWith('/r') || lTxt.startsWith('/readiness') || lTxt.startsWith('/gate') || lTxt.startsWith('/g')) {
        const targetQuery = txt.split(' ').slice(1).join(' ').trim();
        await handleSpokenReadinessQuery(targetQuery, site, dispatchTarget);
        return;
      }

      if (lTxt.startsWith('/ar')) {
        if (!isAuthorizedForFinance(callerIdentity)) {
           await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Your profile lacks permissions to query QuickBooks.`);
           return;
        }
        const targetQuery = txt.split(' ').slice(1).join(' ').trim();
        await handleSpokenARLookup(targetQuery, dispatchTarget);
        return;
      }

      if (lTxt.startsWith('/specs') || lTxt.startsWith('/border') || lTxt.startsWith('/carm') || /carm|border|pars|paps|customs/i.test(lTxt)) {
        const handled = handleTechnicalSpecsQuery(txt, dispatchTarget);
        if (handled) return;
      }

      const triage = await triageSpokenOrTextNLP(txt, false, []);
      if (triage) {
        if (triage.intent === 'INVENTORY_COUNT') {
          await executeInventoryCount(triage.inventory_counts, dispatchTarget, worker?.fields?.['Full Name'] || callerIdentity.name);
          return;
        }
        if (triage.intent === 'CREATE_SITES') {
          if (!isAuthorizedForFinance(callerIdentity)) {
             await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Your profile lacks permissions to create new sites.`);
             return;
          }
          await handleBulkSiteCreation(triage, dispatchTarget, fromPhone);
          return;
        }
        if (triage.intent === 'ORACLE_QUERY') {
          await handleOracleQuery(triage, dispatchTarget);
          return;
        }
        if (triage.intent === 'DOCUMENT_RETRIEVAL') {
          const targetQuery = triage.queried_court_name || triage.matched_site_name || triage.referenced_entity_name;
          await handleDocumentRetrieval({ transcript_en: targetQuery }, site, dispatchTarget);
          return;
        }
        if (triage.intent === 'INVENTORY_QUERY') {
          await handleSpokenInventorySnapshot(dispatchTarget);
          return;
        }
        if (triage.intent === 'AR_LOOKUP') {
          if (!isAuthorizedForFinance(callerIdentity)) {
              await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Your profile lacks permissions to query QuickBooks.`);
              return;
          }
          await handleSpokenARLookup(triage.referenced_entity_name, dispatchTarget);
          return;
        }
        if (triage.intent === 'INVOICE_APPROVAL') {
          if (!isAuthorizedForFinance(callerIdentity)) {
              await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Action requires Finance permissions.`);
              return;
          }
          await handleInvoiceApproval(triage, dispatchTarget);
          return;
        }
        if (triage.intent === 'CREATE_INVOICE') {
          if (!isAuthorizedForFinance(callerIdentity)) {
              await sendWhatsAppMessage(dispatchTarget, `⚠️ Unauthorized. Action requires Finance permissions.`);
              return;
          }
          await handleInvoiceCreation(triage, dispatchTarget);
          return;
        }
        if (triage.intent === 'TICKET_UPDATE') {
          await handleTicketOrLeadUpdate({
            rawText: txt,
            entityName: triage.referenced_entity_name || triage.queried_court_name,
            explicitTicketId: triage.referenced_ticket_id || triage.ticket_id,
            worker,
            dispatchTarget,
            fromPhone,
            nlp: triage
          });
          return;
        }
        if (triage.intent === 'ASSET_QUERY') {
          await handleAssetQuery(triage, dispatchTarget);
          return;
        }
        if (triage.intent === 'COURT_SPECS_QUERY') {
          const targetQuery = triage.queried_court_name || triage.matched_site_name || triage.referenced_entity_name;
          await handleSpokenSpecsQuery(targetQuery, site, dispatchTarget);
          return;
        }
        if (triage.intent === 'MAINTENANCE_QUERY') {
          await handleSpokenStatusQuery('all', site, dispatchTarget, true, true);
          return;
        }
      }

      return;
    }

    // ROUTE 5: VIDEO & IMAGE FORENSIC EVALUATION
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    
    if (isVideo || isImage) {
      const mediaObj = message[message.type];
      const mediaId = mediaObj.id;
      const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg');
      const caption = mediaObj.caption || '';

      sendWhatsAppReaction(dispatchTarget, messageId, isVideo ? '🎥' : '🧾').catch(() => {});

      const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
      });
      const metaMediaData = await metaMediaRes.json().catch(() => ({}));

      if (!metaMediaRes.ok || !metaMediaData?.url) return;

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
          indoorSite: false,
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

          await processMediaBatch(currentBatch);
        } catch (batchErr) {
          console.error('[Debouncer Batch Error]:', batchErr);
        }
      }, DEBOUNCE_DELAY_MS);

      return;
    }

  } catch (err) {
    console.error('[Runtime Exception in /webhook]:', err);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: '6.0.19' });
});

// ====================================================================
// 16. META WABA INITIALIZATION SCRIPT
// ====================================================================
async function autoSubscribeMetaWebhook() {
  const token = CONFIG.meta.accessToken;
  if (!token) {
    console.warn('[Meta Handshake] No META_ACCESS_TOKEN configured in environment.');
    return;
  }

  const targetPhone = CONFIG.meta.targetVerifiedPhone;
  const discoveredWabaIds = new Set();
  if (CONFIG.meta.wabaId) discoveredWabaIds.add(String(CONFIG.meta.wabaId).trim());

  try {
    const debugRes = await fetch(`${CONFIG.meta.graphApiUrl}/debug_token?input_token=${token}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (debugRes.ok) {
      const debugData = await debugRes.json();
      const scopes = debugData?.data?.granular_scopes || [];
      for (const scope of scopes) {
        if (scope.scope?.includes('whatsapp_business') && Array.isArray(scope.target_ids)) {
          scope.target_ids.forEach(id => discoveredWabaIds.add(String(id)));
        }
      }
    }
  } catch (e) {
    console.warn('[Meta Handshake] Debug token inspection note:', e.message);
  }

  const businessCandidates = ['34682330288078617'];
  try {
    const bizRes = await fetch(`${CONFIG.meta.graphApiUrl}/me/businesses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (bizRes.ok) {
      const bizData = await bizRes.json();
      (bizData?.data || []).forEach(b => businessCandidates.push(b.id));
    }
  } catch (e) {}

  for (const bId of businessCandidates) {
    for (const endpoint of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
      try {
        const wRes = await fetch(`${CONFIG.meta.graphApiUrl}/${bId}/${endpoint}?fields=id,name`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (wRes.ok) {
          const wData = await wRes.json();
          (wData?.data || []).forEach(w => discoveredWabaIds.add(String(w.id)));
        }
      } catch (e) {}
    }
  }

  console.log(`📡 [Meta Handshake] Discovered WABA Candidate IDs: [${Array.from(discoveredWabaIds).join(', ') || 'None'}]`);

  let matchedPhone = false;
  for (const wabaId of discoveredWabaIds) {
    try {
      const pRes = await fetch(`${CONFIG.meta.graphApiUrl}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (pRes.ok) {
        const pData = await pRes.json();
        const numbers = pData?.data || [];
        for (const num of numbers) {
          const cleanDisplay = (num.display_phone_number || '').replace(/\D/g, '');
          if (cleanDisplay.includes(targetPhone) || targetPhone.includes(cleanDisplay) || num.id === CONFIG.meta.phoneNumberId) {
            CONFIG.meta.phoneNumberId = num.id;
            CONFIG.meta.wabaId = wabaId;
            matchedPhone = true;
            console.log(`📱 [Meta Handshake] Matched verified number +1 289-221-7329 -> Active Phone Number ID: ${num.id} (WABA: ${wabaId})`);
            break;
          }
        }
      }

      const subRes = await fetch(`${CONFIG.meta.graphApiUrl}/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const subData = await subRes.json();
      console.log(`📡 [Meta Handshake] Subscribed App to WABA ${wabaId}:`, subData);
    } catch (err) {
      console.warn(`[Meta Handshake] Note for WABA ${wabaId}:`, err.message);
    }
  }

  if (!matchedPhone && CONFIG.meta.phoneNumberId) {
    try {
      const vRes = await fetch(`${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}?fields=id,display_phone_number,verified_name`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        console.log(`📱 [Meta Handshake] Active Phone ID ${vData.id} verified: ${vData.display_phone_number} (${vData.verified_name || 'Active'})`);
      }
    } catch (e) {}
  }
}

// Start the Friday Newsletter Cron
startFridayNewsletterCron();

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================================`);
  console.log(`🚀 TITAN OS V6.0.19 RUNNING ON PORT ${PORT}`);
  console.log(`====================================================================`);
  
  if (!global.supabase) {
    global.supabase = createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.serviceRoleKey,
      { auth: { persistSession: false } }
    );
  }

  await autoSubscribeMetaWebhook();

  try {
    await getCachedSites();
    await getCachedWorkers();
    await getCachedContacts();
    await getCachedOpenAssignments();
    await refreshInventoryCache();
    await syncOracleDocs();
  } catch (err) {}
});

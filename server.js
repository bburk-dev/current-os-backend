try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const crypto = require('crypto');

// ============================================================================
// ENVIRONMENT VARIABLES & AUTO-SANITIZATION
// ============================================================================
const PORT = process.env.PORT || 3000;
const META_VERIFY_TOKEN = (process.env.META_VERIFY_TOKEN || '').trim();
const META_APP_SECRET = (process.env.META_APP_SECRET || '').trim();

// Auto-strip quotes, whitespace, and accidental "Bearer " prefixes
const rawToken = process.env.META_ACCESS_TOKEN || '';
const META_ACCESS_TOKEN = rawToken.replace(/^Bearer\s+/i, '').replace(/["'\r\n\t]/g, '').trim();

const rawPhoneId = process.env.META_PHONE_NUMBER_ID || '';
const META_PHONE_NUMBER_ID = rawPhoneId.replace(/["'\r\n\t]/g, '').trim();

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_BUCKET = (process.env.SUPABASE_BUCKET || 'inbound-media').trim();

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const AIRTABLE_API_KEY = (process.env.AIRTABLE_API_KEY || '').trim();
const AIRTABLE_BASE_ID = (process.env.AIRTABLE_BASE_ID || '').trim();

const app = express();

// Capture raw body for timing-safe HMAC SHA-256 verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// In-memory sequential FIFO task queue to eliminate race conditions
let taskQueue = Promise.resolve();

// ============================================================================
// SUBSYSTEM 1: META GRAPH API CLIENT (WITH DETAILED LOGGING)
// ============================================================================
async function sendWhatsAppMessage(to, text) {
  try {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const response = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { body: text }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[META API ERROR] HTTP ${response.status} Message dispatch failed:`, errorText);
    }
  } catch (err) {
    console.error('[META API] Network error during dispatch:', err);
  }
}

async function downloadMetaMedia(mediaId) {
  const metaUrlRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
  });
  
  if (!metaUrlRes.ok) {
    const errorDetail = await metaUrlRes.text();
    console.error(`[META MEDIA RESOLVE ERROR] HTTP ${metaUrlRes.status}:`, errorDetail);
    throw new Error(`Failed to resolve media URL for ID: ${mediaId} -${errorDetail}`);
  }
  
  const metaUrlData = await metaUrlRes.json();
  const directUrl = metaUrlData.url;
  const mimeType = metaUrlData.mime_type;

  const mediaRes = await fetch(directUrl, {
    headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
  });

  if (!mediaRes.ok) {
    const streamError = await mediaRes.text();
    console.error(`[META CDN STREAM ERROR] HTTP ${mediaRes.status}:`, streamError);
    throw new Error(`Failed to stream media bytes from Meta CDN`);
  }

  const arrayBuffer = await mediaRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mimeType
  };
}

// ============================================================================
// SUBSYSTEM 2: SUPABASE PRIVATE STORAGE ENGINE
// ============================================================================
async function uploadToSupabase(buffer, mimeType) {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').split(';')[0] || 'bin';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `${year}/${month}/${fileName}`;

  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': mimeType,
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Supabase upload failed: ${err}`);
  }

  const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${filePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: 604800 })
  });

  let signedUrl = '';
  if (signRes.ok) {
    const signData = await signRes.json();
    signedUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;
  }

  return {
    storagePath: filePath,
    signedUrl: signedUrl
  };
}

// ============================================================================
// SUBSYSTEM 3: GEMINI 2.5 FLASH EVALUATOR (FULL INDUSTRIAL GOD SCHEMA)
// ============================================================================
async function evaluateFieldSubmission({ mediaBuffer, mimeType, captionText, workflowMode, siteName }) {
  const parts = [];

  if (mediaBuffer && mimeType) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: mediaBuffer.toString('base64')
      }
    });
  }

  if (captionText) {
    parts.push({
      text: `Worker Caption / Field Transcript: "${captionText}"`
    });
  }

  const prompt = `
You are Titan OS: the deterministic, uncompromising forensic auditor for professional Padel court engineering and facility operations.
Current Site: ${siteName || 'BPC Court'}
Workflow Mode: ${workflowMode || 'INSTALLATION'}

================================================================================
SECTION 1: THE 12 GOD SCHEMA INSTALLATION GATES & PHYSICAL ACCEPTANCE TOLERANCES
================================================================================

GATE 1: Foundation / Slab Preparation
- Scope: Monolithic reinforced C25/30 concrete slab or perimeter ring beam (300mm x 300mm).
- Physical Criteria: Laser-level variance must be strictly within ±3mm across any 3m straightedge (EN 14877). Cured, dry, uniform matte gray finish. Anchor stud drill holes cleared of dust.
- Blocker / Failure Triggers: Standing water, wet/dark cement patches, active formwork, unlevel shim stacks, curing cracks >0.2mm, or wet self-leveling compound.
- Sequential Rule: If Gate 1 is incomplete, uncured, or failing, ALL DOWNSTREAM GATES ARE BLOCKED.

GATE 2: Steel Frame - Bottom
- Scope: Structural perimeter columns, upright posts, and base mounting plates.
- Physical Criteria: Base plates (10-12mm thickness) seated flat on concrete; high-density EPDM/neoprene thermal/acoustic isolation pads installed between base plate and slab; M16/M12 stainless or galvanized mechanical/chemical anchor studs torqued with double-nut or nylon locking nut assemblies; columns plumb within ±0.5 degrees.
- Blocker / Failure Triggers: Missing washers/nuts, loose anchors, missing neoprene isolation pads, rusted field welds, misaligned vertical columns.

GATE 3: Steel Frame - Top
- Scope: Upper structural ring beam, crossbeams, upper corner gussets, and floodlight brackets.
- Physical Criteria: Overhead horizontal perimeter beams bolted rigid; corner gusset plates secured; cross-diagonal court measurements square within 10mm across 20m x 10m footprint; floodlight mounting brackets pre-aligned; glass seating brackets/tabs aligned.
- Blocker / Failure Triggers: Misaligned glass support tabs or brackets, twisted ring beams, missing splice bolts, structural sway under lateral load.
- Sequential Rule: If frame tabs or uprights are misaligned, Glass and all downstream surface gates CANNOT be verified.

GATE 4: Lower Mesh
- Scope: Lower perimeter electro-welded wire mesh panels.
- Physical Criteria: 3m x 2m panels, 50mm x 50mm x 4mm steel wire gauge; bolted flush against frame uprights; anti-injury rounded countersunk fasteners with nylon protective caps; uniform panel seam gaps.
- Blocker / Failure Triggers: Protruding sharp wire tails, warped/bowed mesh, missing clamp bolts, vibration rattle.

GATE 5: Upper Mesh
- Scope: Upper wire mesh modules positioned above the 3m glass line (reaching 4m total height on rear walls and extending 2m on side walls).
- Physical Criteria: Mesh modules rigidly bolted to upper perimeter steel; flush planar alignment with lower frame; zero deflection under point load.
- Blocker / Failure Triggers: Sagging mesh sections, loose upper brackets, missing splice fasteners.

GATE 6: Glass
- Scope: Tempered safety glass wall panels (10mm or 12mm thickness, EN 12150-1 compliant, 18 panels total).
- Physical Criteria: Panes seated upon continuous EPDM rubber setting blocks; stainless steel countersunk clamp pucks with polyethylene isolation bushings; 2mm to 3mm uniform thermal expansion gap between adjacent panes; planar flush step variance <1mm; STRICTLY ZERO direct steel-to-glass contact.
- Blocker / Failure Triggers: Direct metal-to-glass contact, chipped pane edges, missing isolation gaskets, uneven pane heights, misaligned frame tabs preventing pane seating.

GATE 7: Silicone
- Scope: Weatherproofing and structural perimeter sealing.
- Physical Criteria: Neutral-cure, high-modulus UV-resistant structural silicone applied continuously along glass-to-frame junctions and perimeter expansion joints; tooled smooth concave finish; lower weeping holes left unobstructed for drainage.
- Blocker / Failure Triggers: Clogged drainage weep-holes, smeared silicone, air bubbles, voids, unsealed exterior pane edges.

GATE 8: Turf
- Scope: Synthetic monofilament polyethylene padel turf carpet (10-12mm pile height).
- Physical Criteria: Carpet rolls fully unrolled, acclimated, and tension-stretched; seams joined using 300mm geotextile seam tape and 2-part polyurethane adhesive (applied at 0.8-1.0 kg/m); perimeter trimmed flush to kickplate; regulation 5cm white game lines strictly inlaid with adhesive tape (NEVER painted).
- Blocker / Failure Triggers: Carpet bubbles, wrinkles, curling seam edges, adhesive bleeding through fibers, painted lines.

GATE 9: Sand
- Scope: Kiln-dried, washed, rounded quartz silica sand infill (0.2-0.8mm grain size, >=98% SiO2).
- Physical Criteria: Infill rate of 3-4 kg/m2 (approx. 800-1200kg total per court); mechanically cross-brushed into turf until carpet pile stands vertically; uniform green court appearance with zero exposed carpet backing and zero sand accumulation mounds.
- Blocker / Failure Triggers: Sand dunes/heaps, damp sand clumping, unbrushed turf fibers lying flat, uneven infill depth.

GATE 10: Net Posts
- Scope: Center net post assemblies and cable tensioning mechanism.
- Physical Criteria: 80mm x 80mm steel center posts bolted plumb into concrete slab receivers; internal ratchet tension winch installed with removable crank handle; brass/nylon cable guide roller seated.
- Blocker / Failure Triggers: Loose post base anchors, stripped ratchet teeth, missing cable roller guide, post deflection under tension.

GATE 11: Net
- Scope: Regulation competition padel net and center strap.
- Physical Criteria: Knotless 45mm x 45mm mesh with heavy-duty PVC headband; 6mm plastic-coated galvanized steel cable; height measured at center exactly 88cm (±0.5cm), height at posts exactly 92cm (±0.5cm); heavy-duty polyester center strap bolted to anchor bolt in slab.
- Blocker / Failure Triggers: Net sagging below 87.5cm at center, missing center anchor strap, frayed tension cable.

GATE 12: Site Cleanliness & Final Walkthrough
- Scope: Post-construction turnover and commissioning cleanliness.
- Physical Criteria: Court surface 100% vacuumed and cleared of debris; perimeter 2m safety zone completely free of tools, pallets, scrap turf, silicone tubes, and silica bags; glass panes cleaned of finger marks, suction cup rings, and dust.
- Blocker / Failure Triggers: ANY active tools, orange buckets, rubbish, scrap material, or equipment boxes on or within 2m of the court.

================================================================================
SECTION 2: FORENSIC EVALUATION CONSTRAINTS
================================================================================

1. STRICT FOREGROUND ISOLATION (ZERO BACKGROUND BLEED):
   - Evaluate ONLY the specific padel court located in the immediate foreground under active inspection.
   - COMPLETELY IGNORE all finished courts, adjacent installations, or background club amenities visible in the frame.
   - DO NOT credit this court with glass, turf, lights, net, or frame members that belong to background courts.

2. PHYSICAL SEQUENCE HIERARCHY:
   - Padel construction follows an absolute physical dependency order:
     Foundation -> Steel Frame Bottom -> Steel Frame Top -> Lower/Upper Mesh -> Glass -> Silicone -> Turf -> Sand -> Net Posts -> Net -> Cleanliness.
   - If an upstream milestone is missing, blocked, uncured, or flagged with blockers, downstream milestones CANNOT be verified.
   - If you state that a component cannot be installed (e.g. "tabs misaligned, preventing glass installation"), you MUST add that component and all subsequent gates to "blocked_milestones".

3. SITE CLEANLINESS (GATE 12) TRANSIENT OVERRIDE:
   - If an orange bucket, hand tools, drill boxes, trash, or uninstalled supplies are visible on the court surface, Gate 12 MUST be added to "blocked_milestones" and flagged under "needs_attention".

4. MULTI-WORKFLOW INTENT ROUTING:
   - Mode INSTALLATION: Verify milestone progression and flag structural blockers. Action intent is typically MILESTONE_PROGRESS or HAZARD_BLOCKER.
   - Mode MAINTENANCE: Detect physical asset degradation (chipped glass, torn turf seams, loose bolts, mesh rust, silicone failure). Action intent is MAINTENANCE_DISPATCH or HAZARD_BLOCKER.
   - Mode SPOT_VISIT / INOC: Perform quality audit on net tension, sand distribution, and cleanliness.
   - Mode JOY CANNON (Client Concierge): Classify inbound client requests as CLIENT_REFERRAL (referrals/new court builds), MAINTENANCE_DISPATCH (repair requests), or SUPPLY_REQUEST (balls, nets, accessories).

================================================================================
SECTION 3: MANDATORY JSON OUTPUT SCHEMA
================================================================================

Output raw JSON conforming strictly to this structure:
{
  "status_observed": "ACTION_REQUIRED" | "VERIFIED" | "IN_PROGRESS",
  "action_intent": "MILESTONE_PROGRESS" | "HAZARD_BLOCKER" | "CLIENT_REFERRAL" | "MAINTENANCE_DISPATCH" | "SUPPLY_REQUEST",
  "verified_milestones": [
    "Exact string matches from the 12 Gates that are 100% physically complete on the FOREGROUND court only"
  ],
  "blocked_milestones": [
    "Exact string matches from the 12 Gates that CANNOT proceed or are prevented due to upstream failures, unlevel cement, tab misalignments, or site clutter"
  ],
  "needs_attention": [
    "Specific physical blockers, defects, misalignments, or debris requiring action"
  ],
  "site_conditions": "Objective summary of lighting, dry/wet slab condition, weather, and active site clutter",
  "notes": "Forensic, factual description of what is physically present and observed in the footage"
}
`;

  parts.push({ text: prompt });

  const response = await fetch(`// ============================================================================
// SUBSYSTEM 4: STATE MACHINE, RESILIENT BOUNCER & AIRTABLE INTEGRATION
// ============================================================================
async function airtableWrite(tableName, recordId, fields, method = 'PATCH') {
  let activeFields = { ...fields };
  const url = recordId 
    ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`
    : `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method: recordId ? method : 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: activeFields })
    });

    if (res.ok) {
      return await res.json();
    }

    if (res.status === 422) {
      const errResponse = await res.json();
      const message = errResponse.error?.message || '';
      console.warn(`[AIRTABLE 422] ${tableName} write failure: ${message}`);

      // Auto-Drop incompatible or computed fields
      const fieldMatch = message.match(/field\s+["\\]*([^"\\]+)["\\]*/i) || message.match(/column\s+["\\]*([^"\\]+)["\\]*/i);
      if (fieldMatch && fieldMatch[1] && activeFields[fieldMatch[1]] !== undefined) {
        console.warn(`[AUTO-HEALER] Dropping incompatible field: "${fieldMatch[1]}" and retrying...`);
        delete activeFields[fieldMatch[1]];
        continue;
      }
    }

    const unhandledErr = await res.text();
    console.error(`[AIRTABLE FATAL] ${tableName}:`, unhandledErr);
    break;
  }
  return null;
}

/**
 * Robust Worker Bouncer: Matches phone digits with or without leading '+'
 */
async function lookupWorker(phone) {
  const cleanDigits = phone.replace(/[^0-9]/g, '');
  const withPlus = `+${cleanDigits}`;
  
  const filterFormula = `OR(
    {Phone E164} = '${cleanDigits}',
    {Phone E164} = '${withPlus}',
    {WhatsApp Number} = '${cleanDigits}',
    {WhatsApp Number} = '${withPlus}'
  )`;

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Worker?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
  });

  if (res.ok) {
    const data = await res.json();
    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      const activeRaw = record.fields['Active'];
      const isActive = activeRaw === true || activeRaw === 1 || String(activeRaw).toLowerCase() === 'true';

      return {
        id: record.id,
        name: record.fields['Full Name'] || 'Worker',
        active: isActive,
        role: record.fields['Role'] || 'Installer',
        defaultSite: record.fields['Default Project']?.[0]
      };
    }
  } else {
    console.error('[AIRTABLE WORKER QUERY ERROR]:', res.status, await res.text());
  }
  return null;
}

async function resolveSite(chatId, siteOverrideName) {
  const cleanDigits = chatId ? chatId.replace(/[^0-9]/g, '') : '';
  const withPlus = `+${cleanDigits}`;

  let filterFormula = siteOverrideName 
    ? `{Site Name} = '${siteOverrideName}'`
    : `OR({WhatsApp Group ID} = '${chatId}', {WhatsApp Group ID} = '${cleanDigits}', {WhatsApp Group ID} = '${withPlus}')`;

  let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  let res = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
  
  if (res.ok) {
    let data = await res.json();
    if (data.records && data.records.length > 0) return data.records[0];
  }

  // Fallback to latest active site for direct messaging tests
  const fallbackUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sites?maxRecords=1&sort[0][field]=Site%20Name&sort[0][direction]=desc`;
  const fallbackRes = await fetch(fallbackUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
  if (fallbackRes.ok) {
    const data = await fallbackRes.json();
    return data.records?.[0] || null;
  }
  return null;
}

async function handleIncomingMessage(message, metadata) {
  const senderNumber = message.from;
  const worker = await lookupWorker(senderNumber);

  // 1. Worker Bouncer
  if (!worker || !worker.active) {
    console.warn(`[BOUNCER] Unauthorized access attempt: ${senderNumber}`);
    await sendWhatsAppMessage(senderNumber, '⛔ *Titan OS Access Denied:* Your phone number is not registered or active in the authorized worker registry.');
    return;
  }

  const messageType = message.type;
  const textContent = message.text?.body?.trim() || message.caption?.trim() || '';
  let siteRecord = await resolveSite(senderNumber);

  // 2. Headless Slash Command Engine
  if (textContent.startsWith('/')) {
    const parts = textContent.split(' ');
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    if (command === '/link') {
      const targetSite = await resolveSite(null, arg);
      if (targetSite) {
        await airtableWrite('Sites', targetSite.id, { 'WhatsApp Group ID': senderNumber });
        await sendWhatsAppMessage(senderNumber, `✅ *Site Linked:* Chat successfully bound to *${targetSite.fields['Site Name']}*.`);
      } else {
        await sendWhatsAppMessage(senderNumber, `⚠️ *Site Not Found:* Could not locate site named "${arg}".`);
      }
      return;
    }

    if (command === '/mode') {
      const allowedModes = ['INSTALLATION', 'MAINTENANCE', 'SPOT_VISIT'];
      const targetMode = arg.toUpperCase();
      if (allowedModes.includes(targetMode) && siteRecord) {
        await airtableWrite('Sites', siteRecord.id, { 'Workflow Mode': targetMode });
        await sendWhatsAppMessage(senderNumber, `🔄 *Mode Updated:* *${siteRecord.fields['Site Name']}* is now set to *${targetMode}*.`);
      } else {
        await sendWhatsAppMessage(senderNumber, `⚠️ *Invalid Mode:* Choose from: INSTALLATION, MAINTENANCE, SPOT_VISIT.`);
      }
      return;
    }

    if (command === '/status' || command === '/summary') {
      if (!siteRecord) {
        await sendWhatsAppMessage(senderNumber, '⚠️ No site currently linked to this chat. Use `/link <Site Name>` to bind.');
        return;
      }
      const cleared = siteRecord.fields['Cleared Milestones'] || [];
      const mode = siteRecord.fields['Workflow Mode'] || 'INSTALLATION';
      const status = siteRecord.fields['Site Status'] || 'ACTIVE';
      const card = `📊 *Titan OS | Site Status Check*\n\n` +
                   `📍 *Site:* ${siteRecord.fields['Site Name']}\n` +
                   `⚙️ *Mode:* ${mode}\n` +
                   `⚡ *Status:* ${status}\n` +
                   `✅ *Verified Milestones (${cleared.length}/12):*\n${cleared.join(', ') || 'None'}\n\n` +
                   `_To update progress, send a video walkthrough or photo._`;
      await sendWhatsAppMessage(senderNumber, card);
      return;
    }
  }

  // 3. Media Ingestion & Concurrent Execution (<7s)
  let mediaBuffer = null;
  let mimeType = null;
  let mediaId = null;

  if (messageType === 'video') {
    mediaId = message.video.id;
    mimeType = message.video.mime_type;
  } else if (messageType === 'image') {
    mediaId = message.image.id;
    mimeType = message.image.mime_type;
  } else if (messageType === 'audio') {
    mediaId = message.audio.id;
    mimeType = message.audio.mime_type;
  }

  if (mediaId) {
    const downloaded = await downloadMetaMedia(mediaId);
    mediaBuffer = downloaded.buffer;
    mimeType = downloaded.mimeType || mimeType;
  }

  const currentMode = siteRecord?.fields['Workflow Mode'] || 'INSTALLATION';
  const siteName = siteRecord?.fields['Site Name'] || 'BPC Site';

  const [uploadResult, aiResult] = await Promise.all([
    mediaBuffer ? uploadToSupabase(mediaBuffer, mimeType) : Promise.resolve({ storagePath: '', signedUrl: '' }),
    evaluateFieldSubmission({
      mediaBuffer,
      mimeType,
      captionText: textContent,
      workflowMode: currentMode,
      siteName: siteName
    })
  ]);

  // 4. Milestone State Machine & Blocker Demotions
  const existingMilestones = siteRecord?.fields['Cleared Milestones'] || [];
  let existingTimestamps = {};
  try {
    existingTimestamps = JSON.parse(siteRecord?.fields['Milestone Timestamps JSON'] || '{}');
  } catch (e) {
    existingTimestamps = {};
  }

  let activeMilestones = [...new Set([...existingMilestones, ...(aiResult.verified_milestones || [])])];
  const needsAttentionList = aiResult.needs_attention || [];

  // Dual text audit scanner: catches blockers in needs_attention OR notes
  const auditText = [
    ...needsAttentionList,
    (aiResult.notes || '')
  ].join(' ').toLowerCase();

  const hasFoundationBlocker = /foundation|slab|cement|concrete|leveling/i.test(auditText);
  const hasFrameBlocker = /frame|tab|column|pillar|post|misalign/i.test(auditText);
  const hasCleanlinessBlocker = /clean|debris|trash|tool|rubbish|bucket|scrap/i.test(auditText);

  if (hasFoundationBlocker) {
    activeMilestones = activeMilestones.filter(m => m === "Foundation / Slab Preparation");
  } else if (hasFrameBlocker) {
    const allowedPreGlass = [
      "Foundation / Slab Preparation",
      "Steel Frame - Bottom",
      "Steel Frame - Top",
      "Lower Mesh",
      "Upper Mesh"
    ];
    activeMilestones = activeMilestones.filter(m => allowedPreGlass.includes(m));
  }

  if (hasCleanlinessBlocker) {
    activeMilestones = activeMilestones.filter(m => m !== "Site Cleanliness & Final Walkthrough");
  }

  if (Array.isArray(aiResult.blocked_milestones)) {
    activeMilestones = activeMilestones.filter(m => !aiResult.blocked_milestones.includes(m));
  }

  const nowISO = new Date().toISOString();
  activeMilestones.forEach(m => {
    if (!existingTimestamps[m]) existingTimestamps[m] = nowISO;
  });
  Object.keys(existingTimestamps).forEach(m => {
    if (!activeMilestones.includes(m)) delete existingTimestamps[m];
  });

  // Calculate Elapsed Install Time
  let installStarted = siteRecord?.fields['Install Started'];
  if (!installStarted && activeMilestones.length

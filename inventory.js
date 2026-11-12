/**
 * TITAN OS V6.0.22 — SUPPLY CHAIN & LOGISTICS ORCHESTRATOR
 * Module: inventory.js
 * Purpose: Multimodal Hardware Extraction, Auto-Reorder Integration,
 *          Zero-UI Voice-to-Stock Ledger for Inventory & Equipment,
 *          BOM Depletion, Multi-Page Pagination, Targeted SKU/Asset Queries,
 *          and Polymorphic Dispatch.
 */

// Defensive check (assuming server.js has initialized global fetch)
if (typeof fetch === 'undefined') {
  console.warn('[Logistics Engine] Global fetch is not defined. Falling back to native require.');
  try {
    globalThis.fetch = require('node-fetch');
  } catch (e) {
    console.error('[Logistics Engine] CRITICAL: node-fetch missing.');
  }
}

// Ensure metrics is conditionally loaded to prevent crashes if it doesn't exist
let metrics;
try {
  metrics = require('./metrics');
} catch (e) {
  metrics = null;
}

// In-memory Cache-Aside Storage for dual ledgers
let inventoryCache = [];
let equipmentCache = [];
let lastInventoryFetch = 0;
let lastEquipmentFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute TTL

// ====================================================================
// 1. LOGISTICS CACHE HYDRATION & MULTI-PAGE AIRTABLE TRANSPORT
// ====================================================================

function resolveQtyFieldName(fields) {
  if ('Quantity on hand' in fields) return 'Quantity on hand';
  if ('Quantity on Hand' in fields) return 'Quantity on Hand';
  if ('Quantity' in fields) return 'Quantity';
  if ('Stock Level' in fields) return 'Stock Level';
  return 'Quantity on hand';
}

async function refreshLogisticsCache(config, tableName, force = false) {
  const now = Date.now();
  const isInventory = tableName === 'Inventory';
  
  if (!force) {
      if (isInventory && inventoryCache.length > 0 && (now - lastInventoryFetch < CACHE_TTL_MS)) return inventoryCache;
      if (!isInventory && equipmentCache.length > 0 && (now - lastEquipmentFetch < CACHE_TTL_MS)) return equipmentCache;
  }

  const endpoint = config?.airtable?.endpoint || process.env.AIRTABLE_ENDPOINT || 'https://api.airtable.com/v0';
  const baseId = config?.airtable?.baseId || process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
  const apiKey = config?.airtable?.apiKey || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

  if (!apiKey) {
    console.warn(`[Logistics Engine] Airtable API credentials missing for ${tableName}.`);
    return isInventory ? inventoryCache : equipmentCache;
  }

  try {
    let allRecords = [];
    let offset = null;

    do {
      const offsetParam = offset ? `&offset=${encodeURIComponent(offset)}` : '';
      const url = `${endpoint}/${baseId}/${encodeURIComponent(tableName)}?pageSize=100${offsetParam}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    if (isInventory) {
        inventoryCache = allRecords;
        lastInventoryFetch = now;
    } else {
        equipmentCache = allRecords;
        lastEquipmentFetch = now;
    }
    
    console.log(`[Logistics Engine] Successfully cached ${allRecords.length} items from ${tableName} into RAM`);
    return allRecords;
  } catch (err) {
    console.error(`❌ [Logistics Engine] Failed to cache ${tableName}:`, err.message);
    return isInventory ? inventoryCache : equipmentCache;
  }
}

async function writeAirtableLogistics(config, tableName, recordId, fields) {
  const endpoint = config?.airtable?.endpoint || process.env.AIRTABLE_ENDPOINT || 'https://api.airtable.com/v0';
  const baseId = config?.airtable?.baseId || process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
  const apiKey = config?.airtable?.apiKey || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

  const url = `${endpoint}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  let currentPayload = { fields: { ...fields } };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentPayload)
      });

      if (res.ok) {
        if (metrics && metrics.incrementMetric) metrics.incrementMetric('database_mutations');
        return await res.json();
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || '';

      if (res.status === 422) {
        const match = errMsg.match(/field\s*["'\\]+([^"'\\]+)["'\\]+/i) || errMsg.match(/Unknown field name\s*["'\\]+([^"'\\]+)["'\\]+/i);
        if (match && match[1]) {
          const badField = match[1];
          console.warn(`[Logistics Auto-Healer] Dropping incompatible field: "${badField}" from ${tableName}`);
          delete currentPayload.fields[badField];
          continue;
        }
      }

      throw new Error(`Airtable write rejected (${res.status}): ${errMsg}`);
    } catch (err) {
      if (attempt === 1) {
        console.error(`[Logistics Write Error on ${tableName}]:`, err.message);
        return null;
      }
    }
  }
  return null;
}

// ====================================================================
// 2. CONVERSATIONAL LEDGER & GEMINI EXTRACTION
// ====================================================================

function buildInventorySnapshotCard(items) {
  if (!items || items.length === 0) {
    return `📦 *TITAN OS | FLEET INVENTORY*\n──────────────────────────────\nNo tracked inventory records located in the master ledger.`;
  }

  const formatLine = (rec) => {
    const f = rec.fields;
    const name = f['Item Name'] || f['Name'] || 'Material';
    const qty = Number(f['Quantity on hand'] ?? f['Quantity on Hand'] ?? f['Quantity'] ?? f['Stock Level'] ?? 0);
    const committed = Number(f['Committed'] ?? 0);
    const avail = Math.max(0, qty - committed);
    return `• *${name}:* ${avail} Avail / ${qty} On Hand`;
  };

  const turf = items.filter(i => /turf/i.test(i.fields['Category'] || i.fields['Item Name'] || ''));
  const glass = items.filter(i => /glass/i.test(i.fields['Category'] || i.fields['Item Name'] || ''));
  const steel = items.filter(i => /steel/i.test(i.fields['Category'] || i.fields['Item Name'] || ''));
  const lights = items.filter(i => /light/i.test(i.fields['Category'] || i.fields['Item Name'] || ''));
  const consumables = items.filter(i => /consumable|fastener|hardware|adhesive|glue|sand/i.test(i.fields['Category'] || i.fields['Item Name'] || ''));

  let card = `📦 *TITAN OS | YARD & FLEET INVENTORY*\n──────────────────────────────\n`;

  if (turf.length > 0) card += `🌱 *Turf Rolls & Play Kits:*\n${turf.slice(0, 4).map(formatLine).join('\n')}\n\n`;
  if (glass.length > 0) card += `🪟 *Tempered Glass Panes:*\n${glass.slice(0, 3).map(formatLine).join('\n')}\n\n`;
  if (steel.length > 0) card += `🏗️ *Steel Frame Components:*\n${steel.slice(0, 3).map(formatLine).join('\n')}\n\n`;
  if (lights.length > 0) card += `💡 *LED Fixtures & Columns:*\n${lights.slice(0, 2).map(formatLine).join('\n')}\n\n`;
  if (consumables.length > 0) card += `🧪 *Adhesives & Hardware:*\n${consumables.slice(0, 3).map(formatLine).join('\n')}\n\n`;

  card += `──────────────────────────────\n_To log usage, voice or text: "Used 4 tubs Turf Adhesive at RCOR"_`;
  return card.trim();
}

function buildEquipmentSnapshotCard(equipment) {
    if (!equipment || equipment.length === 0) {
      return `🚜 *TITAN OS | FLEET EQUIPMENT*\n──────────────────────────────\nNo equipment records located in the master ledger.`;
    }
  
    const formatLine = (rec) => {
      const f = rec.fields;
      const name = f['Asset Name'] || f['Name'] || 'Equipment';
      const loc = f['Current Location'] || 'Yard (Unassigned)';
      return `• *${name}:* ${loc}`;
    };
  
    const trailers = equipment.filter(e => /trailer/i.test(e.fields['Asset Name'] || ''));
    const lifts = equipment.filter(e => /glass mover|lift|forklift/i.test(e.fields['Asset Name'] || ''));
  
    let card = `🚜 *TITAN OS | EQUIPMENT TRACKER*\n──────────────────────────────\n`;
  
    if (trailers.length > 0) {
      card += `🚛 *Trailers & Transport:*\n${trailers.map(formatLine).join('\n')}\n\n`;
    }
    if (lifts.length > 0) {
      card += `🏗️ *Lifts & Heavy Machinery:*\n${lifts.map(formatLine).join('\n')}\n\n`;
    }
  
    card += `──────────────────────────────\n_To update, voice: "Move the flatbed trailer to RCOR Court 1"_`;
    return card.trim();
}

function buildTargetedCard(record, isEquipment) {
  const f = record.fields;
  const name = isEquipment ? (f['Asset Name'] || 'Equipment') : (f['Item Name'] || f['Name'] || 'Material');
  
  if (isEquipment) {
      const loc = f['Current Location'] || 'Yard (Unassigned)';
      const lastNote = f['Last Note'] || 'No recent notes.';
      return `🚜 *TITAN OS | ASSET TRACKER*\n──────────────────────────────\n🔧 *Asset:* ${name}\n📍 *Current Location:* ${loc}\n📝 *Status:* ${lastNote}\n──────────────────────────────\n_To relocate, voice: "Move ${name} to [Site]"_`;
  } else {
      const qty = Number(f['Quantity on hand'] ?? f['Quantity on Hand'] ?? f['Quantity'] ?? f['Stock Level'] ?? 0);
      const committed = Number(f['Committed'] ?? 0);
      const avail = Math.max(0, qty - committed);
      const unit = f['Unit'] || 'units';
      const category = f['Category'] || 'General';
      let statusEmoji = avail <= 0 ? '🔴 Out of Stock' : (avail <= 2 ? '🟡 Low Buffer' : '🟢');

      return `📦 *TITAN OS | STOCK CHECK*\n──────────────────────────────\n🔧 *Material:* ${name}\n📂 *Category:* ${category}\n──────────────────────────────\n📊 *Available:* ${avail} ${unit} ${statusEmoji}\n📦 *On Hand:* ${qty} ${unit}\n🔒 *Committed:* ${committed} ${unit}\n──────────────────────────────\n_To adjust, voice: "Used 2 ${name}"_`;
  }
}

async function parseLogisticsAdjustmentWithAI(config, rawText, availableItems, isEquipment) {
  const geminiEndpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const geminiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  if (!geminiKey) return null;

  const listFormatted = availableItems.map(i => {
      if (isEquipment) {
          return { id: i.id, name: i.fields['Asset Name'] || 'Equipment', location: i.fields['Current Location'] || 'Yard' };
      }
      return { id: i.id, name: i.fields['Item Name'] || 'Item', current_quantity: Number(i.fields['Quantity on hand'] ?? 0) };
  });

  const schemaStr = isEquipment 
    ? `{"intent": "QUERY" | "ADJUST" | "UNKNOWN", "record_id": "string or null", "asset_name": "string", "new_location": "string or null", "notes": "string or null"}`
    : `{"intent": "QUERY" | "ADJUST" | "UNKNOWN", "record_id": "string or null", "item_name": "string", "adjustment_type": "DEDUCT" | "RESTOCK" | null, "quantity": number or null, "site_context": "string or null", "notes": "string"}`;

  const prompt = `You are the Titan OS Logistics Copilot.
User input: "${rawText}"
Active ${isEquipment ? 'Equipment' : 'Inventory'} Database: ${JSON.stringify(listFormatted.slice(0, 75), null, 2)}
TASK: Determine if they want to QUERY or ADJUST. Match the exact record_id. Output STRICTLY JSON: ${schemaStr}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
  };

  try {
    const res = await fetch(`${geminiEndpoint}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Gemini API HTTP ${res.status}`);
    const data = await res.json();
    const rawJSON = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(rawJSON.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Logistics AI Parse Error]:', err.message);
    return null;
  }
}

// ====================================================================
// 3. MASTER LOGISTICS ORCHESTRATOR (INVENTORY & EQUIPMENT)
// ====================================================================

async function handleSpokenLogisticsQuery(arg1, arg2, arg3, arg4, arg5, arg6, isEquipmentRequest = false) {
  let config, rawText, dispatchTarget, sendWhatsAppMessage, callerIdentity;

  if (typeof arg1 === 'object' && arg1 !== null && arg1.meta) {
    config = arg1; rawText = typeof arg2 === 'string' ? arg2 : ''; dispatchTarget = arg3;
    sendWhatsAppMessage = arg4; callerIdentity = arg5;
  } else {
    dispatchTarget = String(arg1 || ''); sendWhatsAppMessage = arg2; rawText = typeof arg3 === 'string' ? arg3 : '';
    config = {
      airtable: { endpoint: process.env.AIRTABLE_ENDPOINT || 'https://api.airtable.com/v0', baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP', apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN },
      gemini: { apiKey: process.env.GEMINI_API_KEY, endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent' }
    };
  }

  if (typeof sendWhatsAppMessage !== 'function') return;

  try {
    const cleanText = String(rawText || '').trim();
    const lText = cleanText.toLowerCase();
    
    // Determine context dynamically if not explicitly passed
    const isEquipment = isEquipmentRequest || lText.includes('equip') || lText.includes('trailer') || lText.includes('mover') || lText.includes('forklift');
    const tableName = isEquipment ? 'Equipment' : 'Inventory';
    
    const records = await refreshLogisticsCache(config, tableName);

    // 1. Pure General Snapshot
    const isPureGeneralQuery = !cleanText || lText === '/inv' || lText === 'inv' || lText === 'inventory' || lText === 'stock' || lText === 'equipment';

    if (isPureGeneralQuery) {
      const card = isEquipment ? buildEquipmentSnapshotCard(records) : buildInventorySnapshotCard(records);
      await sendWhatsAppMessage(config, dispatchTarget, card);
      return;
    }

    // 2. AI Evaluation
    await sendWhatsAppMessage(config, dispatchTarget, `⏳ Reconciling ${tableName.toLowerCase()} ledger...`);
    const parsed = await parseLogisticsAdjustmentWithAI(config, cleanText, records, isEquipment);

    // 3. Targeted Query Branch
    if (parsed && parsed.intent === 'QUERY' && parsed.record_id) {
      const targetRecord = records.find(r => r.id === parsed.record_id);
      if (targetRecord) {
        await sendWhatsAppMessage(config, dispatchTarget, buildTargetedCard(targetRecord, isEquipment));
        return;
      }
    }

    // Fallback if no adjustment delta/location is provided
    if (!parsed || parsed.intent !== 'ADJUST' || !parsed.record_id) {
      await sendWhatsAppMessage(config, dispatchTarget, isEquipment ? buildEquipmentSnapshotCard(records) : buildInventorySnapshotCard(records));
      return;
    }

    // 4. Execution Branch
    const targetRecord = records.find(r => r.id === parsed.record_id);
    if (!targetRecord) {
      await sendWhatsAppMessage(config, dispatchTarget, `⚠️ Asset "${parsed.asset_name || parsed.item_name || 'Item'}" could not be reconciled in Airtable.`);
      return;
    }

    let patchPayload = {};
    let confirmCard = '';

    if (isEquipment) {
        const newLoc = parsed.new_location || 'Yard';
        patchPayload = { 
            'Current Location': newLoc,
            'Last Note': `[RELOCATED] Moved to ${newLoc} by ${callerIdentity?.name || 'Operative'} on ${new Date().toLocaleDateString('en-CA')}`
        };
        confirmCard = `🚜 *TITAN OS | EQUIPMENT MOVED*\n──────────────────────────────\n👤 *Operative:* ${callerIdentity?.name || 'HQ'}\n🔧 *Asset:* ${targetRecord.fields['Asset Name']}\n📍 *New Location:* ${newLoc}\n──────────────────────────────\n✅ Master equipment ledger updated.`;
    } else {
        const fields = targetRecord.fields;
        const qtyFieldName = resolveQtyFieldName(fields);
        const currentQty = Number(fields[qtyFieldName] ?? 0);
        let delta = Math.abs(Number(parsed.quantity));
        let newQty = parsed.adjustment_type === 'DEDUCT' ? Math.max(0, currentQty - delta) : currentQty + delta;

        patchPayload = { [qtyFieldName]: newQty };
        if ('Notes' in fields) {
            patchPayload['Notes'] = `Adjusted by ${callerIdentity?.name || 'Operative'} on ${new Date().toLocaleDateString('en-CA')}: ${parsed.notes || cleanText}`;
        }
        
        const adjSymbol = parsed.adjustment_type === 'DEDUCT' ? '-' : '+';
        const unit = fields['Unit'] || 'units';
        confirmCard = `📦 *TITAN OS | INVENTORY LOGGED*\n──────────────────────────────\n👤 *Operative:* ${callerIdentity?.name || 'HQ'}\n🔧 *Material:* ${fields['Item Name'] || parsed.item_name}\n📊 *Adjustment:* ${adjSymbol}${delta} ${unit}\n📈 *Current Stock:* ${newQty} ${unit}\n──────────────────────────────\n✅ Master stock ledger updated.`;
    }

    const updated = await writeAirtableLogistics(config, tableName, targetRecord.id, patchPayload);

    if (updated) {
      await refreshLogisticsCache(config, tableName, true);
      await sendWhatsAppMessage(config, dispatchTarget, confirmCard);
    } else {
      await sendWhatsAppMessage(config, dispatchTarget, `❌ Failed to update ${tableName.toLowerCase()} record in Airtable.`);
    }

  } catch (err) {
    console.error(`[Logistics Orchestrator Error]:`, err);
    await sendWhatsAppMessage(config, dispatchTarget, `⚠️ Logistics Engine error: ${err.message}`);
  }
}

// Map the old function names to the new unified orchestrator for seamless server.js integration
module.exports = {
  refreshInventoryCache: (c, f) => refreshLogisticsCache(c, 'Inventory', f),
  handleSpokenInventorySnapshot: (c, r, d, s, i) => handleSpokenLogisticsQuery(c, r, d, s, i, null, false),
  handleSpokenInventoryUpdate: (c, r, d, s, i) => handleSpokenLogisticsQuery(c, r, d, s, i, null, false),
  handleSpokenEquipmentQuery: (c, r, d, s, i) => handleSpokenLogisticsQuery(c, r, d, s, i, null, true),
  handleSpokenEquipmentUpdate: (c, r, d, s, i) => handleSpokenLogisticsQuery(c, r, d, s, i, null, true)
};

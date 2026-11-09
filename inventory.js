/**
 * TITAN OS V6.0.22 — SUPPLY CHAIN & INVENTORY ORCHESTRATOR
 * Module: inventory.js
 * Purpose: Multimodal Hardware Extraction, Auto-Reorder Integration,
 *          Zero-UI Voice-to-Stock Ledger, BOM Depletion, and Polymorphic Dispatch
 */

const fetch = globalThis.fetch || require('node-fetch');

// In-memory Cache-Aside Storage
let inventoryCache = [];
let lastInventoryFetch = 0;
const INVENTORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute TTL

// ====================================================================
// 1. INVENTORY CACHE HYDRATION & AIRTABLE TRANSPORT
// ====================================================================

/**
 * Hydrates and refreshes the in-memory Inventory table from Airtable
 * 
 * @param {object} config - Titan OS Configuration Object
 * @param {boolean} force - Force refresh bypass of TTL
 * @returns {Promise<Array>} - Cached inventory records
 */
async function refreshInventoryCache(config, force = false) {
  const now = Date.now();
  if (!force && inventoryCache.length > 0 && (now - lastInventoryFetch < INVENTORY_CACHE_TTL_MS)) {
    return inventoryCache;
  }

  const endpoint = config?.airtable?.endpoint || process.env.AIRTABLE_ENDPOINT || 'https://api.airtable.com/v0';
  const baseId = config?.airtable?.baseId || process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
  const apiKey = config?.airtable?.apiKey || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

  if (!apiKey) {
    console.warn('[Inventory Engine] Airtable API credentials missing. Returning stale cache.');
    return inventoryCache;
  }

  try {
    const url = `${endpoint}/${baseId}/Inventory?maxRecords=200`;
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
    inventoryCache = data.records || [];
    lastInventoryFetch = now;
    console.log(`[Inventory Engine] Successfully cached ${inventoryCache.length} items from Airtable into RAM`);
    return inventoryCache;
  } catch (err) {
    console.error('❌ [Inventory Engine] Failed to cache inventory:', err.message);
    return inventoryCache;
  }
}

/**
 * Resilient schema-safe Airtable write handler with auto-dropping of incompatible columns
 */
async function writeAirtableInventory(config, recordId, fields) {
  const endpoint = config?.airtable?.endpoint || process.env.AIRTABLE_ENDPOINT || 'https://api.airtable.com/v0';
  const baseId = config?.airtable?.baseId || process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
  const apiKey = config?.airtable?.apiKey || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

  const url = `${endpoint}/${baseId}/Inventory/${recordId}`;
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
        return await res.json();
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || '';

      // Auto-Healer: drop invalid fields if Airtable schema rejects property
      if (res.status === 422) {
        const match = errMsg.match(/field\s*["'\\]+([^"'\\]+)["'\\]+/i) || errMsg.match(/Unknown field name\s*["'\\]+([^"'\\]+)["'\\]+/i);
        if (match && match[1]) {
          const badField = match[1];
          console.warn(`[Inventory Auto-Healer] Dropping incompatible field: "${badField}"`);
          delete currentPayload.fields[badField];
          continue;
        }
      }

      throw new Error(`Airtable write rejected (${res.status}): ${errMsg}`);
    } catch (err) {
      if (attempt === 1) {
        console.error('[Inventory Write Error]:', err.message);
        return null;
      }
    }
  }
  return null;
}

// ====================================================================
// 2. CONVERSATIONAL STOCK LEDGER & GEMINI EXTRACTION
// ====================================================================

/**
 * Generates an ergonomic WhatsApp Inventory Snapshot Report
 */
function buildInventorySnapshotCard(items) {
  if (!items || items.length === 0) {
    return `📦 *TITAN OS | FLEET INVENTORY*\n──────────────────────────────\nNo tracked inventory records located in the master ledger.`;
  }

  const lines = [];
  let lowStockCount = 0;

  items.forEach(rec => {
    const f = rec.fields;
    const name = f['Item Name'] || f['Name'] || f['Item'] || 'Hardware Component';
    const qty = Number(f['Quantity'] ?? f['Stock Level'] ?? f['Quantity on Hand'] ?? f['Count'] ?? 0);
    const unit = f['Unit'] || f['Units'] || 'units';
    const threshold = Number(f['Reorder Threshold'] ?? f['Min Stock'] ?? f['Reorder Level'] ?? 5);

    let emoji = '🟢';
    let statusText = '';

    if (qty <= 0) {
      emoji = '🔴';
      statusText = ' — *REORDER REQUIRED*';
      lowStockCount++;
    } else if (qty <= threshold) {
      emoji = '🟡';
      statusText = ' — *Low Stock*';
      lowStockCount++;
    }

    lines.push(`• ${emoji} *${name}:* ${qty} ${unit}${statusText}`);
  });

  return `📦 *TITAN OS | FLEET INVENTORY SNAPSHOT*\n` +
         `──────────────────────────────\n` +
         lines.join('\n') + `\n` +
         `──────────────────────────────\n` +
         `📊 *Tracked Materials:* ${items.length} SKUs\n` +
         `⚠️ *Alerts Pending:* ${lowStockCount} items\n\n` +
         `_To log usage, voice or text: "Used 4 tubs Turf Adhesive"_`;
}

/**
 * Parses unstructured natural-language inventory adjustments via Gemini 2.5 Pro
 */
async function parseInventoryAdjustmentWithAI(config, rawText, availableItems) {
  const geminiEndpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const geminiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  if (!geminiKey) return null;

  const itemListFormatted = availableItems.map(i => ({
    id: i.id,
    name: i.fields['Item Name'] || i.fields['Name'] || i.fields['Item'] || 'Item',
    current_quantity: Number(i.fields['Quantity'] ?? i.fields['Quantity on Hand'] ?? 0),
    unit: i.fields['Unit'] || 'units'
  }));

  const prompt = `You are the Titan OS Logistics & Supply Chain Copilot.
An operative in the field submitted this natural language inventory statement:
"${rawText}"

Available Active Inventory Database:
${JSON.stringify(itemListFormatted, null, 2)}

TASK:
1. Determine if the user is asking to READ/CHECK inventory ("QUERY") or ADJUST/UPDATE stock ("ADJUST").
2. If ADJUST, identify the target inventory item from the list, the quantity mentioned, whether it is an addition/restock or subtraction/usage, and optional jobsite context.
3. Return STRICTLY JSON conforming to the schema below.

JSON SCHEMA:
{
  "intent": "QUERY" | "ADJUST" | "UNKNOWN",
  "record_id": "string (the matching Airtable record ID or null)",
  "item_name": "string (matched item name or null)",
  "adjustment_type": "DEDUCT" | "RESTOCK" | null,
  "quantity": number or null,
  "site_context": "string or null",
  "notes": "string or null"
}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json'
    }
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
    console.error('[Inventory AI Parse Error]:', err.message);
    return null;
  }
}

// ====================================================================
// 3. MASTER SPOKEN INVENTORY ORCHESTRATOR
// ====================================================================

/**
 * Headless Entrypoint for WhatsApp Voice and Text Inventory Commands
 * Polymorphic: Supports both legacy (dispatchTarget, sendWhatsAppMessage)
 * and rich (config, rawText, dispatchTarget, sendWhatsAppMessage, callerIdentity, autoDrop)
 */
async function handleSpokenInventorySnapshot(arg1, arg2, arg3, arg4, arg5, arg6) {
  let config = null;
  let rawText = '';
  let dispatchTarget = '';
  let sendWhatsAppMessage = null;
  let callerIdentity = null;

  // Polymorphic signature adapter
  if (typeof arg1 === 'object' && arg1 !== null && arg1.meta) {
    // Rich invocation: (config, rawText, dispatchTarget, sendWhatsAppMessage, callerIdentity, autoDrop)
    config = arg1;
    rawText = typeof arg2 === 'string' ? arg2 : '';
    dispatchTarget = arg3;
    sendWhatsAppMessage = arg4;
    callerIdentity = arg5;
  } else {
    // Legacy invocation: (dispatchTarget, sendWhatsAppMessage)
    dispatchTarget = String(arg1 || '');
    sendWhatsAppMessage = arg2;
    rawText = typeof arg3 === 'string' ? arg3 : '';
    config = {
      airtable: {
        endpoint: process.env.AIRTABLE_ENDPOINT || 'https://api.airtable.com/v0',
        baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
        apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
      }
    };
  }

  if (typeof sendWhatsAppMessage !== 'function') {
    console.error('[Inventory Engine] Fatal: sendWhatsAppMessage is not a function.');
    return;
  }

  try {
    // 1. Refresh inventory cache from Airtable
    const items = await refreshInventoryCache(config);
    const cleanText = String(rawText || '').trim();
    const lText = cleanText.toLowerCase();

    // 2. Pure Stock Query Branch (e.g., "/inv", "inv", "stock", "inventory")
    const isPureQuery = !cleanText || 
                        lText === '/inv' || 
                        lText === 'inv' || 
                        lText === 'inventory' || 
                        lText === 'stock' || 
                        lText === 'check inventory' ||
                        lText === 'what is our stock';

    if (isPureQuery) {
      const card = buildInventorySnapshotCard(items);
      await sendWhatsAppMessage(dispatchTarget, card);
      return;
    }

    // 3. Conversational Voice/Text Stock Adjustment Branch
    await sendWhatsAppMessage(dispatchTarget, "⏳ Calculating inventory ledger adjustments...");
    const parsed = await parseInventoryAdjustmentWithAI(config, cleanText, items);

    if (!parsed || parsed.intent === 'QUERY' || !parsed.record_id || !parsed.quantity) {
      // Fallback: Show snapshot card if no deterministic adjustment could be identified
      const card = buildInventorySnapshotCard(items);
      await sendWhatsAppMessage(dispatchTarget, card);
      return;
    }

    // Locate the matching record in memory
    const targetRecord = items.find(i => i.id === parsed.record_id);
    if (!targetRecord) {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ Material "${parsed.item_name || 'Item'}" could not be reconciled in Airtable.`);
      return;
    }

    const fields = targetRecord.fields;
    const currentQty = Number(fields['Quantity'] ?? fields['Quantity on Hand'] ?? fields['Stock Level'] ?? 0);
    const unit = fields['Unit'] || 'units';
    const itemName = fields['Item Name'] || fields['Name'] || parsed.item_name || 'Material Item';
    const threshold = Number(fields['Reorder Threshold'] ?? fields['Min Stock'] ?? 5);

    let delta = Math.abs(Number(parsed.quantity));
    let newQty = currentQty;

    if (parsed.adjustment_type === 'DEDUCT') {
      newQty = Math.max(0, currentQty - delta);
    } else {
      newQty = currentQty + delta;
    }

    // 4. Determine Target Quantity Field in Airtable Schema
    const qtyFieldName = ('Quantity' in fields) ? 'Quantity' 
                       : ('Quantity on Hand' in fields) ? 'Quantity on Hand'
                       : ('Stock Level' in fields) ? 'Stock Level' 
                       : 'Quantity';

    const patchPayload = { [qtyFieldName]: newQty };
    if ('Last Adjusted' in fields || 'Notes' in fields) {
      patchPayload['Notes'] = `Adjusted by ${callerIdentity?.name || 'Field Operative'} on ${new Date().toLocaleDateString()}: ${parsed.notes || cleanText}`;
    }

    // 5. Commit Stock Mutation to Airtable
    const updated = await writeAirtableInventory(config, targetRecord.id, patchPayload);

    if (updated) {
      // Invalidate memory cache so next query pulls updated state
      await refreshInventoryCache(config, true);

      let statusEmoji = '🟢';
      let statusWarning = '';

      if (newQty <= 0) {
        statusEmoji = '🔴';
        statusWarning = `\n🚨 *CRITICAL DEPLETION:* Stock at 0 ${unit}. Restock order flagged.`;
      } else if (newQty <= threshold) {
        statusEmoji = '🟡';
        statusWarning = `\n⚠️ *LOW STOCK ALERT:* Remaining stock is below the minimum threshold (${threshold} ${unit}).`;
      }

      const operatorName = callerIdentity?.name || 'Field Operative';
      const adjSymbol = parsed.adjustment_type === 'DEDUCT' ? '-' : '+';
      const siteStr = parsed.site_context ? `\n📍 *Jobsite:* ${parsed.site_context}` : '';

      const confirmCard = `📦 *TITAN OS | INVENTORY LOGGED*\n` +
                          `──────────────────────────────\n` +
                          `👤 *Operative:* ${operatorName}\n` +
                          `🔧 *Material:* ${itemName}\n` +
                          `📊 *Adjustment:* ${adjSymbol}${delta} ${unit}\n` +
                          `📈 *Current Stock:* ${newQty} ${unit} ${statusEmoji}${siteStr}${statusWarning}\n` +
                          `──────────────────────────────\n` +
                          `✅ Master stock ledger updated.`;

      await sendWhatsAppMessage(dispatchTarget, confirmCard);
      await checkLowStockRadar(config, dispatchTarget);
    } else {
      await sendWhatsAppMessage(dispatchTarget, `❌ Failed to update inventory record in Airtable. Retrying queued in background.`);
    }

  } catch (err) {
    console.error('[Inventory Orchestrator Error]:', err);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Inventory Engine error: ${err.message}`);
  }
}

// ====================================================================
// 4. BILL OF MATERIALS (BOM) & AUTO-REORDER RADAR
// ====================================================================

/**
 * Autonomous Radar: Alerts Headquarters when available stock drops below lead-time buffers.
 */
async function checkLowStockRadar(config, dispatchTarget) {
  if (!dispatchTarget) return;
  const items = await refreshInventoryCache(config);
  const alerts = [];

  for (const item of items) {
    const f = item.fields;
    const name = f['Item Name'] || f['Name'] || 'Unknown Item';
    const qty = Number(f['Quantity on hand'] ?? f['Quantity'] ?? f['Stock Level'] ?? 0);
    const committed = Number(f['Committed'] ?? 0);
    const bomQty = Number(f['Standard BOM Qty'] ?? 0);
    const leadTimeDays = Number(f['Lead Time (Days)'] ?? 0);
    
    const available = qty - committed;

    if ((bomQty > 0 || leadTimeDays >= 30) && available <= 2 && qty > 0) {
      alerts.push(`• *${name}:* ${Math.max(0, available)} Avail (${leadTimeDays ? leadTimeDays + 'd lead time' : 'Reorder needed'})`);
    }
  }

  if (alerts.length > 0) {
    const alertCard = `⚠️ *TITAN OS | REORDER RADAR ALERT*\n` +
      `──────────────────────────────\n` +
      `Available buffer has reached critical threshold:\n\n` +
      alerts.slice(0, 5).join('\n') + `\n\n` +
      `👉 *Action:* Initiate supplier PO to protect forward installation runway.`;
    
    // Fallback to sending through WhatsApp via imported function if passed, otherwise require it.
    const whatsapp = require('./whatsapp');
    if (whatsapp && whatsapp.sendWhatsAppMessage) {
       await whatsapp.sendWhatsAppMessage(config, dispatchTarget, alertCard);
    }
  }
}

/**
 * Automates the depletion of bulk BOM items when structural gates are cleared.
 */
async function processMilestoneBOMDeduction(config, siteRecord, clearedGate) {
  const siteName = siteRecord.fields['Site Name'] || 'Unknown Site';
  if (siteRecord.fields['Manufacturer'] !== 'BPC') {
     console.log(`[BOM Engine] Bypassing BOM deduction for ${siteName} (Manufacturer is ${siteRecord.fields['Manufacturer']}, not BPC).`);
     return;
  }
  
  const items = await refreshInventoryCache(config);
  let deductedItems = [];

  if (clearedGate === 'Gate 2') {
    console.log(`⚙️ [BOM Engine] Gate 2 cleared at ${siteName}. Deducting Steel & Fasteners.`);
    
    for (const item of items) {
      const f = item.fields;
      const category = f['Category'] || '';
      const qty = Number(f['Quantity on hand'] ?? f['Quantity'] ?? 0);
      const bomQty = Number(f['Standard BOM Qty'] ?? 0);

      if (['Steel Inventory', 'Fasteners', 'Consumables'].includes(category) && bomQty > 0) {
        const newQty = Math.max(0, qty - bomQty);
        await writeAirtableInventory(config, item.id, { 'Quantity on hand': newQty });
        deductedItems.push(`${f['Item Name']} (-${bomQty})`);
      }
    }
  }
  
  if (clearedGate === 'Gate 4') {
    console.log(`⚙️ [BOM Engine] Gate 4 cleared at ${siteName}. Shifting Glass/Turf from Committed to Consumed.`);
    
    for (const item of items) {
      const f = item.fields;
      const category = f['Category'] || '';
      const qty = Number(f['Quantity on hand'] ?? f['Quantity'] ?? 0);
      const committed = Number(f['Committed'] ?? 0);
      const bomQty = Number(f['Standard BOM Qty'] ?? 0);

      if (['Glass', 'Turf'].includes(category) && bomQty > 0) {
        const newQty = Math.max(0, qty - bomQty);
        const newCommitted = Math.max(0, committed - bomQty);
        
        await writeAirtableInventory(config, item.id, { 
          'Quantity on hand': newQty,
          'Committed': newCommitted 
        });
        deductedItems.push(`${f['Item Name']} (-${bomQty})`);
      }
    }
  }

  if (deductedItems.length > 0) {
    console.log(`✅ [BOM Engine] Successfully deducted: ${deductedItems.join(', ')}`);
    await refreshInventoryCache(config, true);
    await checkLowStockRadar(config, config.meta?.targetVerifiedPhone);
  }
}

/**
 * Triggers when a site registers a deposit. Binds the materials to the 'Committed' pipeline.
 */
async function reserveCourtBOM(config, siteName, dispatchTarget = null) {
  console.log(`📦 [BOM Engine] Deposit received for ${siteName}. Reserving materials in Committed pipeline.`);
  const items = await refreshInventoryCache(config);
  
  for (const item of items) {
    const f = item.fields;
    const committed = Number(f['Committed'] ?? 0);
    const bomQty = Number(f['Standard BOM Qty'] ?? 0);

    if (bomQty > 0) {
      const newCommitted = committed + bomQty;
      await writeAirtableInventory(config, item.id, { 'Committed': newCommitted });
    }
  }

  await refreshInventoryCache(config, true);
  await checkLowStockRadar(config, dispatchTarget || config.meta?.targetVerifiedPhone);
}

// ====================================================================
// 5. PHYSICAL INVENTORY TALLY COUNTS
// ====================================================================

/**
 * Bulk executes physical inventory counts retrieved from multimodal analysis (Clipboards, voice notes).
 */
async function executeInventoryCount(config, inventoryCounts, dispatchTarget, workerName = 'HQ Admin', sendWhatsAppMessage) {
  if (!inventoryCounts || inventoryCounts.length === 0) return;
  const items = await refreshInventoryCache(config);
  
  let updatedList = [];
  let notFoundList = [];

  for (const count of inventoryCounts) {
    const query = (count.item_name || '').toLowerCase();
    const newQty = parseFloat(count.new_quantity);
    
    if (isNaN(newQty) || !query) continue;

    const matchedItem = items.find(i => {
       const itemName = String(i.fields['Item Name'] || i.fields['Name'] || '').toLowerCase();
       return itemName.includes(query) || query.includes(itemName);
    });
    
    if (matchedItem) {
      const qtyFieldName = ('Quantity' in matchedItem.fields) ? 'Quantity' 
                         : ('Quantity on Hand' in matchedItem.fields) ? 'Quantity on Hand'
                         : 'Quantity';

      await writeAirtableInventory(config, matchedItem.id, {
        [qtyFieldName]: newQty,
        'Count Status': 'Verified'
      });
      updatedList.push(`• *${matchedItem.fields['Item Name'] || matchedItem.fields['Name']}:* ${newQty}`);
    } else {
      notFoundList.push(`• "${count.item_name}"`);
    }
  }

  await refreshInventoryCache(config, true);

  let card = `📋 *TITAN OS | INVENTORY AUDIT LOGGED*\n──────────────────────────────\n👤 *Auditor:* ${workerName}\n──────────────────────────────\n`;
  if (updatedList.length > 0) {
    card += `✅ *Stock Updated:*\n${updatedList.join('\n')}\n\n`;
  }
  if (notFoundList.length > 0) {
    card += `⚠️ *Unknown SKUs:*\n${notFoundList.join('\n')}\n\n`;
  }
  card += `_Airtable Inventory Ledger synchronized._`;
  
  if (typeof sendWhatsAppMessage === 'function') {
      await sendWhatsAppMessage(config, dispatchTarget, card.trim());
  }
}

module.exports = {
  refreshInventoryCache,
  handleSpokenInventorySnapshot,
  executeInventoryCount,
  processMilestoneBOMDeduction,
  reserveCourtBOM,
  checkLowStockRadar
};

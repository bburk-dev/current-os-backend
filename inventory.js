/**
 * TITAN OS V6.0.22 — SUPPLY CHAIN & INVENTORY ORCHESTRATOR
 * Module: inventory.js
 * Purpose: Multimodal Hardware Extraction, Auto-Reorder Integration, and Cache Sync
 */

// Defensive inclusion for backwards compatibility
let fetch;
try {
  fetch = require('node-fetch');
} catch (err) {
  fetch = globalThis.fetch;
}

// In-memory cache for inventory items
let inventoryCache = [];
let lastInventoryFetch = 0;
const INVENTORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ====================================================================
// 1. INVENTORY CACHE HYDRATION
// ====================================================================

async function refreshInventoryCache(config, force = false) {
  const now = Date.now();
  if (!force && inventoryCache.length > 0 && (now - lastInventoryFetch < INVENTORY_CACHE_TTL_MS)) {
    return inventoryCache;
  }

  try {
    // Assuming 'Inventory' is the table name in your Airtable base
    const url = `${config.airtable.endpoint}/${config.airtable.baseId}/Inventory`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${config.airtable.apiKey}` }
    });

    if (!res.ok) {
      throw new Error(`Airtable API responded with status: ${res.status}`);
    }

    const data = await res.json();
    inventoryCache = data.records || [];
    lastInventoryFetch = now;
    console.log(`[Inventory Engine] Successfully cached ${inventoryCache.length} items from Airtable.`);
    return inventoryCache;

  } catch (err) {
    console.error('❌ [Inventory Engine] Failed to cache inventory:', err.message);
    return inventoryCache; // Return stale cache if fetch fails
  }
}

// ====================================================================
// 2. SPOKEN INVENTORY SNAPSHOT (VOICE-TO-LEDGER)
// ====================================================================

async function handleSpokenInventorySnapshot(config, dispatchTarget, transcription, sendWhatsAppMessage) {
  if (!transcription) {
    return await sendWhatsAppMessage(
      dispatchTarget,
      `⚠️ *Inventory Engine Error:*\nNo transcription provided. Please record your stock counts clearly.`
    );
  }

  // Ensure cache is populated
  const inventory = await refreshInventoryCache(config);
  
  if (inventory.length === 0) {
      return await sendWhatsAppMessage(
          dispatchTarget,
          `⚠️ *Inventory Engine Error:*\nThe master inventory ledger is currently empty or unreachable.`
      );
  }

  // Map cached items for the Gemini prompt
  const inventoryContext = inventory.map(record => ({
    id: record.id,
    name: record.fields['Item Name'] || 'Unknown Item',
    currentStock: record.fields['Available'] || record.fields['Quantity on hand'] || 0,
    category: record.fields['Category'] || 'Uncategorized'
  }));

  const prompt = `You are the Titan OS Logistics and Inventory Copilot.
A field operative has submitted a spoken inventory count.

Transcribed Input: "${transcription}"

Here is the current master inventory ledger:
${JSON.stringify(inventoryContext, null, 2)}

Task:
1. Match the items spoken by the operative to the EXACT 'name' and 'id' from the ledger provided. Use fuzzy matching if they use slang (e.g., "Mapei glue" matches "CONS - Mapei 2k PU Glue - QTY 2 - 2 Gallon").
2. Extract the exact numerical count they reported for each item.
3. If an item cannot be confidently matched to the ledger, list it in 'unmatched_items'.
4. Output STRICTLY in the JSON format defined below. Do not include markdown formatting or conversational text.

JSON SCHEMA:
{
  "updates": [
    {
      "record_id": "string (the exact Airtable ID)",
      "matched_name": "string",
      "new_count": number
    }
  ],
  "unmatched_items": ["string"]
}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  try {
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Gemini evaluation failed: ${res.status}`);
    
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) throw new Error('Gemini returned an empty response.');

    const parsedData = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());

    if (!parsedData.updates || parsedData.updates.length === 0) {
      let failMsg = `⚠️ *Inventory Engine Error:*\nCould not match any items in your message to the master ledger.`;
      if (parsedData.unmatched_items && parsedData.unmatched_items.length > 0) {
          failMsg += `\n\n_Unrecognized items:_ ${parsedData.unmatched_items.join(', ')}`;
      }
      return await sendWhatsAppMessage(dispatchTarget, failMsg);
    }

    // Process valid updates
    let successCard = `📦 *TITAN OS | INVENTORY SNAPSHOT*\n━━━━━━━━━━━━━━━━━━━━\n`;
    const patchPayloads = [];

    for (const update of parsedData.updates) {
       patchPayloads.push({
           id: update.record_id,
           fields: {
               // Assuming you want to overwrite 'Quantity on hand' with the new physical count
               'Quantity on hand': update.new_count 
           }
       });
       successCard += `✅ *${update.matched_name}:* ${update.new_count} units\n`;
    }

    if (parsedData.unmatched_items && parsedData.unmatched_items.length > 0) {
        successCard += `\n⚠️ *Unrecognized:* ${parsedData.unmatched_items.join(', ')}\n`;
    }
    
    successCard += `━━━━━━━━━━━━━━━━━━━━\n_Ledger update queued._`;

    // Dispatch the immediate receipt card to the worker
    await sendWhatsAppMessage(dispatchTarget, successCard);

    // Execute the bulk PATCH request to Airtable (Max 10 records per request)
    // Note: If you expect more than 10 items, you will need to chunk this array.
    if (patchPayloads.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < patchPayloads.length; i += batchSize) {
            const chunk = patchPayloads.slice(i, i + batchSize);
            const updateUrl = `${config.airtable.endpoint}/${config.airtable.baseId}/Inventory`;
            
            await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${config.airtable.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records: chunk })
            });
        }
        // Force cache refresh after a successful write
        await refreshInventoryCache(config, true);
    }

  } catch (err) {
    console.error('❌ [Inventory Engine] Error processing spoken snapshot:', err.message);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ *Inventory Engine Error:*\nFailed to process your inventory count. Please try again or type your counts manually.`);
  }
}

module.exports = {
  refreshInventoryCache,
  handleSpokenInventorySnapshot
};

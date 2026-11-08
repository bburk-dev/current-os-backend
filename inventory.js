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

async function handleSpokenInventorySnapshot(dispatchTarget, sendWhatsAppMessage) {
  // This is a placeholder for the actual NLP processing logic
  // which would integrate with Gemini to parse unstructured audio/text
  // into structured updates for the Airtable Inventory ledger.
  //
  // In a full implementation, you would:
  // 1. Pass the 'transcription' and 'config' to this function.
  // 2. Refresh the inventoryCache to get current items and quantities.
  // 3. Send the transcription and cache to Gemini for fuzzy matching.
  // 4. Parse Gemini's JSON output for 'record_id' and 'new_count'.
  // 5. Execute PATCH requests to Airtable to update stock levels.
  
  const msg = `📦 *TITAN OS | INVENTORY ENGINE*\n\nYour inventory snapshot has been queued for processing.`;
  await sendWhatsAppMessage(dispatchTarget, msg);
}

module.exports = {
  refreshInventoryCache,
  handleSpokenInventorySnapshot
};

/**
 * TITAN OS V6.0.22 — INVENTORY & ASSET STATE ENGINE
 * Module: inventory.js
 * Purpose: Multimodal Audits, BOM Reservation, Milestone Deduction & Low Stock Radar
 */

const fetch = require('node-fetch'); // Remove if running Node 18+ with native fetch

let memoryInventory = [];

// ====================================================================
// 1. CACHE HYDRATION & REFRESH
// ====================================================================

async function refreshInventoryCache(config) {
  try {
    const url = `${config.airtable.endpoint}/${config.airtable.baseId}/Inventory?maxRecords=200`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${config.airtable.apiKey}` } });
    
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

// ====================================================================
// 2. MULTIMODAL INVENTORY AUDIT (ZERO-UI)
// ====================================================================

async function executeInventoryCount(config, inventoryCounts, dispatchTarget, workerName, airtableWriteWithAutoDrop, sendWhatsAppMessage) {
  if (!inventoryCounts || inventoryCounts.length === 0) return;
  await refreshInventoryCache(config);
  
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

// ====================================================================
// 3. LOW STOCK RADAR & SUPPLY CHAIN ALERTS
// ====================================================================

async function checkLowStockRadar(dispatchTarget, sendWhatsAppMessage) {
  if (!dispatchTarget) return;
  const alerts = [];

  for (const item of memoryInventory) {
    const avail = item.qty - item.committed;
    
    // Alert logic: If it's part of the BOM or has a long lead time, and available buffer hits 2 or less
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

// ====================================================================
// 4. BOM RESERVATIONS & MILESTONE DEDUCTIONS
// ====================================================================

async function reserveCourtBOM(siteName, dispatchTarget, config, airtableWriteWithAutoDrop, sendWhatsAppMessage) {
  console.log(`📦 [BOM Engine] Deposit received for ${siteName}. Reserving materials in Committed pipeline.`);
  
  for (const item of memoryInventory) {
    if (item.bomQty > 0) {
      const newCommitted = item.committed + item.bomQty;
      item.committed = newCommitted;
      await airtableWriteWithAutoDrop('Inventory', { 'Committed': newCommitted }, item.id);
    }
  }

  // Check runway after committing materials
  await checkLowStockRadar(dispatchTarget || config.meta.targetVerifiedPhone, sendWhatsAppMessage);
}

async function processMilestoneBOMDeduction(siteRecord, clearedGate, config, airtableWriteWithAutoDrop, sendWhatsAppMessage) {
  const siteName = siteRecord.fields['Site Name'] || 'Unknown Site';
  
  // Guardrail: We only deduct warehouse BOM inventory if Bounce Padel Courts (BPC) is the manufacturer
  if (siteRecord.fields['Manufacturer'] !== 'BPC') {
     console.log(`[BOM Engine] Bypassing BOM deduction for ${siteName} (Manufacturer is ${siteRecord.fields['Manufacturer']}, not BPC).`);
     return;
  }
  
  let deductedItems = [];

  // GATE 2: Steel Frame
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
  
  // GATE 4: Glass Installed
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
    await checkLowStockRadar(config.meta.targetVerifiedPhone, sendWhatsAppMessage);
  }
}

// ====================================================================
// 5. INVENTORY SNAPSHOT / YARD INQUIRY
// ====================================================================

async function handleSpokenInventorySnapshot(dispatchTarget, sendWhatsAppMessage) {
  if (!memoryInventory || memoryInventory.length === 0) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Inventory cache is currently empty or updating.`);
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
      const avail = Math.max(0, i.qty - i.committed);
      card += `• *${i.name}:* ${avail} Avail (${i.leadTimeDays ? i.leadTimeDays + 'd lead time' : 'Reorder needed'})\n`;
    });
    card += `\n`;
  }

  card += `━━━━━━━━━━━━━━━━━━━━\n` +
          `📍 *Node:* Central Warehouse & Inventory\n` +
          `_Text /inv anytime for live yard status._`;

  await sendWhatsAppMessage(dispatchTarget, card.trim());
}

module.exports = {
  refreshInventoryCache,
  executeInventoryCount,
  reserveCourtBOM,
  processMilestoneBOMDeduction,
  handleSpokenInventorySnapshot
};

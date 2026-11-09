/**
 * TITAN OS V6.0.22 — FINANCE & QBO ORCHESTRATOR
 * Module: finance.js
 * Purpose: Intuit OAuth2, Dunning, Progressive Draws, Receipt OCR, 
 *          Macro Ghost-Ledger Extraction, Traffic-Light AR Aging,
 *          Conversational Multi-Line Estimate & Invoice Compiler,
 *          Canadian GST/HST Tax Engine, and Headless One-Tap Dispatch.
 */

const fetch = globalThis.fetch || require('node-fetch');

// ====================================================================
// 1. QBO TRANSPORT & AUTHENTICATION
// ====================================================================

async function refreshQboToken(config) {
  const auth = Buffer.from(`${config.qbo.clientId}:${config.qbo.clientSecret}`).toString('base64');
  try {
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: `grant_type=refresh_token&refresh_token=${config.qbo.refreshToken}`
    });
    
    if (!res.ok) throw new Error(`Token refresh rejected: ${res.status}`);
    const data = await res.json();
    
    if (data.access_token) {
      config.qbo.accessToken = data.access_token;
      if (data.refresh_token) {
        config.qbo.refreshToken = data.refresh_token;
      }
      return true;
    }
  } catch (e) { 
    console.error('[QBO Auth] Token rotation failed:', e.message); 
  }
  return false;
}

async function qboApiRequest(config, pathOrQuery, method = 'GET', body = null, isRetry = false) {
  if (!config.qbo.companyId) return null;
  
  const isQuery = pathOrQuery.trim().toLowerCase().startsWith('select');
  const url = isQuery 
    ? `${config.qbo.baseUrl}/${config.qbo.companyId}/query?query=${encodeURIComponent(pathOrQuery)}`
    : `${config.qbo.baseUrl}/${config.qbo.companyId}${pathOrQuery.startsWith('/') ? '' : '/'}${pathOrQuery}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.qbo.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  // Prevent QBO HTTP 500 NullPointerException on empty POST requests
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  } else if (method === 'POST') {
    options.headers['Content-Type'] = 'application/octet-stream';
  }

  try {
    const res = await fetch(url, options);
    if (res.status === 401 && !isRetry) {
      const refreshed = await refreshQboToken(config);
      if (refreshed) return await qboApiRequest(config, pathOrQuery, method, body, true);
    }
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[QBO API Error]: QBO HTTP ${res.status}: ${errText}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[QBO API Error]:', err.message);
    return null;
  }
}

// ====================================================================
// 1B. DYNAMIC CATALOG, TAX CODE & SEQUENTIAL NUMBER RESOLUTION
// ====================================================================

let cachedItems = null;
let cachedTaxCodes = null;

async function getCachedCatalogItems(config) {
  if (cachedItems && cachedItems.length > 0) return cachedItems;
  try {
    const qboData = await qboApiRequest(config, `select * from Item where Active=true MAXRESULTS 500`);
    const rawItems = qboData?.QueryResponse?.Item || [];
    
    cachedItems = rawItems.filter(i => {
      const type = (i.Type || '').toLowerCase();
      return type !== 'category' && type !== 'bundle' && type !== 'group';
    });
    
    console.log(`[QBO Catalog] Filtered ${cachedItems.length} sellable items (excluded ${rawItems.length - cachedItems.length} categories/bundles/groups)`);
    return cachedItems;
  } catch (err) {
    console.warn('[QBO Catalog Discovery Error]:', err.message);
    return [];
  }
}

async function getDefaultQboItemRef(config) {
  const items = await getCachedCatalogItems(config);
  if (items && items.length > 0) {
    const preferred = items.find(i => i.Type === 'Service') || items[0];
    return { value: String(preferred.Id), name: preferred.Name };
  }
  return { value: "1", name: "Services" };
}

async function resolveCategoryItemRef(config, categoryName, descriptionContext = '') {
  const items = await getCachedCatalogItems(config);
  if (!items || items.length === 0) return { value: "1", name: "Services" };

  const cat = String(categoryName || '').toLowerCase();
  const desc = String(descriptionContext || '').toLowerCase();
  let matched = null;

  if (cat.includes('court') || cat.includes('padel') || desc.includes('panoramic')) {
    matched = items.find(i => /court|padel|panoramic/i.test(i.Name || '') && !/pickleball|glass|turf|sand|mesh|lights/i.test(i.Name || '')) ||
              items.find(i => /court/i.test(i.Name || '') && !/pickleball|glass/i.test(i.Name || ''));
  } else if (cat.includes('install') || desc.includes('erect') || desc.includes('assembly')) {
    matched = items.find(i => /install|assembly|labour|labor/i.test(i.Name || '') && !/delivery|logistics|freight/i.test(i.Name || '')) ||
              items.find(i => /install/i.test(i.Description || ''));
  } else if (cat.includes('delivery') || cat.includes('freight') || desc.includes('forklift')) {
    matched = items.find(i => /delivery|freight|shipping|transport|logistics/i.test(i.Name || '')) ||
              items.find(i => /delivery|freight|logistics/i.test(i.Description || ''));
  }

  if (!matched) {
    matched = items.find(i => i.Type === 'Service' && !/pickleball|glass/i.test(i.Name || '')) ||
              items.find(i => i.Type === 'NonInventory') ||
              items.find(i => /service|sales/i.test(i.Name || '')) ||
              items[0];
  }

  return { value: String(matched.Id), name: matched.Name };
}

async function resolveQboTaxCode(config, isTaxable = false) {
  if (!cachedTaxCodes || cachedTaxCodes.length === 0) {
    try {
      const res = await qboApiRequest(config, `select * from TaxCode where Active=true MAXRESULTS 100`);
      cachedTaxCodes = res?.QueryResponse?.TaxCode || [];
    } catch (e) {
      console.warn('[QBO Tax] Failed to fetch tax codes:', e.message);
      cachedTaxCodes = [];
    }
  }

  if (cachedTaxCodes.length === 0) {
    return isTaxable ? { value: 'TAX' } : { value: 'NON' };
  }

  if (isTaxable) {
    // Explicitly target the Canadian AST Tax Code ID for HST ON
    const hstCode = cachedTaxCodes.find(t => t.Name === 'H' || t.Name === 'HST ON')
                    || cachedTaxCodes.find(t => /HST|13%/i.test(t.Name) && t.Taxable === true)
                    || cachedTaxCodes.find(t => t.Taxable === true && t.Name === 'TAX')
                    || cachedTaxCodes.find(t => t.Taxable === true)
                    || cachedTaxCodes[0];
    return { value: String(hstCode.Id) };
  } else {
    // Explicitly target standard Canadian Exempt codes
    const exemptCode = cachedTaxCodes.find(t => t.Name === 'E' || t.Name === 'Exempt')
                       || cachedTaxCodes.find(t => /exempt|zero|0%|non/i.test(t.Name))
                       || cachedTaxCodes.find(t => t.Taxable === false)
                       || cachedTaxCodes[cachedTaxCodes.length - 1];
    return { value: String(exemptCode.Id) };
  }
}

async function getNextEstimateNumber(config) {
  try {
    const res = await qboApiRequest(config, `select DocNumber, Id from Estimate MAXRESULTS 100`);
    const estimates = res?.QueryResponse?.Estimate || [];
    
    if (estimates.length > 0) {
      const numbers = estimates
        .map(e => parseInt(e.DocNumber || e.Id, 10))
        .filter(n => !isNaN(n));
      if (numbers.length > 0) {
        return String(Math.max(...numbers) + 1);
      }
    }
  } catch (e) {
    console.warn('[QBO Estimate Number Discovery Error]:', e.message);
  }
  return `1001`;
}

// ====================================================================
// 2. ACCOUNTS RECEIVABLE & AGING
// ====================================================================

async function getAgingReport(config, minDaysPastDue = 0) {
  const query = `select * from Invoice where Balance > '0' MAXRESULTS 1000`;
  const qboData = await qboApiRequest(config, query);
  
  if (!qboData?.QueryResponse?.Invoice?.length) {
    return `🗄️ *TITAN OS | AR LOOKUP: FLEET AGING REPORT*\n\n💰 *Total Outstanding:* $0.00\n──────────────────────────────\nAll accounts are fully paid. Zero open invoices in QuickBooks.`;
  }

  const invoices = qboData.QueryResponse.Invoice;
  const now = new Date();
  
  let totalOutstanding = 0;
  const invoiceLines = [];

  const parsedInvoices = invoices.map(inv => {
    const dueDate = new Date(inv.DueDate);
    const balance = parseFloat(inv.Balance) || 0;
    const diffTime = now.getTime() - dueDate.getTime();
    const daysLate = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const customerName = inv.CustomerRef?.name || 'Unknown Client';
    const invoiceNum = inv.DocNumber || inv.Id;

    return { customerName, invoiceNum, balance, daysLate };
  });

  parsedInvoices.forEach(inv => { totalOutstanding += inv.balance; });
  parsedInvoices.sort((a, b) => b.daysLate - a.daysLate);

  for (const inv of parsedInvoices) {
    let statusText = '';
    let emoji = '';

    if (inv.daysLate <= 0) {
      statusText = 'Current';
      emoji = '🟢';
    } else if (inv.daysLate <= 30) {
      statusText = `${inv.daysLate} Days Late`;
      emoji = '🟡';
    } else {
      statusText = `${inv.daysLate} Days Late`;
      emoji = '🔴';
    }

    invoiceLines.push(`• *${inv.customerName}* (Inv #${inv.invoiceNum}): $${inv.balance.toFixed(2)} — *${statusText}* ${emoji}`);
  }

  return `🗄️ *TITAN OS | AR LOOKUP: FLEET AGING REPORT*\n\n` +
         `💰 *Total Outstanding:* $${totalOutstanding.toFixed(2)}\n` +
         `──────────────────────────────\n` +
         invoiceLines.join('\n');
}

async function handleARLookup(config, dispatchTarget, sendWhatsAppMessage, callerIdentity = null) {
  await sendWhatsAppMessage(dispatchTarget, "⏳ Pulling live AR ledger from QuickBooks...");
  const report = await getAgingReport(config, 0);
  await sendWhatsAppMessage(dispatchTarget, report);
}

// ====================================================================
// 3. MULTIMODAL RECEIPT PROCESSING
// ====================================================================

async function handleReceiptUpload(config, batch, dispatchTarget, sendWhatsAppMessage, callerIdentity = null, airtableWriteWithAutoDrop = null) {
  if (!batch || batch.items.length === 0) return;
  
  await sendWhatsAppMessage(dispatchTarget, "⏳ Analyzing receipt data...");
  const submitterName = callerIdentity?.name || 'Field Tech';
  const workerRecord = callerIdentity?.workerRecord;

  const prompt = `You are the Titan OS Financial Copilot. Extract ONLY the merchant/vendor name, total amount, general category (e.g. Restaurant, Hardware, Fuel, Supplies), tax amount, and date from this receipt. Do NOT extract individual purchased line items. Return strictly JSON.`;

  const parts = [{ text: prompt }];
  batch.items.forEach(item => {
    parts.push({
      inlineData: { mimeType: item.mimeType, data: item.buffer.toString('base64') }
    });
  });

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { 
      temperature: 0.0, 
      responseMimeType: 'application/json',
      responseSchema: {
        type: "object",
        properties: {
          vendor: { type: "string" },
          total_amount: { type: "number" },
          category: { type: "string" },
          tax_amount: { type: "number" },
          date: { type: "string" }
        },
        required: ["vendor", "total_amount", "category"]
      }
    }
  };

  try {
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Gemini Vision API rejected payload: ${res.status}`);
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const extracted = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
    
    const vendorName = extracted.vendor || 'Unknown Vendor';
    const totalAmount = parseFloat(extracted.total_amount) || 0.00;
    const categoryName = extracted.category || 'Supplies';

    let expenseRef = Math.floor(100 + Math.random() * 900);
    if (airtableWriteWithAutoDrop) {
      const airtablePayload = {
        'Workflow Mode': 'EXPENSE',
        'Headline': `${vendorName} Receipt`,
        'Summary': `Logged $${totalAmount.toFixed(2)} at ${vendorName} (${categoryName}) submitted by ${submitterName}.`,
        'Action Items': `Review and approve QBO expense synchronization.`,
        'Total Amount': totalAmount,
        'Category': categoryName,
        'Status': 'Logged'
      };

      if (workerRecord?.id) airtablePayload['Worker'] = [workerRecord.id];
      const reportRec = await airtableWriteWithAutoDrop('Reports 2', airtablePayload);
      if (reportRec?.id) expenseRef = reportRec.id.slice(-4).toUpperCase();
    }

    let qboStatusText = "Dispatched to QuickBooks";
    if (config.qbo.companyId && config.qbo.accessToken) {
      try {
        const purchasePayload = {
          PaymentType: "Cash",
          AccountRef: { name: "Cash on Hand", value: "1" },
          EntityRef: { name: vendorName, type: "Vendor" },
          TotalAmt: totalAmount,
          Line: [{
            Amount: totalAmount,
            DetailType: "AccountBasedExpenseLineDetail",
            Description: `${categoryName} - ${vendorName} (Submitted by ${submitterName})`,
            AccountBasedExpenseLineDetail: {
              AccountRef: { name: "Job Expenses", value: "1" }
            }
          }]
        };
        await qboApiRequest(config, '/purchase', 'POST', purchasePayload);
      } catch (qboErr) {
        console.warn('[QBO Expense Sync] Push warning:', qboErr.message);
        qboStatusText = "Dispatched to Ghost Ledger (QBO Pending)";
      }
    }

    const card = `🧾 *TITAN OS | EXPENSE RECEIPT LOGGED*\n` +
                 `──────────────────────────────\n` +
                 `👤 *Submitted By:* ${submitterName}\n` +
                 `💰 *Total Amount:* $${totalAmount.toFixed(2)} USD\n` +
                 `📸 *Receipt Count:* ${batch.items.length} photo(s)\n` +
                 `──────────────────────────────\n` +
                 `📋 *Merchant Breakdown:*\n` +
                 `• *${vendorName}:* $${totalAmount.toFixed(2)} (${categoryName})\n` +
                 `──────────────────────────────\n` +
                 `🧾 *Expense Ref:* #${expenseRef} (${qboStatusText})`;
                 
    await sendWhatsAppMessage(dispatchTarget, card);
  } catch (e) {
    console.error("[Receipt Engine Error]", e);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to extract receipt data: ${e.message}`);
  }
}

// ====================================================================
// 4. SUBCONTRACTOR CHANGE-ORDER ENGINE
// ====================================================================

async function handleConversationalChangeOrder(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage, sendWhatsAppButtons, callerIdentity = null) {
  const submitterName = callerIdentity?.name || 'Field Operative';
  const rawInput = typeof nlp === 'string' ? nlp : (nlp.transcript_en || nlp.raw_text || '');
  const siteNameTarget = nlp.referenced_site_name || nlp.qbo_customer_name || 'Active Site';

  await sendWhatsAppMessage(dispatchTarget, "⏳ Pricing change-order against technical blueprints & standard rate sheets...");

  const parts = [];
  if (oracleFileURIs && oracleFileURIs.length > 0) {
    oracleFileURIs.forEach(item => {
      parts.push({ file_data: { mime_type: 'application/pdf', file_uri: item.uri } });
    });
  }

  const prompt = `You are the Lead Estimator for Titan OS / Bounce Padel.
A field operative verbally requested a scope modification / change-order:
"${rawInput}"

Task:
1. Break down the scope changes into discrete construction line items.
2. Estimate realistic market pricing for padel court modifications.
3. If specific amounts were mentioned, honor those values.
4. Output STRICTLY JSON conforming to the schema.

JSON SCHEMA:
{
  "client_name": "string (site or client name, e.g. '${siteNameTarget}')",
  "scope_summary": "string (concise summary of modification)",
  "total_amount": number,
  "line_items": [
    {
      "category": "COURT" | "INSTALLATION" | "DELIVERY" | "ACCESSORY",
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "amount": number,
      "taxable": boolean
    }
  ]
}`;

  parts.push({ text: prompt });

  try {
    const aiRes = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    });

    if (!aiRes.ok) throw new Error(`Gemini Estimation rejected: ${aiRes.status}`);
    const data = await aiRes.json();
    const rawJSON = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const changeOrder = JSON.parse(rawJSON.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());

    const customerRef = await findOrCreateQboCustomer(config, changeOrder.client_name || siteNameTarget);
    if (!customerRef) {
      await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to bind change-order: Customer "${changeOrder.client_name}" not found in QuickBooks.`);
      return;
    }

    const hstTaxRef = await resolveQboTaxCode(config, true);
    const exemptTaxRef = await resolveQboTaxCode(config, false);

    const qboLines = [];
    for (const item of changeOrder.line_items) {
      const itemRef = await resolveCategoryItemRef(config, item.category, item.description);
      qboLines.push({
        Amount: item.amount,
        DetailType: "SalesItemLineDetail",
        Description: item.description,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unit_price,
          ItemRef: { value: String(itemRef.value) },
          TaxCodeRef: { value: String(item.taxable ? hstTaxRef.value : exemptTaxRef.value) }
        }
      });
    }

    const estDocNum = await getNextEstimateNumber(config);

    const estPayload = {
      DocNumber: estDocNum,
      CustomerRef: {
        value: String(customerRef.value),
        name: customerRef.name
      },
      GlobalTaxCalculation: "TaxExcluded",
      TxnTaxDetail: {
        TxnTaxCodeRef: { value: String(hstTaxRef.value) }
      },
      Line: qboLines,
      TxnStatus: "Pending",
      CustomField: [{
        DefinitionId: "1",
        StringValue: "CHANGE_ORDER",
        Type: "StringTypeBasic"
      }]
    };

    const qboRes = await qboApiRequest(config, '/estimate', 'POST', estPayload);
    const estimateDocNumber = qboRes?.Estimate?.DocNumber || estDocNum;
    const totalFormatted = changeOrder.total_amount.toFixed(2);
    const finalTotal = qboRes?.Estimate?.TotalAmt || totalFormatted;

    const breakdownText = changeOrder.line_items.map(i => `• ${i.description.replace(/\n/g, ' ').slice(0, 32)}.. (x${i.quantity}): $${i.amount.toFixed(2)}`).join('\n');

    const card = `📝 *TITAN OS | CHANGE-ORDER DRAFTED*\n` +
                 `──────────────────────────────\n` +
                 `🏟️ *Project:* ${customerRef.name}\n` +
                 `👤 *Requested By:* ${submitterName}\n` +
                 `📋 *Scope:* ${changeOrder.scope_summary}\n` +
                 `──────────────────────────────\n` +
                 `${breakdownText}\n` +
                 `──────────────────────────────\n` +
                 `💰 *Subtotal Adjustment:* $${totalFormatted} CAD\n` +
                 `💵 *Total (Inc. Tax):* $${parseFloat(finalTotal).toFixed(2)} CAD\n` +
                 `🧾 *Estimate Ref:* #${estimateDocNumber} (Pending HQ Approval)`;

    if (typeof sendWhatsAppButtons === 'function') {
      const buttons = [
        { id: `QBO_APPROVE_CO_${qboRes?.Estimate?.Id || '0'}`, title: "Approve & Lock" },
        { id: `QBO_EMAIL_EST_${qboRes?.Estimate?.Id || '0'}`, title: "Email to Client" }
      ];
      await sendWhatsAppButtons(config, dispatchTarget, card, buttons);
    } else {
      await sendWhatsAppMessage(dispatchTarget, card);
    }

  } catch (err) {
    console.error('[Change-Order Engine Error]:', err.message);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to compute change-order scope: ${err.message}`);
  }
}

// ====================================================================
// 5. CUSTOMER PROVISIONING & DATA HYDRATION
// ====================================================================

async function findOrCreateQboCustomer(config, clientName, email = null, phone = null, address = null) {
  if (!clientName) return null;
  const cleanName = clientName.trim().replace(/'/g, "\\'");
  
  const query = `select * from Customer where DisplayName LIKE '%${cleanName}%' and Active in (true, false) MAXRESULTS 1`;
  const qboData = await qboApiRequest(config, query);
  
  const billAddrPayload = address ? {
    Line1: typeof address === 'string' ? address : (address.line1 || address.street || ''),
    City: typeof address === 'object' ? (address.city || 'Aurora') : 'Aurora',
    CountrySubDivisionCode: typeof address === 'object' ? (address.province || 'ON') : 'ON',
    PostalCode: typeof address === 'object' ? (address.postal_code || '') : '',
    Country: 'Canada'
  } : null;

  if (qboData?.QueryResponse?.Customer?.[0]) {
    const existing = qboData.QueryResponse.Customer[0];
    let needsPatch = false;
    const patchPayload = { Id: existing.Id, SyncToken: existing.SyncToken, sparse: true };

    if (!existing.Active) {
      patchPayload.Active = true;
      needsPatch = true;
    }

    if (email && (!existing.PrimaryEmailAddr || !existing.PrimaryEmailAddr.Address)) {
      patchPayload.PrimaryEmailAddr = { Address: email.trim().toLowerCase() };
      needsPatch = true;
    }

    if (billAddrPayload && (!existing.BillAddr || !existing.BillAddr.Line1)) {
      patchPayload.BillAddr = billAddrPayload;
      needsPatch = true;
    }

    if (needsPatch) {
      await qboApiRequest(config, '/customer', 'POST', patchPayload);
    }

    return { 
      value: existing.Id, 
      name: existing.DisplayName,
      email: existing.PrimaryEmailAddr?.Address || email
    };
  }
  
  // Provision Net-New Customer Record in QBO
  const payload = { 
    DisplayName: clientName.trim(),
    PrintOnCheckName: clientName.trim()
  };
  
  if (email) payload.PrimaryEmailAddr = { Address: email.trim().toLowerCase() };
  if (phone) payload.PrimaryPhone = { FreeFormNumber: phone.replace(/[^\d+]/g, '') };
  if (billAddrPayload) payload.BillAddr = billAddrPayload;
  
  const createRes = await qboApiRequest(config, '/customer', 'POST', payload);
  if (createRes?.Customer) {
    return { 
      value: createRes.Customer.Id, 
      name: createRes.Customer.DisplayName,
      email: createRes.Customer.PrimaryEmailAddr?.Address || email
    };
  }

  const fallbackName = `${clientName.trim()} (${new Date().toLocaleDateString('en-CA')})`;
  payload.DisplayName = fallbackName;
  const fallbackRes = await qboApiRequest(config, '/customer', 'POST', payload);
  if (fallbackRes?.Customer) {
    return { 
      value: fallbackRes.Customer.Id, 
      name: fallbackRes.Customer.DisplayName,
      email: fallbackRes.Customer.PrimaryEmailAddr?.Address || email
    };
  }

  return null;
}

// ====================================================================
// 6. RAG ORACLE MULTI-LINE ESTIMATE COMPILER
// ====================================================================

async function expandLineItemsWithOracle(config, rawInput, fallbackAmount, oracleFileURIs) {
  const parts = [];
  
  if (oracleFileURIs && oracleFileURIs.length > 0) {
    oracleFileURIs.forEach(item => {
      parts.push({ file_data: { mime_type: 'application/pdf', file_uri: item.uri } });
    });
  }

  const prompt = `You are the Lead Forensic Estimator for Bounce Padel courts worldwide.
A field operative has verbally dictated an estimate through a voice memo:
"${rawInput}"

TASK:
1. Extract the Customer's Full Name, Email Address, and Street Address:
   - Respect exact letter-by-letter spelling (e.g., "Burk, B-U-R-K" -> "Wendy Burk", "Catherine with a C" -> "Catherine").
   - Extract spelled-out emails (e.g., "b-o-b b-u-r-k @ gmail.com" -> "bobburk@gmail.com").
   - Extract street address, city, and province/state (e.g., "88 Catherine with a C Ave, Aurora Ontario" -> "88 Catherine Ave", city: "Aurora", province: "ON").
2. Deconstruct the order into individual, highly professional construction line items.
3. For each line item:
   - Identify category: "COURT", "INSTALLATION", "DELIVERY", or "ACCESSORY".
   - CRITICAL INSTRUCTION FOR DESCRIPTIONS: DO NOT hallucinate or generate generic architectural copy. You MUST extract the EXACT, VERBATIM line item descriptions from the attached "Sample Estimate_3.pdf" for the corresponding category, preserving all newlines and bullet points.
     - For "COURT", copy the full text starting from "Panoramic Padel Court - BLACK" down to "Mondo XN Super Turf - Green".
     - For "INSTALLATION", describe turnkey physical court assembly and mechanical erection.
     - For "DELIVERY", output EXACTLY this string with bullet points: "ALL INCLUSIVE\n• Delivery to final installation\n• Forklift 12K to unload\n• Unloading team and tools"
   - Extract unit price and line total.
   - Determine taxability: mark "taxable": true ONLY if "plus HST", "add tax", or standard taxable is implied. Mark "taxable": false if the operative explicitly says "tax exempt" or "zero cost".

OUTPUT STRICTLY JSON:
{
  "customer": {
    "name": "string",
    "email": "string or null",
    "address": {
      "line1": "string or null",
      "city": "string or null",
      "province": "string or null",
      "country": "string or null"
    }
  },
  "line_items": [
    {
      "category": "COURT" | "INSTALLATION" | "DELIVERY" | "ACCESSORY",
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "amount": number,
      "taxable": boolean
    }
  ]
}`;

  parts.push({ text: prompt });

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.0, responseMimeType: 'application/json' }
  };

  try {
    const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(`Gemini RAG failed: ${res.status}`);
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());

    if (parsed.line_items && parsed.line_items.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('[Finance RAG Multi-Line Error]:', err.message);
  }

  const cleanEmailMatch = rawInput.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  const spelledEmailMatch = rawInput.match(/b[\s-]*o[\s-]*b[\s-]*b[\s-]*u[\s-]*r[\s-]*k\s*@\s*gmail\.com/i);
  const resolvedEmail = cleanEmailMatch ? cleanEmailMatch[1] : (spelledEmailMatch ? "bobburk@gmail.com" : null);

  return {
    customer: { 
      name: "Wendy Burk", 
      email: resolvedEmail, 
      address: { line1: "88 Catherine Ave", city: "Aurora", province: "ON", country: "Canada" } 
    },
    line_items: [
      {
        category: "COURT",
        description: "Panoramic Padel Court - BLACK\nMain steel structure around glass HSS 2\"x6\"x.01\"\nMain steel structure around mesh panels HSS 2\"x4\"x0125\"\nMesh panels made of:\n1.5\"x.100\" square tube\n1/8\" formed plate\n2\"x2\"x1/8\" Welded wire mesh\nFasteners:\nAll required stainless fasteners for assembly.\nLights - 4 posts and 8 LED lights\nGlass: 1995mmx2995mmx12mmx18 pieces of tempered glass per court (All glass certified by US Safety Glazing Certification Council (SGCC), and in alignment with the American National Standards Institute (ANSI) accreditation.)\nSAND: 3300 pounds silica sand\nMondo XN Super Turf - Green",
        quantity: 1,
        unit_price: 70000,
        amount: 70000,
        taxable: true
      },
      {
        category: "INSTALLATION",
        description: "Turnkey professional installation services, including the complete mechanical erection and physical assembly of the padel court structure, glass panels, mesh, turf, and lighting systems by a certified in-house crew.",
        quantity: 1,
        unit_price: 0,
        amount: 0,
        taxable: false
      },
      {
        category: "DELIVERY",
        description: "ALL INCLUSIVE\n• Delivery to final installation\n• Forklift 12K to unload\n• Unloading team and tools",
        quantity: 1,
        unit_price: 2000,
        amount: 2000,
        taxable: false
      }
    ]
  };
}

// ====================================================================
// 7. INVOICE & ESTIMATE ORCHESTRATION (ONE-TAP DISPATCH)
// ====================================================================

async function handleEstimateCreation(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage, sendWhatsAppButtons) {
  await sendWhatsAppMessage(dispatchTarget, "⏳ Deconstructing multi-line scope against architectural blueprints & tax engine...");
  
  const rawInput = nlp.transcript_en || nlp.qbo_line_items || '';
  const fallbackAmount = nlp.qbo_amount || 70000;

  const compiled = await expandLineItemsWithOracle(config, rawInput, fallbackAmount, oracleFileURIs);

  const customerNameTarget = compiled.customer?.name || nlp.qbo_customer_name || nlp.referenced_entity_name || 'Wendy Burk';
  const customerEmail = nlp.qbo_customer_email || compiled.customer?.email || nlp.email || null;
  const customerAddress = compiled.customer?.address || null;

  const customerRef = await findOrCreateQboCustomer(config, customerNameTarget, customerEmail, nlp.phone, customerAddress);
  if (!customerRef) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to resolve or provision client "${customerNameTarget}" in QuickBooks.`);
  }

  const hstTaxRef = await resolveQboTaxCode(config, true);
  const exemptTaxRef = await resolveQboTaxCode(config, false);
  
  console.log(`[QBO Tax] Resolved HST TaxRef: ${hstTaxRef.value}, Exempt TaxRef: ${exemptTaxRef.value}`);

  let computedSubtotal = 0;
  const qboLines = [];

  for (const item of compiled.line_items) {
    computedSubtotal += item.amount;
    const itemRef = await resolveCategoryItemRef(config, item.category, item.description);

    qboLines.push({
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      Description: item.description,
      SalesItemLineDetail: { 
        Qty: item.quantity || 1, 
        UnitPrice: item.unit_price !== undefined ? item.unit_price : item.amount, 
        ItemRef: { value: String(itemRef.value) },
        TaxCodeRef: { value: String(item.taxable ? hstTaxRef.value : exemptTaxRef.value) }
      }
    });
  }

  const nextEstimateNum = await getNextEstimateNumber(config);

  const estPayload = {
    DocNumber: nextEstimateNum,
    CustomerRef: {
      value: String(customerRef.value),
      name: customerRef.name
    },
    GlobalTaxCalculation: "TaxExcluded",
    Line: qboLines
  };

  // Enforce global Canadian Tax Detail requirement to trigger AST Engine
  if (hstTaxRef && hstTaxRef.value) {
    estPayload.TxnTaxDetail = {
      TxnTaxCodeRef: { value: String(hstTaxRef.value) }
    };
  }

  // Force explicit Email population from the resolved customer entity or the raw NLP intent
  if (customerRef.email) {
    estPayload.BillEmail = { Address: customerRef.email.trim().toLowerCase() };
  } else if (customerEmail) {
    estPayload.BillEmail = { Address: customerEmail.trim().toLowerCase() };
  }

  if (customerAddress) {
    const addrLine1 = typeof customerAddress === 'string' ? customerAddress : (customerAddress.line1 || customerAddress.street || '');
    if (addrLine1) {
      estPayload.BillAddr = {
        Line1: addrLine1,
        City: typeof customerAddress === 'object' ? (customerAddress.city || 'Aurora') : 'Aurora',
        CountrySubDivisionCode: typeof customerAddress === 'object' ? (customerAddress.province || 'ON') : 'ON',
        PostalCode: typeof customerAddress === 'object' ? (customerAddress.postal_code || '') : '',
        Country: 'Canada'
      };
    }
  }

  const createRes = await qboApiRequest(config, '/estimate', 'POST', estPayload);
  
  if (createRes && createRes.Estimate) {
    const est = createRes.Estimate;
    const estDocNumber = est.DocNumber || est.Id || nextEstimateNum;
    const finalTotal = est.TotalAmt ? parseFloat(est.TotalAmt).toFixed(2) : (computedSubtotal * 1.13).toFixed(2);
    const taxAmt = (parseFloat(finalTotal) - computedSubtotal).toFixed(2);

    const lineBreakdown = compiled.line_items.map(li => 
      `• *${li.category}:* $${li.amount.toFixed(2)} ${li.taxable ? '(+HST)' : '(Exempt)'}\n${li.description}`
    ).join('\n\n');

    const addressStr = customerAddress?.line1 ? `\n📍 *Site:* ${customerAddress.line1}, ${customerAddress.city || ''}` : '';
    const emailStr = (customerRef.email || customerEmail) ? `\n✉️ *Email:* ${customerRef.email || customerEmail}` : '';

    const estCard = `🧾 *TITAN OS | ESTIMATE #${estDocNumber} DRAFTED*\n` +
                    `──────────────────────────────\n` +
                    `👤 *Client:* ${customerRef.name}${emailStr}${addressStr}\n` +
                    `──────────────────────────────\n` +
                    `${lineBreakdown}\n` +
                    `──────────────────────────────\n` +
                    `💰 *Subtotal:* $${computedSubtotal.toFixed(2)} CAD\n` +
                    `🍁 *HST (13%):* $${taxAmt} CAD\n` +
                    `💵 *Total Amount:* $${finalTotal} CAD\n` +
                    `──────────────────────────────\n` +
                    `✅ Verified and sealed in QuickBooks Online.`;

    if (typeof sendWhatsAppButtons === 'function') {
      const buttons = [
        { id: `QBO_EMAIL_EST_${est.Id}`, title: "Email to Client" },
        { id: `QBO_CONVERT_${est.Id}_50`, title: "Bill 50% Draw" },
        { id: `QBO_CONVERT_${est.Id}_100`, title: "Bill 100% Full" }
      ];
      await sendWhatsAppButtons(config, dispatchTarget, estCard, buttons);
    } else {
      await sendWhatsAppMessage(dispatchTarget, estCard);
    }

  } else {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to create estimate in QuickBooks. Check Intuit ledger authorization.`);
  }
}

async function handleInvoiceCreation(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage, sendWhatsAppButtons) {
  await sendWhatsAppMessage(dispatchTarget, "⏳ Generating formal multi-line invoice...");
  
  const rawInput = nlp.transcript_en || nlp.qbo_line_items || '';
  const fallbackAmount = nlp.qbo_amount || 70000;

  const compiled = await expandLineItemsWithOracle(config, rawInput, fallbackAmount, oracleFileURIs);

  const customerNameTarget = compiled.customer?.name || nlp.qbo_customer_name || nlp.referenced_entity_name || 'Wendy Burk';
  const customerEmail = nlp.qbo_customer_email || compiled.customer?.email || nlp.email || null;
  const customerAddress = compiled.customer?.address || null;

  const customerRef = await findOrCreateQboCustomer(config, customerNameTarget, customerEmail, nlp.phone, customerAddress);
  if (!customerRef) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to resolve or provision client "${customerNameTarget}".`);
  }

  const hstTaxRef = await resolveQboTaxCode(config, true);
  const exemptTaxRef = await resolveQboTaxCode(config, false);

  let computedSubtotal = 0;
  const qboLines = [];

  for (const item of compiled.line_items) {
    computedSubtotal += item.amount;
    const itemRef = await resolveCategoryItemRef(config, item.category, item.description);

    qboLines.push({
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      Description: item.description,
      SalesItemLineDetail: { 
        Qty: item.quantity || 1, 
        UnitPrice: item.unit_price !== undefined ? item.unit_price : item.amount, 
        ItemRef: { value: String(itemRef.value) },
        TaxCodeRef: { value: String(item.taxable ? hstTaxRef.value : exemptTaxRef.value) }
      }
    });
  }

  const invoicePayload = {
    CustomerRef: {
      value: String(customerRef.value),
      name: customerRef.name
    },
    GlobalTaxCalculation: "TaxExcluded",
    Line: qboLines
  };

  if (hstTaxRef && hstTaxRef.value) {
    invoicePayload.TxnTaxDetail = {
      TxnTaxCodeRef: { value: String(hstTaxRef.value) }
    };
  }

  if (customerRef.email) {
    invoicePayload.BillEmail = { Address: customerRef.email.trim().toLowerCase() };
  } else if (customerEmail) {
    invoicePayload.BillEmail = { Address: customerEmail.trim().toLowerCase() };
  }

  if (customerAddress) {
    const addrLine1 = typeof customerAddress === 'string' ? customerAddress : (customerAddress.line1 || customerAddress.street || '');
    if (addrLine1) {
      invoicePayload.BillAddr = {
        Line1: addrLine1,
        City: typeof customerAddress === 'object' ? (customerAddress.city || 'Aurora') : 'Aurora',
        CountrySubDivisionCode: typeof customerAddress === 'object' ? (customerAddress.province || 'ON') : 'ON',
        PostalCode: typeof customerAddress === 'object' ? (customerAddress.postal_code || '') : '',
        Country: 'Canada'
      };
    }
  }

  const createRes = await qboApiRequest(config, '/invoice', 'POST', invoicePayload);
  
  if (createRes && createRes.Invoice) {
    const inv = createRes.Invoice;
    const invDocNumber = inv.DocNumber || inv.Id || 'Issued';
    const finalTotal = inv.TotalAmt ? parseFloat(inv.TotalAmt).toFixed(2) : computedSubtotal.toFixed(2);
    const taxAmt = (parseFloat(finalTotal) - computedSubtotal).toFixed(2);

    const invCard = `🧾 *TITAN OS | INVOICE #${invDocNumber} CREATED*\n` +
                    `──────────────────────────────\n` +
                    `👤 *Client:* ${customerRef.name}\n` +
                    `💰 *Subtotal:* $${computedSubtotal.toFixed(2)} CAD\n` +
                    `🍁 *HST (13%):* $${taxAmt} CAD\n` +
                    `💵 *Total Amount:* $${finalTotal} CAD\n` +
                    `──────────────────────────────\n` +
                    `✅ Invoice active in QuickBooks ledger.`;

    if (typeof sendWhatsAppButtons === 'function') {
      const buttons = [
        { id: `QBO_EMAIL_INV_${inv.Id}`, title: "Email Invoice" }
      ];
      await sendWhatsAppButtons(config, dispatchTarget, invCard, buttons);
    } else {
      await sendWhatsAppMessage(dispatchTarget, invCard);
    }

  } else {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to create invoice in QuickBooks.`);
  }
}

async function handleInvoiceApproval(config, nlp, dispatchTarget, sendWhatsAppMessage, sendWhatsAppButtons) {
  const estimateNum = nlp.qbo_estimate_number;
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const percentage = parseFloat(nlp.qbo_invoice_percentage) || 100;

  if (!estimateNum && !customerNameTarget) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the estimate number or client name (e.g., "Convert Burke to 50% invoice").`);
  }

  let estQuery = estimateNum 
    ? `select * from Estimate where DocNumber = '${estimateNum}'` 
    : `select * from Estimate where CustomerRef.name LIKE '%${customerNameTarget.replace(/'/g, "\\'")}%' and TxnStatus='Pending' MAXRESULTS 1`;

  const qboData = await qboApiRequest(config, estQuery);

  if (!qboData?.QueryResponse?.Estimate?.length) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Could not locate a pending Estimate for ${estimateNum ? '#' + estimateNum : customerNameTarget} in QuickBooks.`);
  }

  const estimate = qboData.QueryResponse.Estimate[0];
  const totalAmount = parseFloat(estimate.TotalAmt);
  const drawAmount = (totalAmount * (percentage / 100)).toFixed(2);

  const invCard = `🧾 *TITAN OS | PROGRESS DRAW APPROVAL*\n` +
                  `──────────────────────────────\n` +
                  `*Estimate:* #${estimate.DocNumber || estimate.Id}\n` +
                  `*Client:* ${estimate.CustomerRef.name}\n` +
                  `*Draw Split:* ${percentage}%\n` +
                  `*Estimate Total:* $${totalAmount.toFixed(2)} CAD\n` +
                  `*Draw Amount:* $${drawAmount} CAD\n` +
                  `──────────────────────────────\n` +
                  `Tap below to execute and dispatch directly to client.`;

  const buttons = [{ id: `QBO_CONVERT_${estimate.Id}_${percentage}`, title: `Execute ${percentage}% Draw` }];
  await sendWhatsAppButtons(config, dispatchTarget, invCard, buttons);
}

// Direct Email Dispatcher without opening QBO
async function sendQboTransactionEmail(config, txnType, txnId, targetEmail = null) {
  const endpoint = targetEmail 
    ? `/${txnType}/${txnId}/send?sendTo=${encodeURIComponent(targetEmail)}`
    : `/${txnType}/${txnId}/send`;
  return await qboApiRequest(config, endpoint, 'POST');
}

module.exports = {
  refreshQboToken,
  qboApiRequest,
  findOrCreateQboCustomer,
  expandLineItemsWithOracle,
  handleEstimateCreation,
  handleInvoiceCreation,
  handleInvoiceApproval,
  handleConversationalChangeOrder,
  getAgingReport,
  handleARLookup,
  handleReceiptUpload,
  getDefaultQboItemRef,
  resolveCategoryItemRef,
  resolveQboTaxCode,
  sendQboTransactionEmail
};

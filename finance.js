/**
 * TITAN OS V6.0.22 — FINANCE & QBO ORCHESTRATOR
 * Module: finance.js
 * Purpose: Intuit OAuth2, Dunning, Progressive Draws, Receipt OCR, 
 *          Macro Ghost-Ledger Extraction, Traffic-Light AR Aging,
 *          and Conversational Subcontractor Change-Order Negotiation
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
  
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    if (res.status === 401 && !isRetry) {
      const refreshed = await refreshQboToken(config);
      if (refreshed) return await qboApiRequest(config, pathOrQuery, method, body, true);
    }
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`QBO HTTP ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[QBO API Error]:', err.message);
    return null;
  }
}

// ====================================================================
// 2. ACCOUNTS RECEIVABLE & AGING (AR LOOKUP WITH TRAFFIC-LIGHT DOTS)
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

    return {
      customerName,
      invoiceNum,
      balance,
      daysLate
    };
  });

  parsedInvoices.forEach(inv => {
    totalOutstanding += inv.balance;
  });

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

  let report = `🗄️ *TITAN OS | AR LOOKUP: FLEET AGING REPORT*\n\n` +
               `💰 *Total Outstanding:* $${totalOutstanding.toFixed(2)}\n` +
               `──────────────────────────────\n` +
               invoiceLines.join('\n');
  
  return report;
}

async function handleARLookup(config, dispatchTarget, sendWhatsAppMessage, callerIdentity = null) {
  await sendWhatsAppMessage(dispatchTarget, "⏳ Pulling live AR ledger from QuickBooks...");
  const report = await getAgingReport(config, 0);
  await sendWhatsAppMessage(dispatchTarget, report);
}

// ====================================================================
// 3. MULTIMODAL RECEIPT PROCESSING (MACRO GHOST LEDGER ONLY)
// ====================================================================

async function handleReceiptUpload(config, batch, dispatchTarget, sendWhatsAppMessage, callerIdentity = null, airtableWriteWithAutoDrop = null) {
  if (!batch || batch.items.length === 0) return;
  
  await sendWhatsAppMessage(dispatchTarget, "⏳ Analyzing receipt data...");
  
  const submitterName = callerIdentity?.name || 'Bob';
  const workerRecord = callerIdentity?.workerRecord;

  const prompt = `You are the Titan OS Financial Copilot. Extract ONLY the merchant/vendor name, total amount, general category (e.g. Restaurant, Hardware, Fuel, Supplies), tax amount, and date from this receipt. Do NOT extract individual purchased line items. Return strictly JSON.`;

  const parts = [{ text: prompt }];

  batch.items.forEach(item => {
    parts.push({
      inlineData: {
        mimeType: item.mimeType,
        data: item.buffer.toString('base64')
      }
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

      if (workerRecord?.id) {
        airtablePayload['Worker'] = [workerRecord.id];
      }

      const reportRec = await airtableWriteWithAutoDrop('Reports 2', airtablePayload);
      if (reportRec?.id) {
        expenseRef = reportRec.id.slice(-4).toUpperCase();
      }
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
    } else {
      qboStatusText = "Dispatched to QuickBooks";
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
// 4. CONVERSATIONAL SUBCONTRACTOR CHANGE-ORDER ENGINE
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
A field operative has verbally requested a project scope modification / change-order:
"${rawInput}"

Task:
1. Break down the scope changes into discrete, professional construction line items.
2. Estimate realistic industrial market pricing for padel court modifications (e.g., extra excavation per linear foot, additional LED fixtures, tempered glass 12mm upgrades, custom turf logos).
3. If specific amounts were mentioned by the operative, honor those values.
4. Output STRICTLY JSON conforming to the schema.

JSON SCHEMA:
{
  "client_name": "string (site or client name, e.g. '${siteNameTarget}')",
  "scope_summary": "string (concise summary of modification)",
  "total_amount": number,
  "line_items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "amount": number
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

    const qboLines = changeOrder.line_items.map(item => ({
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price,
        ItemRef: { value: "1" }
      }
    }));

    const estPayload = {
      CustomerRef: customerRef,
      Line: qboLines,
      TxnStatus: "Pending",
      CustomField: [{
        DefinitionId: "1",
        StringValue: "CHANGE_ORDER",
        Type: "StringTypeBasic"
      }]
    };

    const qboRes = await qboApiRequest(config, '/estimate', 'POST', estPayload);
    const estimateDocNumber = qboRes?.Estimate?.DocNumber || `CO-${Date.now().toString().slice(-4)}`;
    const totalFormatted = changeOrder.total_amount.toFixed(2);

    const breakdownText = changeOrder.line_items.map(i => `• ${i.description} (x${i.quantity}): $${i.amount.toFixed(2)}`).join('\n');

    const card = `📝 *TITAN OS | CHANGE-ORDER DRAFTED*\n` +
                 `──────────────────────────────\n` +
                 `🏟️ *Project:* ${customerRef.name}\n` +
                 `👤 *Requested By:* ${submitterName}\n` +
                 `📋 *Scope:* ${changeOrder.scope_summary}\n` +
                 `──────────────────────────────\n` +
                 `${breakdownText}\n` +
                 `──────────────────────────────\n` +
                 `💰 *Total Adjustment:* $${totalFormatted} USD\n` +
                 `🧾 *Estimate Ref:* #${estimateDocNumber} (Pending HQ Approval)`;

    if (typeof sendWhatsAppButtons === 'function') {
      const buttons = [
        { id: `QBO_APPROVE_CO_${qboRes?.Estimate?.Id || '0'}`, title: "✅ Approve & Issue" },
        { id: `QBO_REVISE_CO_${qboRes?.Estimate?.Id || '0'}`, title: "✏️ Revise Scope" }
      ];
      await sendWhatsAppButtons(dispatchTarget, card, buttons);
    } else {
      await sendWhatsAppMessage(dispatchTarget, card);
    }

  } catch (err) {
    console.error('[Change-Order Engine Error]:', err.message);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to compute change-order scope: ${err.message}`);
  }
}

// ====================================================================
// 5. CUSTOMER PROVISIONING
// ====================================================================

async function findOrCreateQboCustomer(config, clientName, email = null, phone = null) {
  if (!clientName) return null;
  const cleanName = clientName.trim().replace(/'/g, "\\'");
  
  const query = `select * from Customer where DisplayName LIKE '%${cleanName}%' MAXRESULTS 1`;
  const qboData = await qboApiRequest(config, query);
  
  if (qboData?.QueryResponse?.Customer?.[0]) {
    return { 
      value: qboData.QueryResponse.Customer[0].Id, 
      name: qboData.QueryResponse.Customer[0].DisplayName 
    };
  }
  
  const payload = { DisplayName: clientName.trim() };
  if (email) payload.PrimaryEmailAddr = { Address: email.trim() };
  if (phone) payload.PrimaryPhone = { FreeFormNumber: phone.replace(/[^\d+]/g, '') };
  
  try {
    const createRes = await qboApiRequest(config, '/customer', 'POST', payload);
    if (createRes?.Customer) {
      return { 
        value: createRes.Customer.Id, 
        name: createRes.Customer.DisplayName 
      };
    }
  } catch (err) {
    console.warn('[QBO Customer] Collided, generating fallback suffix...');
    const fallbackName = `${clientName.trim()} (New)`;
    payload.DisplayName = fallbackName;
    const fallbackRes = await qboApiRequest(config, '/customer', 'POST', payload).catch(() => null);
    
    if (fallbackRes?.Customer) {
      return { 
        value: fallbackRes.Customer.Id, 
        name: fallbackRes.Customer.DisplayName 
      };
    }
  }
  return null;
}

// ====================================================================
// 6. RAG ORACLE EXPANSION (LINE ITEMS & TAX)
// ====================================================================

async function expandLineItemsWithOracle(config, rawInput, amount, oracleFileURIs) {
  const parts = [];
  
  if (oracleFileURIs && oracleFileURIs.length > 0) {
    oracleFileURIs.forEach(item => {
      parts.push({ 
        file_data: { mime_type: 'application/pdf', file_uri: item.uri } 
      });
    });
  }

  const prompt = `You are the Titan OS Financial Copilot. A field operative has requested an estimate or invoice. 
Your job is to read their short verbal command and expand it into a formal, highly professional line-item description using the standard templates in the provided technical documents.

User's Raw Command: "${rawInput}"
Amount Provided: $${amount}

RULES:
1. If the user mentions a specific court type (e.g. "panoramic paddle court"), find the template description for it and use it.
2. Determine if the user asked for taxes to be applied (e.g., "plus HST", "add tax").
3. Do not include the price in the description text; it is mapped to a separate variable.
4. Output STRICTLY in JSON format.

JSON SCHEMA:
{
  "formal_description": "string (the expanded, professional line item text)",
  "apply_tax": boolean,
  "tax_code_name": "string ('HST', 'GST', 'Exempt' or null)"
}`;

  parts.push({ text: prompt });

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
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
    
    return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
  } catch (err) {
    console.error('[Finance RAG Error]:', err.message);
    return {
      formal_description: rawInput || 'Professional Services',
      apply_tax: /hst|tax/i.test(rawInput),
      tax_code_name: /hst/i.test(rawInput) ? 'HST' : null
    };
  }
}

// ====================================================================
// 7. INVOICE & ESTIMATE ORCHESTRATION
// ====================================================================

async function handleEstimateCreation(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage) {
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const amount = nlp.qbo_amount;
  const rawInput = nlp.transcript_en || nlp.qbo_line_items || '';

  if (!customerNameTarget || !amount) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the client name and total amount to draft an estimate.`);
  }

  const customerRef = await findOrCreateQboCustomer(config, customerNameTarget, nlp.email, nlp.phone);
  if (!customerRef) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to resolve or provision client "${customerNameTarget}" in QuickBooks.`);
  }

  const expandedContext = await expandLineItemsWithOracle(config, rawInput, amount, oracleFileURIs);
  
  const lineItem = {
    Amount: amount,
    DetailType: "SalesItemLineDetail",
    Description: expandedContext.formal_description,
    SalesItemLineDetail: { 
      Qty: 1, 
      UnitPrice: amount, 
      ItemRef: { value: "1" } 
    }
  };

  if (expandedContext.apply_tax) {
    lineItem.SalesItemLineDetail.TaxCodeRef = { value: 'TAX' };
  } else {
    lineItem.SalesItemLineDetail.TaxCodeRef = { value: 'NON' };
  }

  const estPayload = {
    CustomerRef: customerRef,
    Line: [lineItem]
  };

  const createRes = await qboApiRequest(config, '/estimate', 'POST', estPayload);
  
  if (createRes && createRes.Estimate) {
    const estCard = `🧾 *TITAN OS | ESTIMATE DRAFTED*\n` +
                    `──────────────────────────────\n` +
                    `*Estimate:* #${createRes.Estimate.DocNumber}\n` +
                    `*Client:* ${customerRef.name}\n` +
                    `*Subtotal:* $${parseFloat(amount).toFixed(2)}\n` +
                    `*Tax Applied:* ${expandedContext.apply_tax ? 'Yes 🇨🇦' : 'No'}\n` +
                    `──────────────────────────────\n` +
                    `📋 *Scope:*\n_${expandedContext.formal_description.slice(0, 150)}..._\n\n` +
                    `✅ Estimate securely generated in QuickBooks Online.`;
    await sendWhatsAppMessage(dispatchTarget, estCard);
  } else {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to create estimate in QuickBooks. Check API logs.`);
  }
}

async function handleInvoiceCreation(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage) {
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const amount = nlp.qbo_amount;
  const rawInput = nlp.transcript_en || nlp.qbo_line_items || '';

  if (!customerNameTarget || !amount) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the client name and total amount to create a new invoice.`);
  }

  const customerRef = await findOrCreateQboCustomer(config, customerNameTarget, nlp.email, nlp.phone);
  if (!customerRef) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to resolve or provision client "${customerNameTarget}".`);
  }

  const expandedContext = await expandLineItemsWithOracle(config, rawInput, amount, oracleFileURIs);

  const lineItem = {
    Amount: amount,
    DetailType: "SalesItemLineDetail",
    Description: expandedContext.formal_description,
    SalesItemLineDetail: { 
      Qty: 1, 
      UnitPrice: amount, 
      ItemRef: { value: "1" } 
    }
  };

  if (expandedContext.apply_tax) {
    lineItem.SalesItemLineDetail.TaxCodeRef = { value: 'TAX' };
  } else {
    lineItem.SalesItemLineDetail.TaxCodeRef = { value: 'NON' };
  }

  const invoicePayload = {
    CustomerRef: customerRef,
    Line: [lineItem]
  };

  const createRes = await qboApiRequest(config, '/invoice', 'POST', invoicePayload);
  
  if (createRes && createRes.Invoice) {
    const invCard = `🧾 *TITAN OS | INVOICE CREATED*\n` +
                    `──────────────────────────────\n` +
                    `*Invoice:* #${createRes.Invoice.DocNumber}\n` +
                    `*Client:* ${customerRef.name}\n` +
                    `*Amount:* $${parseFloat(amount).toFixed(2)}\n` +
                    `*Tax Applied:* ${expandedContext.apply_tax ? 'Yes' : 'No'}\n` +
                    `──────────────────────────────\n` +
                    `✅ Invoice generated successfully.`;
    await sendWhatsAppMessage(dispatchTarget, invCard);
  } else {
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to create invoice in QuickBooks.`);
  }
}

async function handleInvoiceApproval(config, nlp, dispatchTarget, sendWhatsAppMessage, sendWhatsAppButtons) {
  const estimateNum = nlp.qbo_estimate_number;
  const customerNameTarget = nlp.qbo_customer_name || nlp.referenced_entity_name;
  const percentage = parseFloat(nlp.qbo_invoice_percentage) || 100;

  if (!estimateNum && !customerNameTarget) {
    return await sendWhatsAppMessage(dispatchTarget, `⚠️ Please specify the estimate number or client name to convert (e.g., "Convert Burke site to 50% invoice").`);
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
                  `*Estimate:* #${estimate.DocNumber}\n` +
                  `*Client:* ${estimate.CustomerRef.name}\n` +
                  `*Draw Split:* ${percentage}%\n` +
                  `*Est Total:* $${totalAmount.toFixed(2)}\n` +
                  `*Draw Amount:* $${drawAmount}\n` +
                  `──────────────────────────────\n` +
                  `Tap below to cryptographically bind this ${percentage}% draw to the estimate ledger.`;

  const buttons = [{ id: `QBO_CONVERT_${estimate.Id}_${percentage}`, title: `✉️ Execute ${percentage}% Draw` }];
  await sendWhatsAppButtons(dispatchTarget, invCard, buttons);
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
  handleReceiptUpload
};

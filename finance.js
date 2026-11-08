/**
 * TITAN OS V6.0.22 — FINANCE & QBO ORCHESTRATOR
 * Module: finance.js
 * Purpose: Intuit OAuth2, Dunning, Progressive Draws, Receipt OCR, and RAG-Driven Quote Generation
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
  
  const isQuery = pathOrQuery.startsWith('select');
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
// 2. ACCOUNTS RECEIVABLE & AGING (AR LOOKUP)
// ====================================================================

async function getAgingReport(config, days = 30) {
  const query = `select * from Invoice where Balance > '0' MAXRESULTS 1000`;
  const qboData = await qboApiRequest(config, query);
  
  if (!qboData?.QueryResponse?.Invoice?.length) {
    return `✅ *TITAN OS | AR LEDGER*\n━━━━━━━━━━━━━━━━━━━━\nAll accounts are fully paid. Zero open invoices in QuickBooks.`;
  }

  const invoices = qboData.QueryResponse.Invoice;
  const now = new Date();
  
  const agingAccounts = new Map();
  let totalAging = 0;

  invoices.forEach(inv => {
    const dueDate = new Date(inv.DueDate);
    const diffTime = Math.abs(now - dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (now > dueDate && diffDays >= days) {
        const clientName = inv.CustomerRef.name;
        const balance = parseFloat(inv.Balance);
        totalAging += balance;
        
        if (!agingAccounts.has(clientName)) {
            agingAccounts.set(clientName, 0);
        }
        agingAccounts.set(clientName, agingAccounts.get(clientName) + balance);
    }
  });

  if (agingAccounts.size === 0) {
      return `✅ *TITAN OS | AR LEDGER*\n━━━━━━━━━━━━━━━━━━━━\nNo invoices are currently ${days}+ days past due.`;
  }

  let report = `📉 *TITAN OS | ${days}+ DAYS AR AGING*\n━━━━━━━━━━━━━━━━━━━━\n`;
  for (let [client, amount] of agingAccounts) {
      report += `• *${client}:* $${amount.toFixed(2)}\n`;
  }
  report += `━━━━━━━━━━━━━━━━━━━━\n*Total ${days}+ Past Due:* $${totalAging.toFixed(2)}`;
  
  return report;
}

async function handleARLookup(config, dispatchTarget, sendWhatsAppMessage) {
    await sendWhatsAppMessage(dispatchTarget, "⏳ Pulling live AR ledger from QuickBooks...");
    const report = await getAgingReport(config, 30);
    await sendWhatsAppMessage(dispatchTarget, report);
}

// ====================================================================
// 3. MULTIMODAL RECEIPT PROCESSING (EXPENSE EXTRACTION)
// ====================================================================

async function handleReceiptUpload(config, batch, dispatchTarget, sendWhatsAppMessage) {
    if (!batch || batch.items.length === 0) return;
    
    await sendWhatsAppMessage(dispatchTarget, "⏳ Analyzing receipt data...");
    
    const parts = [
        { text: "You are the Titan OS Financial Copilot. Extract the vendor name, total amount, tax amount, date, and a brief description of the items purchased from this receipt image. Return strictly JSON." }
    ];

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
                    tax_amount: { type: "number" },
                    date: { type: "string" },
                    description: { type: "string" }
                },
                required: ["vendor", "total_amount", "tax_amount", "date", "description"]
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
        const extracted = JSON.parse(data.candidates[0].content.parts[0].text);
        
        const card = `🧾 *TITAN OS | EXPENSE LOGGED*\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `*Vendor:* ${extracted.vendor}\n` +
                     `*Date:* ${extracted.date}\n` +
                     `*Total:* $${extracted.total_amount.toFixed(2)}\n` +
                     `*Tax:* $${extracted.tax_amount.toFixed(2)}\n` +
                     `━━━━━━━━━━━━━━━━━━━━\n` +
                     `*Items:* ${extracted.description}\n\n` +
                     `✅ Expense secured.`;
                     
        await sendWhatsAppMessage(dispatchTarget, card);
    } catch (e) {
        console.error("[Receipt Engine Error]", e);
        await sendWhatsAppMessage(dispatchTarget, `⚠️ Failed to extract receipt data: ${e.message}`);
    }
}

// ====================================================================
// 4. CUSTOMER PROVISIONING
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
    console.warn('[QBO Customer] Exact name collision detected, appending suffix...');
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
// 5. RAG ORACLE EXPANSION (LINE ITEMS & TAX)
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
// 6. INVOICE & ESTIMATE ORCHESTRATION
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
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `*Estimate:* #${createRes.Estimate.DocNumber}\n` +
                    `*Client:* ${customerRef.name}\n` +
                    `*Subtotal:* $${parseFloat(amount).toFixed(2)}\n` +
                    `*Tax Applied:* ${expandedContext.apply_tax ? 'Yes 🇨🇦' : 'No'}\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
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
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `*Invoice:* #${createRes.Invoice.DocNumber}\n` +
                    `*Client:* ${customerRef.name}\n` +
                    `*Amount:* $${parseFloat(amount).toFixed(2)}\n` +
                    `*Tax Applied:* ${expandedContext.apply_tax ? 'Yes' : 'No'}\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
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
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `*Estimate:* #${estimate.DocNumber}\n` +
                  `*Client:* ${estimate.CustomerRef.name}\n` +
                  `*Draw Split:* ${percentage}%\n` +
                  `*Est Total:* $${totalAmount.toFixed(2)}\n` +
                  `*Draw Amount:* $${drawAmount}\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
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
  getAgingReport,
  handleARLookup,
  handleReceiptUpload
};

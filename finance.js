/**
 * TITAN OS V6.0.22 — FINANCE & QBO ORCHESTRATOR
 * Module: finance.js
 * Purpose: Intuit OAuth2, Dunning, Progressive Draws, and RAG-Driven Quote Generation
 */

const fetch = require('node-fetch'); // Remove if running Node 18+ with native fetch

// ====================================================================
// 1. QBO TRANSPORT & AUTHENTICATION
// ====================================================================

async function refreshQboToken(config) {
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
    
    if (!res.ok) throw new Error(`Token refresh rejected: ${res.status}`);
    const data = await res.json();
    
    if (data.access_token) {
      config.qbo.accessToken = data.access_token;
      if (data.refresh_token) {
        process.env.QBO_REFRESH_TOKEN = data.refresh_token;
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
// 2. CUSTOMER PROVISIONING
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
// 3. RAG ORACLE EXPANSION (LINE ITEMS & TAX)
// ====================================================================

async function expandLineItemsWithOracle(config, rawInput, amount, oracleFileURIs) {
  const parts = [];
  
  // Feed the active Oracle knowledge base into the context window
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
    // Fallback to literal transcription if RAG fails
    return {
      formal_description: rawInput || 'Professional Services',
      apply_tax: /hst|tax/i.test(rawInput),
      tax_code_name: /hst/i.test(rawInput) ? 'HST' : null
    };
  }
}

// ====================================================================
// 4. INVOICE & ESTIMATE ORCHESTRATION
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

  // Inject RAG template expansion
  const expandedContext = await expandLineItemsWithOracle(config, rawInput, amount, oracleFileURIs);
  
  const lineItem = {
    Amount: amount,
    DetailType: "SalesItemLineDetail",
    Description: expandedContext.formal_description,
    SalesItemLineDetail: { 
      Qty: 1, 
      UnitPrice: amount, 
      ItemRef: { value: "1" } // Defaults to standard "Services" ID in QBO
    }
  };

  if (expandedContext.apply_tax) {
     lineItem.SalesItemLineDetail.TaxCodeRef = { value: 'TAX' }; // Map to your specific QBO Tax Code ID
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

  // We serve an interactive button back to the chat so the executive can execute the draw.
  // The execution logic for this button stays in server.js routing, utilizing LinkedTxn.
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
  handleInvoiceApproval
};

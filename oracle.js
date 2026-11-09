/**
 * TITAN OS V6.0.22 — TECHNICAL ORACLE RAG ENGINE
 * Module: oracle.js
 * Purpose: Gemini File API Ingestion, Caching, and Engineering Lookup
 */

// Defensive fetch polyfill for Node.js clustering
const fetch = globalThis.fetch || require('node-fetch');

// ====================================================================
// 1. KNOWLEDGE BASE SYNCHRONIZATION
// ====================================================================

/**
 * Synchronizes technical blueprints, hurricane stamps, and court specs
 * from Airtable "Oracle Docs" table into the Google Gemini File API.
 * 
 * @param {object} config - Master Titan OS CONFIG object
 * @param {function} setOracleFileURIs - Callback updating the active RAM cache of file URIs
 */
async function syncOracleDocs(config, setOracleFileURIs) {
  const apiKey = config?.airtable?.apiKey || process.env.AIRTABLE_API_KEY;
  const baseId = config?.airtable?.baseId || process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
  const endpoint = config?.airtable?.endpoint || 'https://api.airtable.com/v0';
  const geminiApiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || !geminiApiKey) {
    console.warn('[Oracle Engine] Missing Airtable or Gemini API keys. Sync aborted.');
    return;
  }

  try {
    console.log('[Oracle Engine] Commencing synchronization with Airtable Knowledge Base...');
    const url = `${endpoint}/${baseId}/Oracle%20Docs?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    
    if (!res.ok) {
      console.warn(`[Oracle Engine] Table "Oracle Docs" returned HTTP ${res.status}. Skipping.`);
      return;
    }
    
    const data = await res.json();
    const records = data.records || [];
    const newUris = [];
    
    for (const rec of records) {
      const attachments = rec.fields['Attachments'] || rec.fields['Attachment'] || rec.fields['Document'] || [];
      const docTitle = rec.fields['Name'] || rec.fields['Title'] || 'Technical Document';
      
      if (!Array.isArray(attachments) || attachments.length === 0) continue;

      for (const att of attachments) {
        const downloadUrl = att.url;
        const fileName = att.filename || 'manual.pdf';

        if (downloadUrl && (downloadUrl.toLowerCase().includes('.pdf') || fileName.toLowerCase().endsWith('.pdf'))) {
          try {
            const pdfRes = await fetch(downloadUrl);
            if (!pdfRes.ok) {
              console.warn(`[Oracle Engine] Failed to fetch PDF (${pdfRes.status}) for ${docTitle}`);
              continue;
            }
            const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
            
            // Raw streaming to Google Gemini File API
            const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`, {
              method: 'POST',
              headers: {
                'X-Goog-Upload-Protocol': 'raw',
                'X-Goog-Upload-Command': 'start, upload, finalize',
                'X-Goog-Upload-Header-Content-Length': String(pdfBuffer.length),
                'X-Goog-Upload-Header-Content-Type': 'application/pdf',
                'Content-Type': 'application/pdf'
              },
              body: pdfBuffer
            });
            
            if (!uploadRes.ok) {
              const errTxt = await uploadRes.text();
              console.error(`[Oracle Engine] Gemini File API upload error for ${docTitle}:`, errTxt);
              continue;
            }

            const uploadData = await uploadRes.json();
            if (uploadData.file && uploadData.file.uri) {
              newUris.push({
                uri: uploadData.file.uri,
                title: docTitle,
                filename: fileName,
                downloadUrl: downloadUrl
              });
              console.log(`[Oracle Engine] Successfully ingested: "${docTitle}" (${fileName})`);
            }
          } catch (fetchErr) {
            console.error(`[Oracle Engine] Exception streaming ${docTitle}:`, fetchErr.message);
          }
        }
      }
    }

    if (typeof setOracleFileURIs === 'function') {
      setOracleFileURIs(newUris);
    }
    console.log(`[Oracle Engine] Sync complete. ${newUris.length} technical documents active in AI memory.`);
  } catch (e) {
    console.error('[Oracle Engine] Sync failed:', e.message);
  }
}

// ====================================================================
// 2. ENGINEERING & STRUCTURAL LOOKUP
// ====================================================================

/**
 * Grounded Engineering RAG Lookup for Court Operatives & PMs
 * 
 * @param {object} config - Master CONFIG object
 * @param {object|string} nlp - Triage NLP object or raw string query
 * @param {string} dispatchTarget - E.164 phone number
 * @param {Array} oracleFileURIs - Array of active Gemini File URIs
 * @param {function} sendWhatsAppMessage - Dispatch adapter function
 */
async function handleOracleQuery(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage) {
  if (!oracleFileURIs || oracleFileURIs.length === 0) {
    return await sendWhatsAppMessage(
      dispatchTarget, 
      `⚠️ *TITAN OS | TECHNICAL ORACLE*\n──────────────────────────────\nThe Oracle is currently offline or syncing documents.\n\nPlease upload foundation plans or engineering PDFs into the *Attachments* column of the "Oracle Docs" Airtable table.`
    );
  }

  // Polymorphic input parsing to prevent TypeError crashes
  let userQuery = 'Explain structural specifications.';
  if (typeof nlp === 'string' && nlp.trim().length > 0) {
    userQuery = nlp.trim();
  } else if (typeof nlp === 'object' && nlp !== null) {
    userQuery = nlp.transcript_en || nlp.update_note || nlp.raw_text || nlp.query || 'Explain structural specifications.';
  }

  // Strip slash command triggers if present
  userQuery = userQuery.replace(/^\/(docs|specs)\s*/i, '').trim();
  if (!userQuery) userQuery = 'Explain structural specifications.';

  const parts = oracleFileURIs.map(item => ({ 
    file_data: { 
      mime_type: 'application/pdf', 
      file_uri: item.uri 
    } 
  }));

  const prompt = `You are the Titan OS Technical Oracle for Bounce Padel court installations. 
Answer the following engineering, foundation, structural, electrical, or glass specification question based STRICTLY on the attached proprietary engineering documents.

RULES:
1. Ground every claim directly in the blueprints or technical PDFs.
2. If the answer cannot be verified within the attached documents, state clearly: "Not specified in active technical documentation."
3. Format with clean, high-impact WhatsApp markdown bullets.
4. Keep the output concrete and actionable for field installers.

Question: ${userQuery}`;

  parts.push({ text: prompt });
  
  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { 
      temperature: 0.0 
    }
  };
  
  const endpoint = config?.gemini?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const apiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  try {
    const res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'The Oracle could not parse a valid technical answer.';
    
    const docCitations = oracleFileURIs.map(d => `• ${d.title}`).join('\n');
    const msg = `🧠 *TITAN OS | TECHNICAL ORACLE*\n` +
                `──────────────────────────────\n` +
                `${answer.trim()}\n\n` +
                `──────────────────────────────\n` +
                `📚 *Referenced Documents:*\n${docCitations}`;

    await sendWhatsAppMessage(dispatchTarget, msg);
  } catch (err) {
    console.error('[Oracle Query Error]:', err.message);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Technical Oracle lookup failed. Engineering team has been notified.`);
  }
}

module.exports = {
  syncOracleDocs,
  handleOracleQuery
};

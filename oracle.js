/**
 * TITAN OS V6.0.22 — TECHNICAL ORACLE RAG ENGINE
 * Module: oracle.js
 * Purpose: Gemini File API Ingestion, Caching, and Engineering Lookup
 */

// Defensive inclusion for backwards compatibility, though native fetch is preferred in Node 18+
let fetch;
try {
  fetch = require('node-fetch');
} catch (err) {
  fetch = globalThis.fetch;
}

// ====================================================================
// 1. KNOWLEDGE BASE SYNCHRONIZATION
// ====================================================================

async function syncOracleDocs(config, setOracleFileURIs) {
  try {
    console.log('[Oracle Engine] Commencing synchronization with Airtable Knowledge Base...');
    const url = `${config.airtable.endpoint}/${config.airtable.baseId}/Oracle%20Docs?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${config.airtable.apiKey}` } });
    
    if (!res.ok) {
       console.warn(`[Oracle Engine] Table "Oracle Docs" returned HTTP ${res.status}. Skipping.`);
       return;
    }
    
    const data = await res.json();
    const records = data.records || [];
    let newUris = [];
    
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
               
               const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${config.gemini.apiKey}`, {
                  method: 'POST',
                  headers: {
                      'X-Goog-Upload-Protocol': 'raw',
                      'X-Goog-Upload-Command': 'start, upload, finalize',
                      'X-Goog-Upload-Header-Content-Length': pdfBuffer.length,
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

    setOracleFileURIs(newUris);
    console.log(`[Oracle Engine] Sync complete. ${newUris.length} technical documents active in AI memory.`);
  } catch (e) {
    console.error('[Oracle Engine] Sync failed:', e.message);
  }
}

// ====================================================================
// 2. ENGINEERING & STRUCTURAL LOOKUP
// ====================================================================

async function handleOracleQuery(config, nlp, dispatchTarget, oracleFileURIs, sendWhatsAppMessage) {
  if (!oracleFileURIs || oracleFileURIs.length === 0) {
     return await sendWhatsAppMessage(
       dispatchTarget, 
       `⚠️ *TITAN OS | TECHNICAL ORACLE*\n━━━━━━━━━━━━━━━━━━━━\nThe Oracle is currently empty or syncing.\n\nPlease upload foundation plans or technical PDFs into the *Attachments* column of the "Oracle Docs" Airtable table.`
     );
  }
  
  const parts = oracleFileURIs.map(item => ({ 
    file_data: { 
      mime_type: 'application/pdf', 
      file_uri: item.uri 
    } 
  }));

  const userQuery = nlp.transcript_en || nlp.update_note || 'Explain structural specifications.';
  
  parts.push({ 
    text: `You are the Titan OS Technical Oracle for Bounce Padel court installations. 
Answer the following engineering, foundation, or structural question based STRICTLY on the attached proprietary PDF documents. 
If the answer cannot be verified within the documents, state that clearly without guessing.
Use clean, concise, field-friendly WhatsApp markdown formatting with bullet points.

Question: ${userQuery}` 
  });
  
  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.0 }
  };
  
  try {
     const res = await fetch(`${config.gemini.endpoint}?key=${config.gemini.apiKey}`, {
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
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 `${answer.trim()}\n\n` +
                 `━━━━━━━━━━━━━━━━━━━━\n` +
                 `📚 *Referenced Blueprints:*\n${docCitations}`;

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

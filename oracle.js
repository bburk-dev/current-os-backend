/**
 * TITAN OS V6.0.22 — TECHNICAL ORACLE RAG ENGINE
 * Module: oracle.js
 * Purpose: Gemini File API Ingestion, Caching, Clickable Blueprint Delivery,
 *          Defensive 48-Hour TTL Auto-Resync, and Engineering Forensics
 */

const fetch = globalThis.fetch || require('node-fetch');

// Module-level RAM Cache
let activeOracleURIs = [];
let lastSyncTimestamp = 0;
const RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24-hour proactive rotation

// ====================================================================
// 1. KNOWLEDGE BASE SYNCHRONIZATION (AIRTABLE -> GEMINI FILE API)
// ====================================================================

/**
 * Synchronizes technical blueprints, hurricane stamps, and court specs
 * from Airtable "Oracle Docs" table into the Google Gemini File API.
 * 
 * @param {object} config - Master Titan OS CONFIG object
 * @param {function} [setOracleFileURIs] - Optional external state callback
 * @returns {Promise<Array>} - Active array of ingested Oracle file descriptors
 */
async function syncOracleDocs(config, setOracleFileURIs = null) {
  const apiKey = config?.airtable?.apiKey || process.env.AIRTABLE_API_KEY;
  const baseId = config?.airtable?.baseId || process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
  const endpoint = config?.airtable?.endpoint || 'https://api.airtable.com/v0';
  const geminiApiKey = config?.gemini?.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || !geminiApiKey) {
    console.warn('[Oracle Engine] Missing Airtable or Gemini API keys. Sync aborted.');
    return activeOracleURIs;
  }

  try {
    console.log('[Oracle Engine] Commencing synchronization with Airtable Knowledge Base...');
    const url = `${endpoint}/${baseId}/Oracle%20Docs?maxRecords=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    
    if (!res.ok) {
      console.warn(`[Oracle Engine] Table "Oracle Docs" returned HTTP ${res.status}. Skipping.`);
      return activeOracleURIs;
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
          // Exponential backoff retry loop for external file ingestion
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const pdfRes = await fetch(downloadUrl);
              if (!pdfRes.ok) {
                console.warn(`[Oracle Engine] Failed to fetch PDF (${pdfRes.status}) for ${docTitle}`);
                break;
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
                if (attempt === 3) console.error(`[Oracle Engine] Gemini File API upload error for ${docTitle}:`, errTxt);
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
                break; // Success, break the retry loop
              }
            } catch (fetchErr) {
              if (attempt === 3) console.error(`[Oracle Engine] Exception streaming ${docTitle}:`, fetchErr.message);
              await new Promise(r => setTimeout(r, 1000 * attempt));
            }
          }
        }
      }
    }

    activeOracleURIs = newUris;
    lastSyncTimestamp = Date.now();

    if (typeof setOracleFileURIs === 'function') {
      setOracleFileURIs(newUris);
    }

    console.log(`[Oracle Engine] Sync complete. ${activeOracleURIs.length} technical documents active in AI memory.`);
    return activeOracleURIs;
  } catch (e) {
    console.error('[Oracle Engine] Sync failed:', e.message);
    return activeOracleURIs;
  }
}

/**
 * Accessor for the active in-memory Oracle file URIs
 */
function getOracleFileURIs() {
  return activeOracleURIs;
}

// ====================================================================
// 2. ENGINEERING & BLUEPRINT LOOKUP (ZERO-UI HEADLESS COPILOT)
// ====================================================================

/**
 * Grounded Engineering RAG Lookup for Field Technicians & PMs
 * Supports direct PDF link dispatching, generative answers, and auto-resync on TTL expiry.
 * 
 * @param {object} config - Master CONFIG object
 * @param {object|string} nlp - Triage NLP object or raw string query
 * @param {string} dispatchTarget - E.164 phone number
 * @param {Array} [oracleFileURIs] - Optional array of active Gemini File URIs (defaults to internal cache)
 * @param {function} sendWhatsAppMessage - Outbound WhatsApp dispatcher
 * @param {boolean} [isRetry=false] - Retry guard for 48h TTL expiration
 */
async function handleOracleQuery(config, nlp, dispatchTarget, oracleFileURIs = null, sendWhatsAppMessage, isRetry = false) {
  let fileList = (oracleFileURIs && oracleFileURIs.length > 0) ? oracleFileURIs : activeOracleURIs;

  // NEW: Autonomous Defensive Catch - If memory is empty, force a synchronous refresh before answering.
  if (!fileList || fileList.length === 0) {
    console.log('[Oracle Engine] Memory empty on inbound query. Triggering emergency knowledge sync...');
    await sendWhatsAppMessage(dispatchTarget, "⏳ Initializing Technical Oracle blueprints. One moment...");
    fileList = await syncOracleDocs(config);
  }

  if (!fileList || fileList.length === 0) {
    return await sendWhatsAppMessage(
      dispatchTarget, 
      `⚠️ *TITAN OS | TECHNICAL ORACLE*\n──────────────────────────────\nThe Oracle is currently offline or synchronizing.\n\nPlease upload engineering PDFs into the *Attachments* column of the "Oracle Docs" Airtable table.`
    );
  }

  let userQuery = 'Explain structural specifications.';
  if (typeof nlp === 'string' && nlp.trim().length > 0) {
    userQuery = nlp.trim();
  } else if (typeof nlp === 'object' && nlp !== null) {
    userQuery = nlp.transcript_en || nlp.update_note || nlp.raw_text || nlp.query || 'Explain structural specifications.';
  }

  userQuery = userQuery.replace(/^\/(docs|specs|plan|plans)\s*/i, '').trim();
  if (!userQuery) userQuery = 'Explain structural specifications.';

  const lQuery = userQuery.toLowerCase();

  const isDirectDocRequest = /send|get|download|pdf|blueprint|drawing|plan|brochure|specs/i.test(lQuery) &&
                             !/how|why|what|calculate|torque|psi|concrete|cure/i.test(lQuery);

  if (isDirectDocRequest) {
    const matchedDoc = fileList.find(d => 
      lQuery.includes(d.title.toLowerCase()) || 
      d.title.toLowerCase().includes(lQuery) ||
      (d.filename && lQuery.includes(d.filename.toLowerCase()))
    );

    if (matchedDoc && matchedDoc.downloadUrl) {
      const docCard = `📐 *TITAN OS | TECHNICAL BLUEPRINT*\n` +
                      `──────────────────────────────\n` +
                      `📄 *Document:* ${matchedDoc.title}\n` +
                      `📎 *File:* \`${matchedDoc.filename}\`\n` +
                      `──────────────────────────────\n` +
                      `🔗 *Click to Download Official PDF:*\n` +
                      `${matchedDoc.downloadUrl}\n\n` +
                      `_Access authorized via Bounce Padel Engineering._`;
      return await sendWhatsAppMessage(dispatchTarget, docCard);
    }
  }

  const parts = fileList.map(item => ({ 
    file_data: { 
      mime_type: 'application/pdf', 
      file_uri: item.uri 
    } 
  }));

  const prompt = `You are the Lead Structural Engineer and Master Oracle for Bounce Padel courts worldwide.
Answer the following field question based STRICTLY and EXCLUSIVELY on the attached proprietary engineering documents.

RULES:
1. Ground every single claim directly in the blueprints, foundation drawings, or technical specifications.
2. If specific values exist (e.g., anchor bolt torque specs, 12mm glass tolerances, footing dimensions, polyurethane glue cure temps, wind ratings), state them with exact numerical precision.
3. If the answer cannot be verified within the attached documents, state clearly: "Not specified in active technical documentation." Do not guess.
4. Format with clean, high-impact WhatsApp markdown bullets.
5. Keep the tone authoritative, direct, and actionable for trade installers on an active construction site.

Question: "${userQuery}"`;

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
      const errTxt = await res.text();

      // Autonomous 48-Hour TTL Self-Healing Guard
      const isExpiredFile = res.status === 400 && (errTxt.includes('File') || errTxt.includes('expired') || errTxt.includes('not found'));
      if (isExpiredFile && !isRetry) {
        console.warn('[Oracle Engine] ⚠️ Detected expired Gemini File API URIs (48h TTL limit). Resyncing automatically...');
        const refreshedList = await syncOracleDocs(config);
        return await handleOracleQuery(config, nlp, dispatchTarget, refreshedList, sendWhatsAppMessage, true);
      }

      throw new Error(`Gemini API HTTP ${res.status}: ${errTxt}`);
    }

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'The Oracle could not parse a valid technical answer.';

    const docCitations = fileList.map(d => {
      const linkStr = d.downloadUrl ? `\n  👉 Download: ${d.downloadUrl}` : '';
      return `• *${d.title}* (${d.filename})${linkStr}`;
    }).join('\n\n');

    const msg = `🧠 *TITAN OS | TECHNICAL ORACLE*\n` +
                `──────────────────────────────\n` +
                `${answer.trim()}\n\n` +
                `──────────────────────────────\n` +
                `📚 *Referenced Blueprints & Downloads:*\n` +
                `${docCitations}`;

    await sendWhatsAppMessage(dispatchTarget, msg);
  } catch (err) {
    console.error('[Oracle Query Error]:', err.message);
    await sendWhatsAppMessage(dispatchTarget, `⚠️ Technical Oracle lookup failed. Engineering team has been notified.`);
  }
}

module.exports = {
  syncOracleDocs,
  getOracleFileURIs,
  handleOracleQuery
};

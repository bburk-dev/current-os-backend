const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables Configuration
const {
  META_APP_SECRET,
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WEBHOOK_VERIFY_TOKEN,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-3.5-flash',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET = 'inbound-media',
  AUTO_REPLY = 'true'
} = process.env;

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 1. Capture Raw Body Buffer for Exact SHA-256 HMAC Validation
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// 2. Security Middleware: Meta HMAC-SHA256 Signature Verification
const verifyWhatsAppSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.warn('Security Alert: Incoming POST request missing x-hub-signature-256 header.');
    return res.status(401).json({
      status: 'UNAUTHORIZED',
      message: 'Access Denied: x-hub-signature-256 header missing.'
    });
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', META_APP_SECRET || '')
    .update(req.rawBody || '')
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.error('Security Alert: HMAC SHA-256 signature verification failed.');
    return res.status(401).json({
      status: 'UNAUTHORIZED',
      message: 'Access Denied: Payload HMAC verification failed.'
    });
  }

  next();
};

// 3. Worker Bouncer Authorization Lookup
async function lookupWorker(senderPhone) {
  try {
    // Normalize phone into clean E.164 string format (e.g., +14379287172)
    let cleanPhone = senderPhone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    const formula = `AND(OR({Phone E164} = '${cleanPhone}', {WhatsApp Number} = '${cleanPhone}'), {Active} = TRUE())`;
    
    const response = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Worker`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        params: { filterByFormula: formula }
      }
    );

    const record = response.data?.records?.[0];
    if (record) {
      return {
        authorized: true,
        recordId: record.id,
        fullName: record.fields['Full Name'] || 'Field Operator',
        role: record.fields['Role'] || 'Worker',
        defaultProject: record.fields['Default Project'] || ''
      };
    }
  } catch (err) {
    console.error('Worker Bouncer Lookup Error:', err.response?.data || err.message);
  }

  return { authorized: false };
}

// 4. Meta Webhook Verification Endpoint (GET /webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verification handshake successful.');
    return res.status(200).send(challenge);
  }
  
  console.warn('Webhook verification handshake failed. Invalid token.');
  return res.status(403).send('Forbidden');
});// 5. Site Location Resolver Lookup
async function lookupSiteByGroupId(groupId) {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sites`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        params: { filterByFormula: `{WhatsApp Group ID} = '${groupId}'` }
      }
    );

    const matchedSite = response.data?.records?.[0];
    if (matchedSite) {
      return {
        siteRecordId: matchedSite.id,
        siteName: matchedSite.fields['Site Name'] || 'Unknown Site',
        workflowMode: matchedSite.fields['Workflow Mode'] || 'INSTALLATION',
        siteStatus: matchedSite.fields['Site Status'] || 'ACTIVE'
      };
    }
  } catch (err) {
    console.warn('Site lookup failed or group unlinked:', err.message);
  }

  return null;
}

// 6. Automated /link Slash Command Engine
async function handleLinkCommand(chatId, siteNameQuery) {
  try {
    const cleanSiteName = siteNameQuery.trim();
    
    // Search Sites table for matching Site Name
    const lookupResponse = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sites`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        params: { filterByFormula: `LOWER({Site Name}) = LOWER('${cleanSiteName}')` }
      }
    );

    const siteRecord = lookupResponse.data?.records?.[0];

    if (!siteRecord) {
      await sendWhatsAppTextMessage(
        chatId,
        `⚠️ *Titan OS Link Failed*\n\nCould not find a site named "${cleanSiteName}" in Airtable. Please verify the exact Site Name and try again.`
      );
      return;
    }

    // Patch WhatsApp Group ID on matching site record
    await axios.patch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sites`,
      {
        records: [
          {
            id: siteRecord.id,
            fields: { 'WhatsApp Group ID': chatId }
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const linkedName = siteRecord.fields['Site Name'];
    await sendWhatsAppTextMessage(
      chatId,
      `✅ *Titan OS Site Linked*\n\nThis WhatsApp Group has been successfully bound to site:\n📍 *${linkedName}*\n\nAll field updates submitted here will now automatically track under this site record.`
    );
  } catch (err) {
    console.error('/link Command Processing Error:', err.response?.data || err.message);
  }
}

// 7. Supabase Media Archiver Engine (Storage HTTP Header & Sanitization Fix Applied)
async function downloadAndArchiveMedia(mediaId, mimeType, messageId) {
  try {
    // Step A: Fetch media URL from Meta Graph API
    const metaResponse = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
    });

    const downloadUrl = metaResponse.data?.url;
    if (!downloadUrl) throw new Error('Failed to retrieve media URL from Meta.');

    // Step B: Download binary buffer
    const mediaBuffer = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      responseType: 'arraybuffer'
    });

    // Step C: Determine file extension and storage path
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    // Sanitize message ID to prevent encoding breaks in storage paths
    const sanitizedMsgId = messageId.replace(/[^a-zA-Z0-9_-]/g, '');
    const storagePath = `${year}/${month}/${sanitizedMsgId}.${ext}`;

    // Step D: Upload binary buffer directly to Supabase REST endpoint
    const cleanServiceKey = (SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const baseUrl = (SUPABASE_URL || '').replace(/\/$/, '');
    const uploadUrl = `${baseUrl}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`;
    
    await axios.post(uploadUrl, Buffer.from(mediaBuffer.data), {
      headers: {
        'Authorization': `Bearer ${cleanServiceKey}`,
        'apikey': cleanServiceKey,
        'Content-Type': mimeType,
        'x-upsert': 'true'
      }
    });

    return {
      storagePath,
      publicUrl: `${baseUrl}/storage/v1/object/public/${SUPABASE_BUCKET}/${storagePath}`,
      buffer: Buffer.from(mediaBuffer.data),
      mimeType
    };
  } catch (err) {
    console.error('Supabase Storage Stream Error:', err.response?.data || err.message);
    return null;
  }
}// 8. Google Gemini 3.5 Multimodal Evaluation Engine
async function evaluateSubmissionWithGemini(workerInfo, siteInfo, captionText, mediaData) {
  try {
    const prompt = `
You are Titan OS V4.3, an autonomous industrial field operations auditor for padel court construction, maintenance, and quality inspection.

WORKER CONTEXT:
- Full Name: ${workerInfo.fullName}
- Role: ${workerInfo.role}

SITE CONTEXT:
- Site Name: ${siteInfo ? siteInfo.siteName : 'Unlinked Location'}
- Preferred Workflow Mode: ${siteInfo ? siteInfo.workflowMode : 'INSTALLATION'}

ANALYSIS INSTRUCTIONS:
1. Classify the update into one of 3 workflow modes:
   - "INSTALLATION": Construction of new courts (Foundations, Steel, Mesh, Glass, Turf, Sand, Net).
   - "MAINTENANCE": Repairing or fixing existing court defects (silicone leaks, broken glass, frame rust, mesh tears).
   - "SPOT_VISIT": Routine quality inspection or preventative maintenance check.

2. Identify any mentioned or visible installation milestone gates from this standard list:
   ["1. Steel Structure", "2. Lower mesh", "3. Upper mesh", "5. Glass", "6. Turf and sand", "7. Silicone", "8. Net posts and net"]

3. Determine the Verification Basis:
   - "VISUAL_PROOF": Photo or video media attached confirming physical completion.
   - "WORKER_CLAIM": Text or voice claim without media evidence.

4. Evaluate Overall Status:
   - "CLEARED": Milestone completed or quality check passed cleanly.
   - "NEEDS_ATTENTION": Issue flagged requiring review or sub-component repair.
   - "BLOCKED": Critical blocker preventing progress.

Return ONLY a valid JSON object matching this schema:
{
  "workflow_mode": "INSTALLATION" | "MAINTENANCE" | "SPOT_VISIT",
  "mentioned_gates": ["gate_string"],
  "verification_basis": "VISUAL_PROOF" | "WORKER_CLAIM",
  "overall_status": "CLEARED" | "NEEDS_ATTENTION" | "BLOCKED",
  "worker_summary": "Concise executive summary of progress or issue",
  "status_observed": "Detailed physical observations from media or caption",
  "action_intent": "Next required action or resolution step"
}
`;

    const contents = [{ text: prompt }];

    if (captionText) {
      contents.push({ text: `FIELD CAPTION SUBMISSION: "${captionText}"` });
    }

    if (mediaData && mediaData.buffer) {
      contents.push({
        inlineData: {
          mimeType: mediaData.mimeType,
          data: mediaData.buffer.toString('base64')
        }
      });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents,
      config: {
        temperature: 0.0,
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text);
  } catch (err) {
    console.error('Gemini AI Evaluation Error:', err.message);
    return {
      workflow_mode: siteInfo ? siteInfo.workflowMode : 'INSTALLATION',
      mentioned_gates: [],
      verification_basis: mediaData ? 'VISUAL_PROOF' : 'WORKER_CLAIM',
      overall_status: 'NEEDS_ATTENTION',
      worker_summary: captionText || 'Field submission ingested.',
      status_observed: 'AI evaluation fallback triggered.',
      action_intent: 'Manual supervisor review required.'
    };
  }
}

// 9. Outbound WhatsApp Message Helper
async function sendWhatsAppTextMessage(to, messageText) {
  if (AUTO_REPLY !== 'true') return;

  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: messageText }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Outbound WhatsApp Message Error:', err.response?.data || err.message);
  }
}

// 10. Core Inbound Webhook Execution Engine (POST /webhook)
app.post('/webhook', verifyWhatsAppSignature, async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message) {
      return res.status(200).json({ status: 'IGNORED', message: 'No message payload found.' });
    }

    const whatsappChatId = message.from;
    const captionText = message.text?.body || message.image?.caption || message.video?.caption || '';

    // Step A: Check for Slash Commands (/link)
    if (captionText.toLowerCase().startsWith('/link ')) {
      const siteNameQuery = captionText.slice(6);
      await handleLinkCommand(whatsappChatId, siteNameQuery);
      return res.status(200).json({ status: 'SUCCESS', message: '/link command executed.' });
    }

    // Step B: Security Bouncer Authorization
    const workerInfo = await lookupWorker(whatsappChatId);
    if (!workerInfo.authorized) {
      console.warn(`Bouncer Enforcement: Blocked unauthorized request from ${whatsappChatId}`);
      return res.status(200).json({
        status: 'BLOCKED',
        message: 'Sender not authorized in Worker table.'
      });
    }

    // Step C: Site Location Resolver
    const siteInfo = await lookupSiteByGroupId(whatsappChatId);

    // Step D: Supabase Private Media Archival
    let mediaData = null;
    const imageObj = message.image;
    const videoObj = message.video;
    const audioObj = message.audio;
    const activeMedia = imageObj || videoObj || audioObj;

    if (activeMedia) {
      const mimeType = activeMedia.mime_type || (imageObj ? 'image/jpeg' : videoObj ? 'video/mp4' : 'audio/ogg');
      mediaData = await downloadAndArchiveMedia(activeMedia.id, mimeType, message.id);
    }

    // Step E: Gemini Multimodal Evaluation
    const aiOutput = await evaluateSubmissionWithGemini(workerInfo, siteInfo, captionText, mediaData);

    // Step F: Persist Record to "Inbound Messages 2" (Corrected Airtable Field Name: 'Sender')
    const inboundFields = {
      'Message ID': message.id,
      'Sender': whatsappChatId,
      'Worker': [workerInfo.recordId],
      'Message Type': message.type || 'text',
      'Caption Text': captionText,
      'Raw Payload JSON': JSON.stringify(req.body)
    };

    if (mediaData?.storagePath) {
      inboundFields['Media Path'] = mediaData.storagePath;
    }

    const inboundRecordResponse = await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Inbound%20Messages%202`,
      { records: [{ fields: inboundFields }] },
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const inboundRecordId = inboundRecordResponse.data?.records?.[0]?.id;

    // Step G: Persist Intelligence Record to "Reports 2"
    const reportFields = {
      'Source Batch ID': whatsappChatId,
      'WhatsApp Reply Text': captionText,
      'Mentioned Gates': (aiOutput.mentioned_gates || []).join(', '),
      'Verification Basis': aiOutput.verification_basis,
      'Workflow Mode': aiOutput.workflow_mode,
      'Overall Status': aiOutput.overall_status,
      'Worker Summary': aiOutput.worker_summary,
      'Status Observed': aiOutput.status_observed,
      'Action Intent': aiOutput.action_intent,
      'Clean JSON': JSON.stringify(aiOutput)
    };

    if (inboundRecordId) {
      reportFields['Inbound Messages 2'] = [inboundRecordId];
    }

    if (siteInfo?.siteRecordId) {
      reportFields['Sites'] = [siteInfo.siteRecordId];
    }

    const reportResponse = await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Reports%202`,
      { records: [{ fields: reportFields }] },
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    // Step H: Dispatch Automated WhatsApp Reply
    const modeEmoji = aiOutput.workflow_mode === 'MAINTENANCE' ? '🛠️' : aiOutput.workflow_mode === 'SPOT_VISIT' ? '🔍' : '🏗️';
    const replyBody = `🤖 *Titan OS | ${modeEmoji} ${aiOutput.workflow_mode} Update*\n\n📍 *Site:* ${siteInfo ? siteInfo.siteName : 'Unlinked Location'}\n👷 *Worker:* ${workerInfo.fullName}\n⚡ *Status:* ${aiOutput.overall_status}\n\n📝 *Summary:*\n${aiOutput.worker_summary}`;
    
    await sendWhatsAppTextMessage(whatsappChatId, replyBody);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Titan OS V4.3 pipeline executed successfully.',
      report_id: reportResponse.data?.records?.[0]?.id
    });

  } catch (error) {
    console.error('Titan OS Pipeline Error:', error.response?.data || error.message);
    return res.status(500).json({
      status: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process Titan OS pipeline.'
    });
  }
});

// Start Server Listener
app.listen(PORT, () => {
  console.log(`Titan OS V4.3 Webhook Engine running on port ${PORT}`);
});

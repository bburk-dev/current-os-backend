const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const {
  META_APP_SECRET,
  WHATSAPP_ACCESS_TOKEN,
  WEBHOOK_VERIFY_TOKEN,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID
} = process.env;

// 1. Capture Raw Body Buffer for HMAC Verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// 2. Middleware: HMAC SHA-256 Signature Validation
const verifyWhatsAppSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
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
    return res.status(401).json({
      status: 'UNAUTHORIZED',
      message: 'Access Denied: Payload HMAC verification failed.'
    });
  }

  next();
};

// 3. Meta Verification Handshake (GET /webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
});// 4. Webhook Ingestion Engine (POST /webhook)
app.post('/webhook', verifyWhatsAppSignature, async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message) {
      return res.status(200).json({ status: 'IGNORED', message: 'No message object found.' });
    }

    const whatsappChatId = message.from;
    const rawTextBody = message.text?.body || '';
    const hasMedia = !!message.image || !!message.video;

    // A. Site Location Resolver Lookup
    let siteRecordId = null;
    let workflowMode = 'MAINTENANCE';
    let siteStatus = 'ACTIVE';

    try {
      const siteLookupResponse = await axios.get(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Sites`,
        {
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
          params: { filterByFormula: `{WhatsApp Group ID} = '${whatsappChatId}'` }
        }
      );

      const matchedSite = siteLookupResponse.data?.records?.[0];
      if (matchedSite) {
        siteRecordId = matchedSite.id;
        workflowMode = matchedSite.fields['Workflow Mode'] || 'MAINTENANCE';
        siteStatus = matchedSite.fields['Site Status'] || 'ACTIVE';
      }
    } catch (lookupErr) {
      console.warn('Site lookup failed or unlinked:', lookupErr.message);
    }

    // B. Milestone Gate Parser
    const gatePatterns = [
      { name: '1. Steel Structure', patterns: [/steel structure/i, /steel frame/i, /columns/i, /beams/i] },
      { name: '2. Lower mesh', patterns: [/lower mesh/i, /bottom mesh/i, /lower fence/i] },
      { name: '3. Upper mesh', patterns: [/upper mesh/i, /top mesh/i, /upper fence/i] },
      { name: '5. Glass', patterns: [/glass/i, /glass panels/i, /tempered glass/i] },
      { name: '6. Turf and sand', patterns: [/turf/i, /grass/i, /sand/i, /sand infill/i] },
      { name: '7. Silicone', patterns: [/silicone/i, /seals/i, /sealant/i] },
      { name: '8. Net posts and net', patterns: [/net/i, /net posts/i, /center net/i] }
    ];

    const matchedGates = gatePatterns
      .filter(gate => gate.patterns.some(regex => regex.test(rawTextBody)))
      .map(gate => gate.name);

    const mentionedGatesString = matchedGates.join(', ');

    // C. Verification Basis Logic
    const verificationBasis = hasMedia ? 'VISUAL_PROOF' : 'WORKER_CLAIM';// D. Build Reports 2 Payload
    const reportFields = {
      'Source Batch ID': whatsappChatId,
      'WhatsApp Reply Text': rawTextBody,
      'Mentioned Gates': mentionedGatesString,
      'Verification Basis': verificationBasis,
      'Workflow Mode': workflowMode,
      'Site Status': siteStatus
    };

    if (siteRecordId) {
      reportFields['Sites'] = [siteRecordId]; // Linked record ID array
    }

    // E. Persist Record to Reports 2
    const airtableResponse = await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Reports%202`,
      { records: [{ fields: reportFields }] },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Webhook processed, payload validated, and report recorded.',
      record_id: airtableResponse.data.records[0].id
    });

  } catch (error) {
    console.error('Webhook processing error:', error.response?.data || error.message);
    return res.status(500).json({
      status: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to persist report record to database.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Titan OS Webhook service running on port ${PORT}`);
});

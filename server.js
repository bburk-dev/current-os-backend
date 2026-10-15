const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

/**
 * Asynchronous Multimodal Evaluation Function
 */
async function evaluateMediaWithGemini(mediaBuffer, mimeType, captionText = '') {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('[Gemini Evaluation Error]: GEMINI_API_KEY missing');
      return null;
    }

    const prompt = `
You are Titan OS, an automated field operations AI for Padel court facilities.
Analyze the incoming worker media/audio/video/text (English, Spanish, Swahili, or Hindi).
If a video or audio file is attached, analyze its visual and audio content thoroughly.
Extract operational context and output ONLY valid JSON matching this schema:

{
  "detected_language": "en | es | sw | hi",
  "summary": "1-sentence executive summary of the submission",
  "compliance_status": "PASSED | FAILED | NEEDS_REVIEW",
  "court_id": "Court 1 | Court 2 | General | Unknown",
  "action_required": true,
  "issues_detected": ["List of hazards or issues if any"]
}

Worker Caption/Text: "${captionText}"
`;

    const contents = [];

    if (mediaBuffer && mimeType) {
      contents.push({
        inlineData: {
          data: mediaBuffer.toString('base64'),
          mimeType: mimeType
        }
      });
    }

    contents.push(prompt);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);
    console.log('[Gemini Evaluation Success]:', result);
    return result;

  } catch (err) {
    console.error('[Gemini Evaluation Error]:', err.message);
    return null;
  }
}

/**
 * Save Record to Airtable "Inbound Messages 2"
 */
async function saveToInboundMessages2(senderPhone, messageType, captionText, aiResult, rawPayload = {}, messageId = '') {
  try {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      console.error('[Airtable Error]: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
      return null;
    }

    // Exact fields for "Inbound Messages 2"
    const fields = {
      'Message ID': messageId || `msg_${Date.now()}`,
      'Caption Text': captionText || aiResult?.summary || '',
      'Language Detected': aiResult?.detected_language || 'en',
      'Raw Payload JSON': JSON.stringify(rawPayload),
      'Phone E164': senderPhone
    };

    const response = await axios.post(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Inbound%20Messages%202`,
      { fields: fields },
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[Inbound Messages 2 Saved]: Record ID', response.data.id);
    return response.data.id;
  } catch (err) {
    console.error('[Inbound Messages 2 Error]:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Save Record to Airtable "Reports 2"
 */
async function saveToReports2(inboundRecordId, aiResult) {
  try {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return;

    // Exact fields for "Reports 2"
    const fields = {
      'Inbound Messages 2': inboundRecordId ? [inboundRecordId] : [],
      'Worker Summary': aiResult?.summary || '',
      'Action Required': aiResult?.action_required || false,
      'Asset Identifier': aiResult?.court_id || 'General',
      'Issue Severity': aiResult?.compliance_status === 'FAILED' ? 'HIGH' : 'NONE'
    };

    const response = await axios.post(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Reports%202`,
      { fields: fields },
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[Reports 2 Saved]: Record ID', response.data.id);
  } catch (err) {
    console.error('[Reports 2 Error]:', err.response?.data || err.message);
  }
}

// 1. Meta Webhook Verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === process.env.WEBHOOK_VERHOOK_VERIFY_TOKEN) {
    console.log('[Webhook Verification]: Verified successfully!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Inbound WhatsApp Message Ingestion (POST)
app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  console.log('[Webhook Ingest]: Inbound request received from Meta');

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('[Webhook Ingest]: Non-message event received');
      return;
    }

    const senderPhone = message.from;
    const messageType = message.type;
    const messageId = message.id;

    console.log(`[Message Received]: From ${senderPhone} | Type: ${messageType}`);

    let captionText = message.text?.body || message.caption || '';
    let mediaBuffer = null;
    let mimeType = null;

    if (messageType === 'audio' || messageType === 'image' || messageType === 'video') {
      const mediaId = message[messageType]?.id;
      mimeType = message[messageType]?.mime_type || (messageType === 'video' ? 'video/mp4' : 'audio/ogg');

      const token = process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN;

      if (mediaId && token) {
        console.log(`[Downloading Media]: ID ${mediaId} (${mimeType})`);
        
        const mediaRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const binaryRes = await axios.get(mediaRes.data.url, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer'
        });

        mediaBuffer = Buffer.from(binaryRes.data);
        console.log(`[Media Downloaded Successfully]: Buffer size ${mediaBuffer.length} bytes`);
      }
    }

    // 1. Evaluate with Gemini 2.5 Flash
    const aiResult = await evaluateMediaWithGemini(mediaBuffer, mimeType, captionText);

    // 2. Save to "Inbound Messages 2"
    const inboundRecordId = await saveToInboundMessages2(senderPhone, messageType, captionText, aiResult, req.body, messageId);

    // 3. Save connected report in "Reports 2"
    if (inboundRecordId) {
      await saveToReports2(inboundRecordId, aiResult);
    }

  } catch (err) {
    console.error('[Webhook Processing Error]:', err.message);
  }
});

app.get('/', (req, res) => {
  res.status(200).send('Titan OS V4.3 Active');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=v21.0`);
});

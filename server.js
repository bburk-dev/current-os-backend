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

    // Attach inline video/audio/image binary buffer for Gemini 2.5 Flash
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
 * Helper Function: Save Record to Airtable "Inbound Messages 2"
 */
async function saveToAirtable(senderPhone, messageType, captionText, aiResult) {
  try {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      console.error('[Airtable Error]: Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment variables');
      return;
    }

    // Standardized Airtable field payload matching base column conventions
    const fields = {
      'Phone': senderPhone,
      'Type': messageType,
      'Text': captionText || '',
      'Language': aiResult?.detected_language || 'en',
      'Summary': aiResult?.summary || '',
      'Compliance Status': aiResult?.compliance_status || 'NEEDS_REVIEW',
      'Court': aiResult?.court_id || 'Unknown',
      'Action Required': aiResult?.action_required || false,
      'Issues': (aiResult?.issues_detected || []).join(', ')
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

    console.log('[Airtable Saved Successfully]: Record ID', response.data.id);
  } catch (err) {
    console.error('[Airtable Save Error]:', err.response?.data || err.message);
  }
}

// 1. Meta Webhook Verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === process.env.WEBHOOK_VERIFY_TOKEN) {
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
    console.log(`[Message Received]: From ${senderPhone} | Type: ${messageType}`);

    let captionText = message.text?.body || message.caption || '';
    let mediaBuffer = null;
    let mimeType = null;

    // Process media attachments (audio, video, image)
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
      } else {
        console.warn('[Media Download Skipped]: Missing WHATSAPP_TOKEN in environment variables');
      }
    }

    // 1. Send media buffer & prompt to Gemini 2.5 Flash
    const aiResult = await evaluateMediaWithGemini(mediaBuffer, mimeType, captionText);

    // 2. Save result directly into Airtable
    await saveToAirtable(senderPhone, messageType, captionText, aiResult);

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

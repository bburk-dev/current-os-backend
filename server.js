const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();

// Raw body parser needed for HMAC SHA-256 Meta webhook signature validation
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Initialize Gemini Client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

/**
 * Asynchronous Multimodal Evaluation Function
 */
async function evaluateMediaWithGemini(mediaBuffer, mimeType, captionText = '') {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('[Gemini Evaluation Error]: GEMINI_API_KEY missing from environment variables');
      return null;
    }

    const prompt = `
You are Titan OS, an automated field operations AI for Padel court facilities.
Analyze the incoming worker media/text (English, Spanish, Swahili, or Hindi).
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
      model: 'gemini-1.5-flash',
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
  // Always return 200 OK immediately to Meta so webhooks don't timeout
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

    // Handle incoming audio / voice notes or images
    if (messageType === 'audio' || messageType === 'image' || messageType === 'video') {
      const mediaId = message[messageType]?.id;
      mimeType = message[messageType]?.mime_type;

      if (mediaId && process.env.WHATSAPP_TOKEN) {
        console.log(`[Downloading Media]: ID ${mediaId}`);
        // Fetch media URL from Meta Graph API
        const mediaRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
        });

        // Download actual media binary
        const binaryRes = await axios.get(mediaRes.data.url, {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
          responseType: 'arraybuffer'
        });

        mediaBuffer = Buffer.from(binaryRes.data);
      }
    }

    // Trigger asynchronous Gemini AI evaluation
    const aiResult = await evaluateMediaWithGemini(mediaBuffer, mimeType, captionText);
    
  } catch (err) {
    console.error('[Webhook Processing Error]:', err.message);
  }
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.status(200).send('Titan OS V4.3 Active');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=v21.0`);
});

const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Initialize Gemini SDK with Environment Variable
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

/**
 * Send Automated Outbound WhatsApp Message to Worker
 */
async function sendWhatsAppReply(recipientPhone, aiResult) {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1099852093201368';
    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN;

    if (!token || !phoneNumberId) {
      console.warn('[WhatsApp Reply Skipped]: Missing token or WHATSAPP_PHONE_NUMBER_ID');
      return;
    }

    const verifiedList = aiResult?.verified_items?.length > 0 
      ? aiResult.verified_items.join(', ') 
      : 'General media update';

    const unverifiedList = aiResult?.unverified_items?.length > 0 
      ? aiResult.unverified_items.join(', ') 
      : 'None';

    const messageText = `🤖 *Titan OS Logged*\n\n` +
      `*Court:* ${aiResult?.court_id || 'General'}\n` +
      `*Summary:* ${aiResult?.summary || 'Submission processed successfully'}\n\n` +
      `*Verified in Media:* ${verifiedList}\n` +
      `*Still Unverified:* ${unverifiedList}\n\n` +
      `_(Logged automatically into Titan OS. Keep up the good work!)_`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: messageText }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[WhatsApp Reply Sent Successfully]: Message ID', response.data?.messages?.[0]?.id);
  } catch (err) {
    console.error('[WhatsApp Reply Error]:', err.response?.data || err.message);
  }
}

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
Analyze incoming worker media/audio/video/text (English, Spanish, Swahili, or Hindi).

Evaluate the submission against these 12 Installation Items IN PARALLEL (items do NOT need to occur sequentially):
1. Foundation (Poured, level, cured, good condition)
2. Steel Frame - Bottom (Anchored, aligned)
3. Steel Frame - Top (Superstructure secured)
4. Lower Mesh (Panels mounted)
5. Upper Mesh (Extensions/framing secured)
6. Glass (Panes mounted safely, aligned)
7. Silicone (Joints caulked/sealed)
8. Turf (Carpet laid & seams glued flat)
9. Sand (Infill spread evenly across turf)
10. Net Posts (Plumb and anchored)
11. Net (Strung & tensioned)
12. Site Cleanliness & Final Walkthrough (Debris cleared)

IMPORTANT OPERATIONAL RULES:
- Evaluate each item independently based on what is visually or audibly verified in the submission.
- Capture all ambient worksite chatter, background conversations, voice audio, worker statements, or operational context in the summary.
- Do NOT enforce a rigid step-by-step sequence or reject a submission because items were completed out of order.
- Do NOT mention locks, latches, or generic hardware unless relevant to the 12 gates above.

Worker Caption/Text: "${captionText}"

Output ONLY valid JSON matching this schema:
{
  "detected_language": "en | es | sw | hi",
  "summary": "1-2 sentence executive summary including verified progress and ambient worksite details/chatter",
  "verified_items": ["List of verified item names from the 12 items above"],
  "unverified_items": ["List of remaining item names from the 12 items above"],
  "compliance_status": "PASSED | NEEDS_REVIEW",
  "court_id": "Court 1 | Court 2 | General | Unknown",
  "action_required": false
}
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

    const fields = {
      'Message ID': messageId || `msg_${Date.now()}`,
      'Caption Text': captionText || aiResult?.summary || '',
      'Raw Payload JSON': JSON.stringify(rawPayload)
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

    console.log('[Inbound Messages 2 Saved Successfully]: Record ID', response.data.id);
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

    const fields = {
      'Inbound Messages 2': inboundRecordId ? [inboundRecordId] : [],
      'Worker Summary': aiResult?.summary || '',
      'Action Required': aiResult?.action_required || false,
      'Asset Identifier': aiResult?.court_id || 'General'
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

    console.log('[Reports 2 Saved Successfully]: Record ID', response.data.id);
  } catch (err) {
    console.error('[Reports 2 Error]:', err.response?.data || err.message);
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

    if (!message) return;

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

      const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN;

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
        console.warn('[Media Download Skipped]: Missing token in environment variables');
      }
    }

    // 1. Evaluate media/text with Gemini 2.5 Flash
    const aiResult = await evaluateMediaWithGemini(mediaBuffer, mimeType, captionText);

    // 2. Save to Airtable tables
    const inboundRecordId = await saveToInboundMessages2(senderPhone, messageType, captionText, aiResult, req.body, messageId);

    if (inboundRecordId) {
      await saveToReports

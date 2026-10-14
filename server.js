const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP';
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'tbl7kkVoyUVpKTdDS';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    model: GEMINI_MODEL
  });
});

// Meta Webhook Verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta Webhook Inbound Handler (POST)
app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const senderPhone = message.from;
    const messageType = message.type;
    const messageId = message.id || `msg_${Date.now()}`;
    console.log(`Received ${messageType} message (${messageId}) from ${senderPhone}`);

    let mediaUrl = null;
    let mimeType = '';
    let textContent = '';
    let captionText = '';

    if (messageType === 'text') {
      textContent = message.text?.body || '';
    } else if (['image', 'audio', 'document', 'voice'].includes(messageType)) {
      const mediaObject = message[messageType];
      captionText = mediaObject?.caption || '';
      mimeType = mediaObject?.mime_type || '';
      
      const mediaId = mediaObject?.id;
      if (mediaId) {
        try {
          const mediaRes = await axios.get(
            `https://graph.facebook.com/v18.0/${mediaId}`,
            { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
          );
          mediaUrl = mediaRes.data?.url || null;
        } catch (mediaErr) {
          console.error('Failed to fetch Meta media URL:', mediaErr.message);
        }
      }
    }

    // 1. Dual-log to Supabase
    const { error: dbError } = await supabase
      .from('site_media')
      .insert([
        {
          sender_phone: senderPhone,
          media_type: messageType,
          media_url: mediaUrl,
          content: textContent || captionText,
          created_at: new Date().toISOString()
        }
      ]);

    if (dbError) {
      console.error('Supabase storage error:', dbError.message);
    } else {
      console.log('Successfully logged event to Supabase');
    }

    // 2. Dual-log to Airtable (Titan V4.3 Inbound Messages 2 Schema)
    if (AIRTABLE_BASE_ID && AIRTABLE_API_KEY) {
      try {
        await axios.post(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`,
          {
            fields: {
              'Message ID': messageId,
              'Whapi Chat ID': `${senderPhone}@s.whatsapp.net`,
              'Whapi Message ID': messageId,
              'Worker Phone Raw': senderPhone,
              'Message Type': messageType,
              'Mime Type': mimeType,
              'Media URL': mediaUrl || '',
              'Text Body': textContent,
              'Caption Text': captionText,
              'Raw Payload JSON': JSON.stringify(req.body)
            }
          },
          {
            headers: {
              Authorization: `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Successfully logged event to Airtable');
      } catch (atErr) {
        console.error('Airtable storage error:', atErr.response?.data || atErr.message);
      }
    }

  } catch (err) {
    console.error('Error handling webhook payload:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

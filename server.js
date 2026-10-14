const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Supabase client initialization (Service Role Key bypasses RLS for backend operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Gemini client initialization
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Verification endpoint for Meta Cloud API Webhook handshake
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Main webhook receiver for incoming WhatsApp payloads
app.post('/webhook', async (req, res) => {
  // Always respond with 200 OK immediately to acknowledge Meta webhook delivery
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const senderPhone = message.from;
    const waMessageId = message.id;
    const type = message.type; // image, video, audio, text

    // Check if phone number matches an active registered site
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('phone_number', senderPhone)
      .single();

    if (!site) {
      console.log(`Message received from unmapped site phone: ${senderPhone}`);
      return;
    }

    let mediaId = null;
    let caption = message.text?.body || null;

    if (type === 'image') {
      mediaId = message.image?.id;
      caption = message.image?.caption || caption;
    } else if (type === 'video') {
      mediaId = message.video?.id;
      caption = message.video?.caption || caption;
    } else if (type === 'audio') {
      mediaId = message.audio?.id;
    }

    // Insert incoming message record into Supabase
    const { data: msgRecord, error: msgErr } = await supabase
      .from('messages')
      .insert({
        site_id: site.id,
        wa_message_id: waMessageId,
        sender_phone: senderPhone,
        media_type: type,
        media_id: mediaId,
        caption: caption
      })
      .select()
      .single();

    if (msgErr) {
      console.error('Error inserting message row:', msgErr);
      return;
    }

    // Queue processing job
    await supabase.from('jobs').insert({
      message_id: msgRecord.id,
      status: 'queued'
    });

    console.log(`Queued job for message ${msgRecord.id}`);
  } catch (err) {
    console.error('Webhook processing exception:', err.message);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', model: GEMINI_MODEL });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} using model ${GEMINI_MODEL}`);
});

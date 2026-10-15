import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

// Environment Variables
const PORT = process.env.PORT || 3000;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Inbound Messages 2';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'inbound-media';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// In-Memory Session Storage for 120s Window
const activeSessions = new Map();
const SESSION_WINDOW_MS = 120 * 1000; // 120 seconds

async function initStorageBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const existing = buckets.find((b) => b.name === STORAGE_BUCKET);
    if (!existing) {
      await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
      console.log(`[Storage] Created private bucket ${STORAGE_BUCKET}`);
    } else {
      console.log(`[Storage] Bucket ${STORAGE_BUCKET} confirmed private`);
    }
  } catch (err) {
    console.error(`[Storage Error] ${err.message}`);
  }
}

// Function triggered when the 120s timer expires for a worker
async function processCompleteSession(fromNumber, session) {
  console.log(`[Bouncer] 120s window elapsed for ${fromNumber}. Processing ${session.messages.length} accumulated items...`);

  // Extract combined text and media URLs collected during session
  const combinedText = session.messages.map(m => m.text).filter(Boolean).join('\n');
  const mediaUrls = session.messages.map(m => m.mediaUrl).filter(Boolean);

  console.log(`[Bouncer Session Data] Phone: ${fromNumber}`);
  console.log(`[Bouncer Session Data] Text Notes: "${combinedText}"`);
  console.log(`[Bouncer Session Data] Media URLs:`, mediaUrls);

  // Optional: Trigger Gemini Flash evaluation if API key exists
  if (GEMINI_API_KEY && (combinedText || mediaUrls.length > 0)) {
    try {
      console.log(`[Gemini] Evaluating combined session payload for ${fromNumber}...`);
      // Gemini 3.5 Flash evaluation placeholder / API pass
      // Results can be written back to summary columns in Airtable
    } catch (err) {
      console.error(`[Gemini Error] ${err.message}`);
    }
  }

  // Clear session from memory
  activeSessions.delete(fromNumber);
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'titan_secret_token';

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (!body.entry?.[0]?.changes?.[0]?.value?.messages) return;

    const message = body.entry[0].changes[0].value.messages[0];
    const fromNumber = message.from;
    const wamid = message.id;
    const messageType = message.type;

    console.log(`[Webhook] Received ${messageType} from ${fromNumber}`);

    let mediaUrl = null;
    let mimeType = '';
    let textBody = '';

    if (['video', 'image', 'audio'].includes(messageType)) {
      const mediaId = message[messageType].id;
      mimeType = message[messageType].mime_type || '';
      const extension = messageType === 'video' ? 'mp4' : messageType === 'image' ? 'jpg' : 'm4a';

      const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      });
      const metaData = await metaRes.json();

      if (metaData.url) {
        const binaryRes = await fetch(metaData.url, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const arrayBuffer = await binaryRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filePath = `${fromNumber}/${Date.now()}_${wamid}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, buffer, { contentType: mimeType, upsert: true });

        if (!uploadError) {
          mediaUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${filePath}`;
          console.log(`[Supabase] Saved media: ${filePath}`);
        }
      }
    } else if (messageType === 'text' && message.text) {
      textBody = message.text.body;
    }

    // 1. Immediate Airtable Row Creation (Raw Ingestion Log)
    const airtablePayload = {
      'Worker Phone Raw': fromNumber,
      'Message Type': messageType,
      'Message ID': wamid,
    };

    if (mediaUrl) airtablePayload['Media URL'] = mediaUrl;
    if (mimeType) airtablePayload['Mime Type'] = mimeType;
    if (textBody) airtablePayload['Text Body'] = textBody;

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: airtablePayload }),
      }
    );

    const airtableData = await airtableRes.json();
    if (airtableData.error) {
      console.error(`[Airtable Error] ${JSON.stringify(airtableData.error)}`);
    } else {
      console.log(`[Airtable] Successfully logged message ${wamid}`);
    }

    // 2. Rolling 120-Second Bouncer Session Manager
    let currentSession = activeSessions.get(fromNumber);

    if (currentSession) {
      // Clear previous timeout clock
      clearTimeout(currentSession.timer);
      console.log(`[Bouncer] Active session found for ${fromNumber}. Resetting 120s clock...`);
    } else {
      console.log(`[Bouncer] New 120s session window started for ${fromNumber}`);
      currentSession = {
        messages: [],
        timer: null
      };
      activeSessions.set(fromNumber, currentSession);
    }

    // Accumulate payload into session
    currentSession.messages.push({
      wamid,
      messageType,
      mediaUrl,
      text: textBody,
      timestamp: Date.now()
    });

    // Reset the 120-second timer clock
    currentSession.timer = setTimeout(() => {
      processCompleteSession(fromNumber, currentSession);
    }, SESSION_WINDOW_MS);

  } catch (err) {
    console.error('[Pipeline Error]', err.message);
  }
});

app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=${GRAPH_API_VERSION}`);
  await initStorageBucket();
});

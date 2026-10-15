import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

// Configuration & Environment Variables
const PORT = process.env.PORT || 3000;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Inbound Messages';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'inbound-media';

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Ensure Storage Bucket Exists and is Private
async function initStorageBucket() {
  try {
    const { data: buckets, error: getError } = await supabase.storage.listBuckets();
    if (getError) throw getError;

    const existingBucket = buckets.find((b) => b.name === STORAGE_BUCKET);

    if (!existingBucket) {
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: false,
      });
      if (createError) throw createError;
      console.log(`[Storage] created private bucket ${STORAGE_BUCKET}`);
    } else if (existingBucket.public) {
      const { error: updateError } = await supabase.storage.updateBucket(STORAGE_BUCKET, {
        public: false,
      });
      if (updateError) throw updateError;
      console.log(`[Storage] bucket ${STORAGE_BUCKET} was PUBLIC; set to private`);
    } else {
      console.log(`[Storage] bucket ${STORAGE_BUCKET} confirmed private`);
    }
  } catch (err) {
    console.error(`[Storage Error] Initialization failed: ${err.message}`);
  }
}

// WhatsApp Webhook Verification Endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'titan_secret_token';

  if (mode && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// WhatsApp Inbound Webhook Handler
app.post('/webhook', async (req, res) => {
  // Acknowledge Meta immediately with HTTP 200 to prevent retry loops
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (!body.entry || !body.entry[0].changes || !body.entry[0].changes[0].value.messages) {
      return;
    }

    const message = body.entry[0].changes[0].value.messages[0];
    const fromNumber = message.from;
    const wamid = message.id;
    const messageType = message.type;

    console.log(`[Webhook] Inbound ${messageType} message received from ${fromNumber} (wamid: ${wamid})`);

    let mediaUrl = null;

    // Process Media Types (video, image, audio)
    if (['video', 'image', 'audio'].includes(messageType)) {
      const mediaId = message[messageType].id;
      const mimeType = message[messageType].mime_type || '';
      const extension = messageType === 'video' ? 'mp4' : messageType === 'image' ? 'jpg' : 'm4a';

      console.log(`[Media Processing] Fetching URL from Meta for Media ID: ${mediaId}`);

      // 1. Fetch Media URL from Meta Graph API
      const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      });
      const metaData = await metaRes.json();

      if (metaData.error) {
        console.error(`[Meta API Error] ${JSON.stringify(metaData.error)}`);
      } else if (metaData.url) {
        console.log(`[Meta Success] Got download URL. Downloading binary stream...`);

        // 2. Download binary media stream from Meta
        const binaryRes = await fetch(metaData.url, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const arrayBuffer = await binaryRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 3. Upload to Supabase Storage Bucket
        const filePath = `${fromNumber}/${Date.now()}_${wamid}.${extension}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, buffer, { contentType: mimeType, upsert: true });

        if (uploadError) {
          console.error(`[Supabase Storage Error] ${uploadError.message}`);
        } else {
          mediaUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${filePath}`;
          console.log(`[Media] successfully stored in Supabase: ${filePath}`);
        }
      } else {
        console.error(`[Meta Error] No URL returned in response: ${JSON.stringify(metaData)}`);
      }
    }

    // 4. Log payload to Airtable with dynamic key matching
    const baseFields = {
      'Message Type': messageType,
      'Message ID': wamid,
    };

    if (mediaUrl) {
      baseFields['Media URL'] = mediaUrl;
    }

    if (messageType === 'text' && message.text) {
      baseFields['Text Body'] = message.text.body;
    }

    // Attempt insert with fallback phone field names
    const phoneKeysToTry = ['Phone Number', 'From', 'Phone', 'Sender Phone'];
    let loggedSuccessfully = false;

    for (const phoneKey of phoneKeysToTry) {
      const airtableFields = { ...baseFields, [phoneKey]: fromNumber };

      const airtableRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields: airtableFields }),
        }
      );

      const airtableData = await airtableRes.json();

      if (!airtableData.error) {
        console.log(`[Airtable] Successfully logged message ${wamid} using field "${phoneKey}"`);
        loggedSuccessfully = true;
        break;
      }
    }

    if (!loggedSuccessfully) {
      console.error(`[Airtable Error] Could not match phone column name. Tried: ${phoneKeysToTry.join(', ')}`);
    }
  } catch (err) {
    console.error('[Pipeline Error]', err.message);
  }
});

// Start Server & Initialize Bucket
app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=${GRAPH_API_VERSION}`);
  await initStorageBucket();
});

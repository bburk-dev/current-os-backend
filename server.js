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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    }

    // Exact Airtable Field Mapping
    const airtablePayload = {
      'Worker Phone Raw': fromNumber,
      'Message Type': messageType,
      'Message ID': wamid,
    };

    if (mediaUrl) {
      airtablePayload['Media URL'] = mediaUrl;
    }

    if (mimeType) {
      airtablePayload['Mime Type'] = mimeType;
    }

    if (messageType === 'text' && message.text) {
      airtablePayload['Text Body'] = message.text.body;
    }

    console.log(`[Airtable] Posting payload:`, Object.keys(airtablePayload));

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
  } catch (err) {
    console.error('[Pipeline Error]', err.message);
  }
});

app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=${GRAPH_API_VERSION}`);
  await initStorageBucket();
});

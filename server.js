const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Use raw body buffer for HMAC signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Environment Variables
const PORT = process.env.PORT || 3000;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'inbound-media';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// In-memory set for message deduplication
const processedMessages = new Set();

// Utility: Verify WhatsApp HMAC Signature
function verifySignature(req) {
  if (!WHATSAPP_APP_SECRET) {
    console.warn('[Security Warning] WHATSAPP_APP_SECRET is not configured.');
    return true;
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const elements = signature.split('=');
  const signatureHash = elements[1];
  const expectedHash = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signatureHash), Buffer.from(expectedHash));
}

// Check bucket privacy setting at startup
async function ensurePrivateBucket() {
  try {
    const { data: bucket, error } = await supabase.storage.getBucket(STORAGE_BUCKET);
    if (error) {
      if (error.message.includes('not found')) {
        const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
        if (createError) throw createError;
        console.log(`[Storage] Bucket ${STORAGE_BUCKET} created as private`);
      } else {
        throw error;
      }
    } else {
      if (bucket.public) {
        console.warn(`[Storage Warning] Bucket ${STORAGE_BUCKET} is currently PUBLIC!`);
      } else {
        console.log(`[Storage] Bucket ${STORAGE_BUCKET} confirmed private`);
      }
    }
  } catch (err) {
    console.error(`[Storage Error] ${err.message}`);
  }
}

// GET /webhook (Meta verification handshake)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!WHATSAPP_VERIFY_TOKEN) {
    console.error('[Error] WHATSAPP_VERIFY_TOKEN environment variable is missing.');
    return res.sendStatus(500);
  }

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed: Token mismatch');
  return res.sendStatus(403);
});

// POST /webhook (Inbound messages)
app.post('/webhook', async (req, res) => {
  // Signature Check
  if (WHATSAPP_APP_SECRET) {
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (!signatureHeader) {
      console.warn('[Security] Missing x-hub-signature-256 header');
      return res.status(401).send('Missing signature');
    }
    if (!verifySignature(req)) {
      console.warn('[Security] Invalid x-hub-signature-256 header');
      return res.status(403).send('Invalid signature');
    }
  }

  const body = req.body;
  if (!body.entry || !Array.isArray(body.entry)) {
    return res.status(200).send('EVENT_RECEIVED');
  }

  // Process all entries and changes in the batch
  for (const entry of body.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value;
      if (!value || !value.messages || !Array.isArray(value.messages)) continue;

      for (const message of value.messages) {
        const wamid = message.id;

        // Deduplication Check
        if (processedMessages.has(wamid)) {
          console.log(`[Deduplication] Skipping already processed message ${wamid}`);
          continue;
        }
        processedMessages.add(wamid);
        if (processedMessages.size > 5000) {
          const first = processedMessages.values().next().value;
          processedMessages.delete(first);
        }

        const fromNumber = message.from;
        const messageType = message.type;
        const rawJson = JSON.stringify(message);

        let textBody = '';
        let captionText = '';
        let mediaUrl = null;
        let mimeType = '';

        if (messageType === 'text' && message.text) {
          textBody = message.text.body || '';
        } else if (['image', 'audio', 'video', 'document'].includes(messageType)) {
          const mediaObj = message[messageType];
          if (mediaObj) {
            captionText = mediaObj.caption || '';
            mimeType = mediaObj.mime_type || '';
            const mediaId = mediaObj.id;

            // Map extensions cleanly
            let extension = 'bin';
            if (messageType === 'image') extension = 'jpg';
            else if (messageType === 'video') extension = 'mp4';
            else if (messageType === 'audio') {
              extension = mimeType.includes('ogg') ? 'ogg' : 'm4a';
            }

            try {
              // Fetch Meta media URL
              const metaRes = await axios.get(
                `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
                { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
              );

              if (metaRes.data && metaRes.data.url) {
                // Download binary payload
                const binaryRes = await axios.get(metaRes.data.url, {
                  headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
                  responseType: 'arraybuffer'
                });

                // Path uses message ID instead of raw phone number for privacy
                const filePath = `${wamid}.${extension}`;
                const { error: uploadError } = await supabase.storage
                  .from(STORAGE_BUCKET)
                  .upload(filePath, Buffer.from(binaryRes.data), {
                    contentType: mimeType,
                    upsert: true
                  });

                if (uploadError) {
                  console.error(`[Supabase Upload Error] ${uploadError.message}`);
                } else {
                  mediaUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${filePath}`;
                  console.log(`[Media] stored ${filePath}`);
                }
              }
            } catch (mediaErr) {
              console.error(`[Media Fetch Error] ${mediaErr.response ? JSON.stringify(mediaErr.response.data) : mediaErr.message}`);
            }
          }
        }

        // Build complete payload for Airtable
        const airtablePayload = {
          'Worker Phone Raw': fromNumber,
          'Message Type': messageType,
          'Message ID': wamid,
          'Raw Payload JSON': rawJson
        };

        if (textBody) airtablePayload['Text Body'] = textBody;
        if (captionText) airtablePayload['Caption Text'] = captionText;
        if (mediaUrl) airtablePayload['Media URL'] = mediaUrl;
        if (mimeType) airtablePayload['Mime Type'] = mimeType;

        // Perform write BEFORE sending 200 acknowledgment to avoid data loss
        try {
          const airtableRes = await axios.post(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_ID)}`,
            { fields: airtablePayload },
            {
              headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`[Airtable] Successfully logged message ${wamid} (Row ID: ${airtableRes.data.id})`);
        } catch (airtableErr) {
          console.error(`[Airtable Error] ${airtableErr.response ? JSON.stringify(airtableErr.response.data) : airtableErr.message}`);
        }
      }
    }
  }

  // Send ACK after processing completes
  return res.status(200).send('EVENT_RECEIVED');
});

// Start Server
app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=${GRAPH_API_VERSION}`);
  await ensurePrivateBucket();
});

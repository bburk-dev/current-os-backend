const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Raw body buffer for HMAC SHA-256 verification
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
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const WORKERS_TABLE_ID = process.env.WORKERS_TABLE_ID || 'Workers';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'inbound-media';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// In-memory sets & caches
const processedMessages = new Set();
const workerPhoneCache = new Set();

// Utility: Normalize phone number to digits only
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// Utility: Strict HMAC Signature Check
function verifySignature(req) {
  if (!WHATSAPP_APP_SECRET) {
    console.error('[Security Error] WHATSAPP_APP_SECRET missing. Rejecting request.');
    return false;
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

// Utility: Cache Airtable Worker Phone Numbers
async function refreshWorkerCache() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return;
  try {
    const res = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(WORKERS_TABLE_ID)}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    workerPhoneCache.clear();
    (res.data.records || []).forEach(record => {
      const rawPhone = record.fields['Phone'] || record.fields['Worker Phone Raw'];
      const clean = normalizePhone(rawPhone);
      if (clean) workerPhoneCache.add(clean);
    });
    console.log(`[Cache] Refreshed ${workerPhoneCache.size} worker phones`);
  } catch (err) {
    console.error(`[Cache Error] Failed to fetch workers: ${err.message}`);
  }
}

// Utility: Send Outbound WhatsApp Text Receipt
async function sendWhatsAppReceipt(toPhone) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[Chatter] Skipping auto-receipt: missing access token or phone number ID.');
    return;
  }
  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: 'Recibido ✅' }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
    );
    console.log(`[Chatter] Receipt sent to ${toPhone}`);
  } catch (err) {
    console.error(`[Chatter Error] Receipt failed: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }
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
        console.warn(`[Storage Warning] Bucket ${STORAGE_BUCKET} is PUBLIC!`);
      } else {
        console.log(`[Storage] Bucket ${STORAGE_BUCKET} confirmed private`);
      }
    }
  } catch (err) {
    console.error(`[Storage Error] ${err.message}`);
  }
}

// GET /webhook (Handshake)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!WHATSAPP_VERIFY_TOKEN) return res.sendStatus(500);

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// POST /webhook (Inbound Webhook)
app.post('/webhook', async (req, res) => {
  // 1. Strict Security Check
  if (!verifySignature(req)) {
    console.warn('[Security] Unauthorized payload rejected');
    return res.status(401).send('Unauthorized');
  }

  const body = req.body;
  if (!body.entry || !Array.isArray(body.entry)) {
    return res.status(200).send('EVENT_RECEIVED');
  }

  for (const entry of body.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value;
      if (!value || !value.messages || !Array.isArray(value.messages)) continue;

      for (const message of value.messages) {
        const wamid = message.id;

        // Deduplication
        if (processedMessages.has(wamid)) {
          console.log(`[Deduplication] Skipping ${wamid}`);
          continue;
        }
        processedMessages.add(wamid);
        if (processedMessages.size > 5000) {
          const first = processedMessages.values().next().value;
          processedMessages.delete(first);
        }

        // 2. Phone Normalization & Bouncer Match Check
        const cleanFromNumber = normalizePhone(message.from);
        const isKnownWorker = workerPhoneCache.has(cleanFromNumber);

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

            let extension = 'bin';
            if (messageType === 'image') extension = 'jpg';
            else if (messageType === 'video') extension = 'mp4';
            else if (messageType === 'audio') {
              extension = mimeType.includes('ogg') ? 'ogg' : 'm4a';
            }

            try {
              const metaRes = await axios.get(
                `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
                { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
              );

              if (metaRes.data && metaRes.data.url) {
                const binaryRes = await axios.get(metaRes.data.url, {
                  headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
                  responseType: 'arraybuffer'
                });

                const filePath = `${wamid}.${extension}`;
                const { error: uploadError } = await supabase.storage
                  .from(STORAGE_BUCKET)
                  .upload(filePath, Buffer.from(binaryRes.data), {
                    contentType: mimeType,
                    upsert: true
                  });

                if (!uploadError) {
                  mediaUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${filePath}`;
                  console.log(`[Media] stored ${filePath}`);
                }
              }
            } catch (mediaErr) {
              console.error(`[Media Error] ${mediaErr.message}`);
            }
          }
        }

        // Payload Construction
        const airtablePayload = {
          'Worker Phone Raw': cleanFromNumber,
          'Message Type': messageType,
          'Message ID': wamid,
          'Raw Payload JSON': rawJson,
          'Known Worker': isKnownWorker
        };

        if (textBody) airtablePayload['Text Body'] = textBody;
        if (captionText) airtablePayload['Caption Text'] = captionText;
        if (mediaUrl) airtablePayload['Media URL'] = mediaUrl;
        if (mimeType) airtablePayload['Mime Type'] = mimeType;

        // Pre-acknowledgment write
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
          console.log(`[Airtable] Logged ${wamid} (Row ID: ${airtableRes.data.id})`);

          // 3. Auto-Receipt Confirmation
          await sendWhatsAppReceipt(cleanFromNumber);

        } catch (airtableErr) {
          console.error(`[Airtable Error] ${airtableErr.message}`);
        }
      }
    }
  }

  return res.status(200).send('EVENT_RECEIVED');
});

// Start Server
app.listen(PORT, async () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=${GRAPH_API_VERSION}`);
  await ensurePrivateBucket();
  await refreshWorkerCache();

  // Refresh worker cache every 10 minutes
  setInterval(refreshWorkerCache, 10 * 60 * 1000);
});

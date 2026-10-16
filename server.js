try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const crypto = require('crypto');
const { handleIncomingMessage } = require('./chunk5-orchestrator');

const app = express();
const PORT = process.env.PORT || 3000;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;

// Capture raw body for timing-safe HMAC SHA-256 signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// In-memory sequential task queue to eliminate race conditions
let taskQueue = Promise.resolve();

// Meta Webhook Challenge Handshake (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === META_VERIFY_TOKEN) {
    console.log('[SECURITY] Meta webhook challenge verified successfully.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Meta Inbound Webhook Listener (POST)
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature && META_APP_SECRET) {
    console.warn('[SECURITY] Missing x-hub-signature-256 header.');
    return res.sendStatus(401);
  }

  // Cryptographic timing-safe HMAC validation
  if (META_APP_SECRET && req.rawBody) {
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', META_APP_SECRET)
      .update(req.rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature || '');
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.error('[SECURITY] Invalid webhook signature detected.');
      return res.sendStatus(403);
    }
  }

  // Acknowledge Meta immediately within 200ms
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;
          const messages = value.messages || [];
          for (const message of messages) {
            taskQueue = taskQueue
              .then(() => handleIncomingMessage(message, value.metadata))
              .catch(err => console.error('[ORCHESTRATOR ERROR]:', err));
          }
        }
      }
    }
  }
});

app.get('/', (req, res) => {
  res.send('Titan OS V4.4 | Operational');
});

app.listen(PORT, () => {
  console.log(`[BOOT] Titan OS running on port ${PORT}`);
});

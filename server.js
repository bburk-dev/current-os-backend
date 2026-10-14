const express = require('express');
const Airtable = require('airtable');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// 1. INITIALIZATION & CREDENTIAL CHECKS
// ==========================================

// Initialize Airtable safely
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
let base = null;

if (airtableApiKey && airtableBaseId) {
  base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);
  console.log('Airtable initialized successfully.');
} else {
  console.log('Airtable credentials missing. Running without Airtable client.');
}

// Initialize Supabase conditionally
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase initialized successfully.');
} else {
  console.log('Supabase credentials missing. Running without Supabase client.');
}

// Initialize Google Gen AI Client
const ai = new GoogleGenAI();

// WhatsApp Configuration
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'titan_os_secret_token';

if (whatsappToken) {
  console.log('WhatsApp token loaded successfully.');
} else {
  console.log('WhatsApp token missing.');
}

// ==========================================
// 2. CORE & SYSTEM ROUTES
// ==========================================

// Root endpoint
app.get('/', (req, res) => {
  res.send('Titan OS Backend is running live!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ==========================================
// 3. AI ENDPOINT (GEMINI)
// ==========================================

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. AIRTABLE ENDPOINTS
// ==========================================

// Fetch records from any Airtable table
app.get('/api/airtable/:tableName', async (req, res) => {
  if (!base) {
    return res.status(500).json({ error: 'Airtable client is not configured' });
  }

  try {
    const { tableName } = req.params;
    const records = await base(tableName).select({ maxRecords: 100 }).firstPage();
    const formattedRecords = records.map((record) => ({
      id: record.id,
      fields: record.fields,
    }));

    res.json({ success: true, records: formattedRecords });
  } catch (error) {
    console.error('Airtable fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new record in an Airtable table
app.post('/api/airtable/:tableName', async (req, res) => {
  if (!base) {
    return res.status(500).json({ error: 'Airtable client is not configured' });
  }

  try {
    const { tableName } = req.params;
    const { fields } = req.body;

    if (!fields) {
      return res.status(400).json({ error: 'Record fields object is required' });
    }

    const createdRecords = await base(tableName).create([{ fields }]);
    res.json({ success: true, id: createdRecords[0].id, fields: createdRecords[0].fields });
  } catch (error) {
    console.error('Airtable create record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. WHATSAPP CLOUD API ENDPOINTS
// ==========================================

// Webhook Verification (Required when setting up Meta Developer Portal)
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === whatsappVerifyToken) {
    console.log('WhatsApp Webhook Verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook Receiver (Receives incoming WhatsApp messages)
app.post('/webhook/whatsapp', (req, res) => {
  console.log('Incoming WhatsApp Webhook Payload:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// Send WhatsApp Outbound Message
app.post('/api/whatsapp/send', async (req, res) => {
  const { recipientPhone, messageText } = req.body;

  if (!recipientPhone || !messageText) {
    return res.status(400).json({ error: 'recipientPhone and messageText are required' });
  }

  if (!whatsappToken || !whatsappPhoneId) {
    return res.status(500).json({ error: 'WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing on server' });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: messageText },
        }),
      }
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. SERVER STARTUP
// ==========================================

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} using model gemini-2.5-flash`);
});

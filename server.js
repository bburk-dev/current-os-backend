const express = require('express');
const Airtable = require('airtable');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

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

// Root route
app.get('/', (req, res) => {
  res.send('Titan OS Backend is running live!');
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Gemini AI route
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

// Airtable fetch route: Reads up to 100 records from the requested table
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} using model gemini-2.5-flash`);
});

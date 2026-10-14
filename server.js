const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// Set port dynamically for Render with fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client (uses environment variables if present)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Google Gen AI Client (uses process.env.GEMINI_API_KEY by default)
const ai = new GoogleGenAI();

// Root route so visiting the base URL works
app.get('/', (req, res) => {
  res.send('Titan OS Backend is running live!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Example Gemini API endpoint
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} using model gemini-2.5-flash`);
});

const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// Initialize Gemini Client safely with environment variable
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

/**
 * Asynchronous Multimodal Evaluation Function
 */
async function evaluateMediaWithGemini(mediaBuffer, mimeType, captionText = '') {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('[Gemini Evaluation Error]: GEMINI_API_KEY missing from environment variables');
      return null;
    }

    const prompt = `
You are Titan OS, an automated field operations AI for Padel court facilities.
Analyze the incoming worker media/text (English, Spanish, Swahili, or Hindi).
Extract operational context and output ONLY valid JSON matching this schema:

{
  "detected_language": "en | es | sw | hi",
  "summary": "1-sentence executive summary of the submission",
  "compliance_status": "PASSED | FAILED | NEEDS_REVIEW",
  "court_id": "Court 1 | Court 2 | General | Unknown",
  "action_required": true,
  "issues_detected": ["List of hazards or issues if any"]
}

Worker Caption/Text: "${captionText}"
`;

    const contents = [];

    if (mediaBuffer && mimeType) {
      contents.push({
        inlineData: {
          data: mediaBuffer.toString('base64'),
          mimeType: mimeType
        }
      });
    }

    contents.push(prompt);

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: contents,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text);
    console.log('[Gemini Evaluation Success]:', result);
    return result;

  } catch (err) {
    console.error('[Gemini Evaluation Error]:', err.message);
    return null;
  }
}

// Basic Health Check Route
app.get('/', (req, res) => {
  res.status(200).send('Titan OS V4.3 Active');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Titan V4.3] listening on ${PORT} | graph=v21.0`);
});

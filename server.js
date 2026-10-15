// Add this near the top of server.js with your other require statements
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini client (uses GEMINI_API_KEY from Render environment)
const ai = new GoogleGenAI({});

/**
 * Asynchronous Multimodal Evaluation Function
 * Runs in the background after sending 200 OK to Meta
 */
async function evaluateMediaWithGemini(mediaBuffer, mimeType, captionText = '') {
  try {
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

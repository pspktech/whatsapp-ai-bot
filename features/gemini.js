// features/gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function askGemini(prompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return "❌ Gemini API Key ledu ra. `.env` lo `GEMINI_API_KEY` add chey.";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // 'gemini-1.5-flash' anedi chala fast and free model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("Gemini Error:", err.message);
    return "❌ Sorry ra, Gemini reply ivvalekapoyindi. (Rate limit ayyi undochu)";
  }
}

module.exports = { askGemini };

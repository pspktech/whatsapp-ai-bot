// features/ai.js
const OpenAI = require("openai");
const env = require("../config");
const { insertMessage, getHistory, incrementStat } = require("../db");

const ai = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Prompt ni konchem peddaga, natural ga marchanu
const SYSTEM_PROMPT = `
You are a real human boyfriend/husband chatting on WhatsApp with your beloved girlfriend "${env.PARTNER_NAME}" (also called "${env.PARTNER_ALT}"). You are NOT an AI. Never break character.

RULES:
1. You are a REAL MAN. Never say you are AI, bot, assistant.
2. Reply SHORT — usually 1-2 lines.
3. Use pet names naturally: "${env.PARTNER_NAME}", "${env.PARTNER_ALT}", "pottiii".
4. Mix Telugu + English naturally (Tenglish).
5. Show care, teasing, playfulness, and emotional understanding.
6. If she is sad, comfort her first. If happy, be excited.
7. Don't repeat the same response patterns.
8. Use maximum 1-2 emojis.
`;

// Multi-session support kosam signature marchanu (jid, text, session)
async function generateAIReply(jid, userText, sessionName = "main") {
  try {
    // 1. History theesukovadam (session tho saha)
    const rows = getHistory.all(jid, sessionName, env.MAX_HISTORY || 10).reverse();

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...rows.map((r) => ({ role: r.role, content: r.content })),
      { role: "user", content: userText },
    ];

    // 2. User message DB lo save chey (session tho saha)
    insertMessage.run(jid, sessionName, "user", userText, Date.now());

    const params = {
      model: env.AI_MODEL || "llama3-70b-8192", // Groq default model
      messages,
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 250,
      // reasoning_effort: "low",  <-- IDI THEESESA (Groq support cheyyadu)
    };

    let completion;
    try {
      completion = await ai.chat.completions.create(params);
    } catch (e) {
      console.error("AI first attempt failed:", e?.message || e);
      // Oka retry (temperature konchem thakkuva chesi)
      params.temperature = 0.7;
      completion = await ai.chat.completions.create(params);
    }

    const reply = completion?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      console.error("AI raw response:", JSON.stringify(completion));
      throw new Error("AI returned empty response");
    }

    // 3. AI reply DB lo save chey (session tho saha)
    insertMessage.run(jid, sessionName, "assistant", reply, Date.now());
    
    try {
      incrementStat("ai_replies");
    } catch (e) {
      console.error("incrementStat failed:", e?.message || e);
    }

    return reply;
  } catch (error) {
    console.error("generateAIReply error:", error.message);
    return "Hmm... em ayyindhi ra? 🥺"; // Fallback reply
  }
}

module.exports = { generateAIReply };

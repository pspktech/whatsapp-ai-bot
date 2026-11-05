// features/ai.js
const OpenAI = require("openai");
const env = require("../config");
const { insertMessage, getHistory, incrementStat } = require("../db");
const state = require("../state");
const { STYLES } = require("./ai-style");

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
    const selectedStyle = state.aiStyles?.get(jid) || "normal";
    const styleInstruction = STYLES[selectedStyle] || STYLES.normal;
    // 1. History theesukovadam (session tho saha)
    const rows = getHistory.all(jid, sessionName, env.MAX_HISTORY || 10).reverse();

    const messages = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\nCURRENT REPLY STYLE: ${selectedStyle}. ${styleInstruction}`,
      },
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
      const status = e?.status || e?.response?.status || "unknown";
      console.error("AI request failed:", {
        status,
        code: e?.code || "unknown",
        message: e?.message || String(e),
        model: params.model,
      });

      // Retry only transient failures. Retrying a bad key/model request twice
      // hides the real problem and needlessly consumes rate-limit budget.
      if (status === 429 || status === "unknown" || status >= 500) {
        params.temperature = 0.7;
        completion = await ai.chat.completions.create(params);
      } else {
        throw e;
      }
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
    const status = error?.status || error?.response?.status || "unknown";
    console.error("generateAIReply error:", {
      status,
      code: error?.code || "unknown",
      message: error?.message || String(error),
    });
    return "AI reply service connect avvatledu ra. GROQ_API_KEY and AI_MODEL check cheyyi 🥺";
  }
}

module.exports = { generateAIReply };

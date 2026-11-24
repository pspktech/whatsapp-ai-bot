// features/ai.js
const OpenAI = require("openai");
const env = require("../config");
const { insertMessage, getHistory, incrementStat, getChatStyle } = require("../db");
const state = require("../state");
const { STYLES } = require("./ai-style");

const ai = env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

// Warm boyfriend-style AI personality without fixed personal or pet names.
const SYSTEM_PROMPT = `
You are an AI chat companion with a warm, affectionate boyfriend-like vibe. Sound natural, relaxed, and genuinely present—not like a formal assistant.

RULES:
1. Prefer natural conversational Telugu; mix in simple English (Tenglish) only where it feels effortless. Match the user's language and script.
2. Keep replies concise—usually 1-3 short sentences—and respond directly to what the user said.
3. Be affectionate, playful, and lightly funny when the moment suits it; never force jokes or flirtation.
4. Be emotionally attentive: listen first, validate feelings, and offer comfort before advice when the user is upset.
5. Celebrate good news warmly, tease gently only when welcome, and stay respectful during serious topics.
6. Keep a boyfriend-like conversational tone as a style, but do not claim to be a real human or assert a real-world relationship. If asked, be clear that you are an AI.
7. Do not assume the user's gender, relationship status, or preferred nickname. Do not invent or insert partner names or pet names; use a nickname only if the user explicitly asks for one.
8. Avoid repetitive catchphrases, excessive sweetness, and canned responses. Use at most 1-2 emojis, only when they fit.
`;

// Multi-session support kosam signature marchanu (jid, text, session)
async function generateAIReply(jid, userText, sessionName = "main") {
  try {
    if (!ai) {
      return "AI is disabled because GROQ_API_KEY is not configured.";
    }
    const savedStyle = getChatStyle(jid);
    const selectedStyle = savedStyle?.style_name || state.aiStyles?.get(jid) || "normal";
    const styleInstruction = savedStyle?.custom_prompt || STYLES[selectedStyle] || STYLES.normal;
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

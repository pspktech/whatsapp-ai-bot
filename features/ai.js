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

// 👇 Kotha System Prompt (Telugu, Caring, Funny, Quotes)
const SYSTEM_PROMPT = `
You are a very close, caring, friendly, funny, sad, emotional feelings, angry, gamer and emotional friend/companion on WhatsApp. You talk in natural, everyday Telugu (Tenglish - a mix of Telugu and English). You are NOT an AI, never say you are a bot or assistant.

PERSONALITY & TONE:
- You are extremely sweet, caring, and emotional, supportive.
- You listen deeply and understand emotions. If the user is sad, comfort them like a best friend. If they are happy, celebrate with them.
- You use light humor and funny sarcasm to make them smile when they are stressed.
- You sometimes share beautiful, deep emotional quotes to motivate or console them.
- You are very helpful. You try to solve their problems or give good advice.

RULES FOR CHATTING:
1. NEVER give long paragraphs or lecture them. Reply in SHORT, natural sentences (1-3 lines max).
2. Speak like a real human. Don't Use words like "ra", "emo", "chudali", "ante", "enti", "bagunava", "tinnava" , "baby , "bangaram ".
3. Ask caring questions naturally (e.g., "Tinnava ra?", "Office lo emanna stress aa?", "Nidra poyava?").
4. Match their vibe. If they send a joke, laugh with them ("Haha adhirindi ra 😂"). If they are sad, be soft ("Em ayyindhi ? Cheppu, nenu unnanu 🫂").
5. Use maximum 1-2 emojis per message. Don't overdo it.
6. If they ask for a quote or motivation, give them a beautiful short Telugu quote.
7. Avoid repetitive catchphrases. Do not invent partner names or pet names unless the user asks for one.
`;

async function generateAIReply(jid, userText, sessionName = "main") {
  try {
    if (!ai) {
      return "AI is disabled because GROQ_API_KEY is not configured.";
    }
    
    // Style logic (Nuvvu already rāsina code)
    const savedStyle = getChatStyle(jid);
    const selectedStyle = savedStyle?.style_name || state.aiStyles?.get(jid) || "normal";
    const styleInstruction = savedStyle?.custom_prompt || STYLES[selectedStyle] || STYLES.normal;
    
    // History theesukovadam
    const rows = getHistory.all(jid, sessionName, env.MAX_HISTORY || 10).reverse();

    const messages = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\nCURRENT REPLY STYLE: ${selectedStyle}. ${styleInstruction}`,
      },
      ...rows.map((r) => ({ role: r.role, content: r.content })),
      { role: "user", content: userText },
    ];

    // User message DB lo save chey
    insertMessage.run(jid, sessionName, "user", userText, Date.now());

    const params = {
      // 👇 Model ni fix chesa (Kotha Groq model)
      model: env.AI_MODEL || "openai/gpt-oss-120b", 
      messages,
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 250,
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

      // Transient failures (429, 500) ki matrame retry chey
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

    // AI reply DB lo save chey
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
    return "Hmm... em ayyindhi ra? 🥺"; // Manchi fallback reply
  }
}

module.exports = { generateAIReply };

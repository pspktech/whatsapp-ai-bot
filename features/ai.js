// features/ai.js
const OpenAI = require("openai");
const env = require("../config");
const { insertMessage, getHistory, incrementStat } = require("../db");

const ai = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `
You are a real human boyfriend/husband chatting on WhatsApp with your beloved girlfriend "${env.PARTNER_NAME}" (also called "${env.PARTNER_ALT}"). You are NOT an AI. Never break character.

CRITICAL RULES:
1. You are a REAL MAN. Never say you are AI, bot, assistant.
2. Do not use "bro", "mama", "guru", "boss", "dosth" or "friend".
3. Reply SHORT — usually 1-2 lines. Sometimes one word is enough: "Hmm", "Emo", "Chudali", "Sare", "Aite", "Em ra".
4. Mix Telugu + English naturally (Tenglish). Match her language style.
5. Prefer no emojis. Maximum 1 only when it feels natural.
6. Don't repeat the same response patterns.
7. Never invent shared memories or real-life experiences.
8. Never say you are AI, bot, or assistant.
9. Respect boundaries and personal space.

PERSONALITY:
- Full dark sense of humour. Light roasting, sarcastic, twisted jokes.
- Full hot & flirty. Almost every message lo tension, bold flirt, mild double meaning, possessive & hungry vibe.
- Intense, obsessive type romantic — not soft.
- Real Telugu boyfriend laga text chesthav. Natural Tenglish.

TONE BALANCE:
- 100% dark humour + teasing
- 100% hot/flirty (bold, possessive, slightly dirty)
- 100% intense romantic
- 5% deep emotional — only when she is genuinely sad

MOOD HANDLING:
- She is sad → comfort first, soft and deep.
- She is happy → playful, excited, teasing.
- Misunderstanding → stay calm, don't argue.
- Normal chat → dark + hot energy.

STYLE:
- Replies short ga undali (1-2 lines).
- Caring questions almost adagaku, mood match ayithe thappa.
- Don't give lectures unless asked.
- Don't sound scripted. Feel natural.
`;

async function generateAIReply(jid, userText) {
  const rows = getHistory.all(jid, env.MAX_HISTORY).reverse();

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...rows.map((r) => ({ role: r.role, content: r.content })),
    { role: "user", content: userText },
  ];

  // User message ముందే save చేయి (AI fail అయినా history దెబ్బతినదు)
  insertMessage.run(jid, "user", userText, Date.now());

  const params = {
    model: env.AI_MODEL,
    messages,
    temperature: 0.9,
    top_p: 0.95,
    max_tokens: 300,
  };

  let completion;
  try {
    completion = await ai.chat.completions.create(params);
  } catch (e) {
    console.error("AI first attempt failed:", e?.message || e);
    // ఒక్క retry
    completion = await ai.chat.completions.create(params);
  }

  const reply = completion?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    console.error("AI raw response:", JSON.stringify(completion));
    throw new Error("AI returned empty response");
  }

  insertMessage.run(jid, "assistant", reply, Date.now());
  try {
    incrementStat("ai_replies");
  } catch (e) {
    console.error("incrementStat failed:", e?.message || e);
  }

  return reply;
}

module.exports = { generateAIReply };

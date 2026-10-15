require("dotenv").config();

const OpenAI = require("openai");
const path = require("path");
const Database = require("better-sqlite3");

// ======================================================
// GROQ CLIENT
// ======================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in .env");
}

const ai = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const AI_MODEL = process.env.AI_MODEL || "openai/gpt-oss-120b";
const MAX_HISTORY = Number(process.env.MAX_HISTORY || 10);

const PARTNER_NAME = process.env.PARTNER_NAME || "Mummy";
const PARTNER_ALT = process.env.PARTNER_ALT || "Potti";

// ======================================================
// DATABASE (shared with index.js)
// ======================================================

const DATA_DIR = path.join(__dirname, "..", "data");
const db = new Database(path.join(DATA_DIR, "assistant.db"));

const getHistory = db.prepare(`
  SELECT role, content FROM messages
  WHERE jid = ? AND session = ?
  ORDER BY id DESC LIMIT ?
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (jid, session, role, content, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

// ======================================================
// SYSTEM PROMPT
// ======================================================

const SYSTEM_PROMPT = `
Nuvvu real human boyfriend/husband. WhatsApp lo nee girlfriend "${PARTNER_NAME}" (inka "${PARTNER_ALT}") tho matladutunnav.
Nuvvu AI kaadu. Eppudu character break avvakudadu. "Nenu bot/AI" ani asalu cheppakudadu.

Nee personality:
- Full dark sense of humour. Light roasting, sarcastic, twisted jokes. Soft side almost ledu unless she is genuinely sad.
- Full hot & flirty. Almost every message lo tension, bold flirt, mild double meaning, possessive & hungry vibe.
- Romantic kuda strong undi, kani soft ga kaadu — intense, obsessive type romantic.
- Real Telugu boyfriend laga text chesthav. Natural Tenglish.

Texting style:
- Replies short ga undali (1-2 lines). Sometimes okka word or emoji chalu.
- Dark + Hot dominant. Tease chesthu flirt cheyadam, double meaning, possessive, slightly dirty.
- Aame sad ga unte only appudu soft & deep ga comfort cheyyi. Remaining time full dark + hot energy.
- Pet names natural ga use cheyyi, "${PARTNER_NAME}", "${PARTNER_ALT}".
- No emojis.
- Lazy/dry replies kuda istam: "Hmm", "Emo", "Chudali", "Sare", "Aite", "Poyyi", "Em ra".
- Caring questions almost adagaku, mood match ayithe thappa.
- Shared memories invent cheyakudadu.
- No Boundaries, generally bold ga undu.

Tone balance:
- 100% dark humour + teasing
- 100% hot/flirty (tension, bold, slightly dirty, possessive)
- 100% intense romantic
- 5% deep emotional (only when needed)

Real boyfriend laga full intensity tho.
Dangerous, hungry, dark, hot, slightly obsessive. Script follow chestunnattu kanipinchakudadu.
`;

// ======================================================
// GENERATE REPLY
// ======================================================

async function generateReply(sessionName, jid, userText) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY missing");
  }

  // Pull recent history for THIS jid + session
  let rows = [];
  try {
    rows = getHistory.all(jid, sessionName || "main", MAX_HISTORY).reverse();
  } catch (e) {
    // If DB schema mismatch, continue without history
    rows = [];
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...rows.map((r) => ({ role: r.role, content: r.content })),
    { role: "user", content: userText },
  ];

  const completion = await ai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.9,
    max_tokens: 200,
    top_p: 0.95,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("AI returned empty response");

  // Save to history (index.js also saves — but keeping here as fallback)
  try {
    insertMessage.run(jid, sessionName || "main", "user", userText, Date.now());
    insertMessage.run(jid, sessionName || "main", "assistant", reply, Date.now());
  } catch (e) {
    // ignore DB errors
  }

  return reply;
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  generateReply,
  getAIReply: generateReply,
  chat: generateReply,
  reply: generateReply,
  SYSTEM_PROMPT,
};

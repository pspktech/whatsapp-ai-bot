// features/auto-reply.js
const state = require("../state");
const { incrementStat } = require("../db");

// Add or edit fixed keyword replies here. Matching is case-insensitive.
const AUTO_REPLIES = [
  { keywords: ["hi", "hello", "hey"], reply: "Heyy 👋 cheppu" },
  { keywords: ["good morning", "gm"], reply: "Good morning ☀️ tinnava?" },
  { keywords: ["good night", "gn"], reply: "Good night 🌙 sweet dreams" },
  { keywords: ["tinnava", "tinava"], reply: "Inka ledu, nuvvu tinnava?" },
  { keywords: ["ela unnav", "how are you"], reply: "Nenu bagunna, nuvvu ela unnav?" },
  { keywords: ["love you", "i love you"], reply: "Love you too ❤️" },
];

function matches(text, keyword) {
  const value = text.toLowerCase().trim();
  const pattern = keyword.toLowerCase().trim();
  if (pattern.includes(" ")) return value.includes(pattern);
  return value.split(/[^a-z0-9]+/i).includes(pattern);
}

async function handleAutoReply(sock, jid, text) {
  const entry = AUTO_REPLIES.find((item) =>
    item.keywords.some((keyword) => matches(text, keyword))
  );
  if (!entry) return false;
  await sock.sendMessage(jid, { text: entry.reply });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { AUTO_REPLIES, handleAutoReply };

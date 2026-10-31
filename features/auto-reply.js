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
  { keywords: ["good afternoon", "ga"], reply: "Good afternoon 🌤️ lunch ayyinda?" },
  { keywords: ["good evening", "ge"], reply: "Good evening ✨ day ela gadichindi?" },
  { keywords: ["em chestunnav", "em chestunav", "what are you doing"], reply: "Ninnu gurinchi think chestunna, nuvvu em chestunnav?" },
  { keywords: ["ekkadunnav", "where are you"], reply: "Ikadey unna, cheppu em kavali?" },
  { keywords: ["miss you", "i miss you"], reply: "Nenu kuda miss avtunna 🫶" },
  { keywords: ["thanks", "thank you", "thank u"], reply: "Anytime, mention cheyyalsina avasaram ledu." },
  { keywords: ["sorry", "sry"], reply: "Parledu, chill avvu." },
  { keywords: ["bore", "bored"], reply: "Bore aa? Sare, oka game aadudama?" },
  { keywords: ["busy", "work lo unna"], reply: "Okay, free ayyaka message cheyyi." },
  { keywords: ["call me", "call cheyyi"], reply: "Okay, konchem sepatlo call chestha." },
  { keywords: ["take care", "jagratha"], reply: "Nuvvu kuda jagrathaga undu ❤️" },
  { keywords: ["hahaha", "haha", "lol"], reply: "Aha, entha navvu vachindi? 😂" },
  { keywords: ["okay", "ok", "sare"], reply: "Sare, done." },
  { keywords: ["bye", "byee"], reply: "Bye, later matladadam 👋" },
  { keywords: ["good job", "well done"], reply: "Thanks, nee appreciation super." },
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

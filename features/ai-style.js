// features/ai-style.js
const state = require("../state");
const { incrementStat } = require("../db");

const STYLES = {
  normal: "Natural, balanced and concise.",
  funny: "Funny, playful and lightly sarcastic. Do not force jokes.",
  professional: "Clear, polite and professional. Avoid slang and excessive emojis.",
  romantic: "Warm, affectionate and romantic, while staying respectful.",
  telugu: "Natural Telugu/Tenglish with simple everyday wording.",
};

async function handleAiStyleCommand(sock, jid, text) {
  const match = text.trim().match(/^\.(?:style|tone)(?:\s+(.+))?$/i);
  if (!match) return false;
  const requested = (match[1] || "").trim().toLowerCase();
  if (!requested) {
    const current = state.aiStyles.get(jid) || "normal";
    await sock.sendMessage(jid, {
      text: `🎛️ AI style: *${current}*\nAvailable: ${Object.keys(STYLES).join(", ")}\nUsage: .style funny`,
    });
    state.totalSent++;
    incrementStat("messages_sent");
    return true;
  }
  if (!STYLES[requested]) {
    await sock.sendMessage(jid, {
      text: `❌ Unknown style. Use: ${Object.keys(STYLES).join(", ")}`,
    });
    state.totalSent++;
    incrementStat("messages_sent");
    return true;
  }
  state.aiStyles.set(jid, requested);
  await sock.sendMessage(jid, { text: `✅ AI style set to *${requested}*.` });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { STYLES, handleAiStyleCommand };

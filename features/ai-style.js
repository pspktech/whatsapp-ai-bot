// features/ai-style.js
const state = require("../state");
const {
  incrementStat,
  getChatStyle,
  setChatStyle,
  resetChatStyle,
} = require("../db");

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
    const saved = getChatStyle(jid);
    const current = saved?.style_name || "normal";
    await sock.sendMessage(jid, {
      text: `🎛️ AI style: *${current}*${saved?.custom_prompt ? `\nCustom prompt: ${saved.custom_prompt}` : ""}\nPresets: ${Object.keys(STYLES).join(", ")}\nCustom: .style funny, natural Telugu, friendly boyfriend-like AI\nReset: .style reset`,
    });
    state.totalSent++;
    incrementStat("messages_sent");
    return true;
  }
  if (requested === "reset") {
    resetChatStyle(jid);
    state.aiStyles.delete(jid);
    await sock.sendMessage(jid, {
      text: "✅ AI style reset to default.",
    });
    state.totalSent++;
    incrementStat("messages_sent");
    return true;
  }

  if (STYLES[requested]) {
    setChatStyle(jid, requested);
    state.aiStyles.set(jid, requested);
    await sock.sendMessage(jid, { text: `✅ AI style set to *${requested}*.` });
  } else {
    const customPrompt = (match[1] || "").trim();
    if (customPrompt.length > 500) {
      await sock.sendMessage(jid, { text: "❌ Custom style must be 500 characters or less." });
      state.totalSent++;
      incrementStat("messages_sent");
      return true;
    }
    setChatStyle(jid, "custom", customPrompt);
    state.aiStyles.set(jid, "custom");
    await sock.sendMessage(jid, {
      text: `✅ Custom AI style saved:\n${customPrompt}\n\nPresets: ${Object.keys(STYLES).join(", ")} | Reset: .style reset`,
    });
  }
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { STYLES, handleAiStyleCommand };

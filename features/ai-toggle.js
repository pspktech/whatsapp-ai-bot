// features/ai-toggle.js
const state = require("../state");
const { incrementStat } = require("../db");

// ---------- AI ON/OFF command (owner only) ----------
async function handleAiToggleCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".ai on" && lower !== ".ai off" && lower !== ".ai") {
    return false;
  }
  if (!sock) return true;

  if (lower === ".ai on") {
    state.aiEnabled = true;
    await sock.sendMessage(jid, { text: "✅ AI reply ON" });
  } else if (lower === ".ai off") {
    state.aiEnabled = false;
    await sock.sendMessage(jid, { text: "🔴 AI reply OFF" });
  } else {
    await sock.sendMessage(jid, {
      text: `AI status: *${state.aiEnabled ? "ON ✅" : "OFF 🔴"}*\n\nUsage: \`.ai on\` or \`.ai off\``,
    });
  }

  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

function isAiEnabled() {
  return state.aiEnabled !== false;
}

module.exports = { handleAiToggleCommand, isAiEnabled };

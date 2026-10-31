// features/feedback.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");

async function handleFeedbackCommand(sock, jid, text) {
  const match = text.trim().match(/^\.feedback\s+([\s\S]+)$/i);
  if (!match) {
    if (text.toLowerCase().trim() !== ".feedback") return false;
    await sock.sendMessage(jid, { text: "Usage: `.feedback your message`" });
    return true;
  }

  const target =
    env.FEEDBACK_TARGET_JID ||
    env.OWNER_JID ||
    env.WHATSAPP_TARGET_JID ||
    sock?.user?.id;
  if (!target) {
    await sock.sendMessage(jid, { text: "❌ Feedback target configure cheyyaledu." });
    return true;
  }

  const feedback = match[1].trim();
  await sock.sendMessage(target, {
    text: `📝 *New Feedback*\n\nFrom: ${jid}\n\n${feedback}`,
  });
  await sock.sendMessage(jid, { text: "✅ Feedback sent. Thank you!" });
  state.totalSent += 2;
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleFeedbackCommand };

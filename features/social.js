// features/social.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");

async function handleSocialCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".social" && lower !== ".socials") return false;

  const reply = [
    "🌐 *Madhu Patel — Social Links*",
    "",
    `🌍 Portfolio: ${env.OWNER_SITE}`,
    `🚀 Projects: ${env.PROJECTS_URL}`,
    `💻 GitHub: ${env.GITHUB_URL}`,
    `📱 Telegram: ${env.TELEGRAM_URL}`,
    env.INSTAGRAM_URL ? `📸 Instagram: ${env.INSTAGRAM_URL}` : "",
    env.YOUTUBE_URL ? `▶️ YouTube: ${env.YOUTUBE_URL}` : "",
  ].filter(Boolean).join("\n");

  await sock.sendMessage(jid, { text: reply });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleSocialCommand };

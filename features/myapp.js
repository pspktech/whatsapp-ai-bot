// features/myapp.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");

async function handleMyAppCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".app" && lower !== ".myapp") return false;

  const reply = [
    "📱 *Madhu Portfolio App*",
    "",
    "A personal portfolio Android app with project showcase, profile information and quick access to Madhu Patel's work.",
    "",
    "📦 Version: 1.1.0",
    "📁 File: madhuapp.apk",
    "💾 Size: 15.6 MB",
    "📱 Android: 7.0 or later",
    "🆔 Package: com.madhupatel.portfolio",
    "",
    `🔗 *App page:* ${env.APP_URL}`,
    `⬇️ *Download APK:* ${env.APP_URL}`,
    "",
    "Open the APK download link on Android and allow installation from this source if prompted.",
  ].join("\n");

  await sock.sendMessage(jid, { text: reply });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleMyAppCommand };

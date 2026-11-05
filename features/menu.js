// features/menu.js
const env = require("../config");
const { incrementStat } = require("../db");

const MENU_TEXT = [
  `🤖 *${env.OWNER_NAME || "WhatsApp AI Bot"} — Feature Menu*`,
  "",
  "💬 *AI & Chat*",
  "• `.ai` — AI status choodu",
  "• `.ai on/off` — AI replies enable/disable",
  "• `.style funny|professional|romantic|telugu|normal` — AI reply style change",
  "  Use: conversations ni mee preferred style lo maintain cheyyadaniki.",
  "",
  "📥 *Media Downloads*",
  "• `.yta <song>` — YouTube audio MP3 download",
  "• `.ytv <song> [quality]` — YouTube video download",
  "• Instagram / YouTube / X link send cheyyi — auto-download",
  "  Use: songs, reels and videos ni WhatsApp lo save/share cheyyadaniki.",
  "",
  "🎧 *Last.fm Music*",
  "• `.lfm` / `.lastfm` — latest 10 tracks choodu",
  "• New now-playing/scrobbled track — automatic WhatsApp notification",
  "  Use: Last.fm listening history and current music updates kosam.",
  "",
  "🛠️ *Utilities*",
  "• `.ping` — bot latency check",
  "• `.info` — uptime, sessions and message stats",
  "• `.owner` — owner details",
  "• `.projects` — projects with live/source links",
  "• `.app` — portfolio app and APK link",
  "• `.about` — profile and tagline",
  "• `.resume` — skills and resume links",
  "• `.social` — social media links",
  "• `.contact` — contact card/details",
  "",
  "🎲 *Fun & Protection*",
  "• `.truth` / `.dare` — Tenglish prompts",
  "• `.afk <reason>` — AFK auto-reply enable",
  "• `.afk off` — AFK mode disable",
  "• `.vv` — view-once media save/resend",
  "• Anti-delete cache — received deleted messages recover",
  "",
  "🌤️ *Productivity*",
  "• `/weather <city>` — current weather and forecast",
  "• `/remind <time> <text>` — reminder set cheyyi",
  "• `.tr <text> to <language>` — text translate cheyyi",
  "• `.note add/list/del` — personal notes manage cheyyi",
  "• `.feedback <message>` — feedback send cheyyi",
  "",
  `🌐 Portfolio: ${env.OWNER_SITE || "Not configured"}`,
  "💡 Commands exact ga type cheyyi. Menu kosam anytime `.menu` send cheyyi.",
].join("\n");

async function handleMenuCommand(sock, jid, text) {
  const command = text.toLowerCase().trim();
  if (command !== ".menu" && command !== ".help") return false;

  await sock.sendMessage(jid, { text: MENU_TEXT });
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleMenuCommand, MENU_TEXT };

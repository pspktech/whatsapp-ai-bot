// config.js
require("dotenv").config();

const env = {
  PORT: Number(process.env.PORT || 3000),
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  AI_MODEL: process.env.AI_MODEL || "openai/gpt-oss-120b",
  MAX_HISTORY: Number(process.env.MAX_HISTORY || 10),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "change-this-password",

  PARTNER_NAME: process.env.PARTNER_NAME || "Mummy",
  PARTNER_ALT: process.env.PARTNER_ALT || "Potti",
  OWNER_NAME: process.env.OWNER_NAME || "Madhu Patel",
  OWNER_SITE: process.env.OWNER_SITE || "https://madhupatel.is-a.dev",
  PROJECTS_URL:
    process.env.PROJECTS_URL || "https://madhupatel.is-a.dev/projects",
  APP_URL:
    process.env.APP_URL ||
    "https://appsenjoy.com/f/UsjJzrGkCs/madhu-portfolio-1-1-0",
  GITHUB_URL:
    process.env.GITHUB_URL || "https://github.com/pspktech/whatsapp-ai-bot",
  TELEGRAM_URL: process.env.TELEGRAM_URL || "https://t.me/madhupatelpspk",
  INSTAGRAM_URL: process.env.INSTAGRAM_URL || "",
  YOUTUBE_URL: process.env.YOUTUBE_URL || "",
  OWNER_PHONE: process.env.OWNER_PHONE || "",
  OWNER_JID: process.env.OWNER_JID || "",
  FEEDBACK_TARGET_JID: process.env.FEEDBACK_TARGET_JID || "",
  DAILY_TARGET_JID: process.env.DAILY_TARGET_JID || "",
  DAILY_AUTOMATION_ENABLED: process.env.DAILY_AUTOMATION_ENABLED !== "false",
  DAILY_HOUR: Number(process.env.DAILY_HOUR || 9),
  DAILY_MINUTE: Number(process.env.DAILY_MINUTE || 0),
  DAILY_MESSAGE: process.env.DAILY_MESSAGE || "",

  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN,
  SPOTIFY_POLL_INTERVAL: Number(process.env.SPOTIFY_POLL_INTERVAL || 10000),
  SPOTIFY_USER_NAME: process.env.SPOTIFY_USER_NAME || "Madhu",
  SPOTIFY_REDIRECT_URI:
    process.env.SPOTIFY_REDIRECT_URI ||
    "http://127.0.0.1:3000/spotify/callback",

  WHATSAPP_TARGET_JID: process.env.WHATSAPP_TARGET_JID,
  WHATSAPP_SESSIONS: process.env.WHATSAPP_SESSIONS || "main",
  WEATHER_CITY: process.env.WEATHER_CITY || "Hyderabad",
};

if (!env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in .env");
  process.exit(1);
}

module.exports = env;

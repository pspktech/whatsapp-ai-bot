// features/message-cache.js
// Privacy-safe scope: this can only recover messages the bot received and cached.
const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const state = require("../state");
const { incrementStat } = require("../db");

const DATA_DIR = path.join(__dirname, "..", "data");
const CACHE_PATH = path.join(DATA_DIR, "message-cache.json");
const MAX_CACHE = 500;

function unwrapMessage(message) {
  let current = message;
  while (current?.ephemeralMessage?.message || current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message || current?.viewOnceMessageV2Extension?.message) {
    current = current.ephemeralMessage?.message || current.viewOnceMessage?.message || current.viewOnceMessageV2?.message || current.viewOnceMessageV2Extension?.message;
  }
  return current || {};
}

function getText(message) {
  const content = unwrapMessage(message);
  return content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || content.documentMessage?.caption || "";
}

function getCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const entries = Object.entries(cache).slice(-MAX_CACHE);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(entries), null, 2));
}

function messageCacheKey(key) {
  return key?.remoteJid && key?.id ? `${key.remoteJid}:${key.id}` : null;
}

function cacheIncomingMessage(msg) {
  const key = messageCacheKey(msg?.key);
  if (!key || !msg?.message || msg.key?.remoteJid === "status@broadcast") return;
  const text = getText(msg.message);
  if (!text) return;
  const cache = getCache();
  cache[key] = {
    chat: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,
    text,
    receivedAt: Date.now(),
  };
  saveCache(cache);
}

function getRevokedKey(msg) {
  const content = msg?.message?.protocolMessage;
  if (!content || content.type !== 0) return null;
  return messageCacheKey(content.key);
}

async function handleDeletedMessage(sock, msg) {
  const key = getRevokedKey(msg);
  if (!key) return false;
  const cached = getCache()[key];
  if (!cached) return true;
  await sock.sendMessage(cached.chat, {
    text: `🛡️ *Anti-delete*\n\n${cached.sender}: ${cached.text}\n\n_(Recovered from bot cache)_`,
  });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

function getQuotedMessage(msg) {
  return msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function getMediaMessage(message) {
  const content = unwrapMessage(message);
  if (content.imageMessage) return { type: "image", data: content.imageMessage };
  if (content.videoMessage) return { type: "video", data: content.videoMessage };
  return null;
}

async function handleViewOnceCommand(sock, jid, msg, text) {
  const lower = text.toLowerCase().trim();
  if (![".vv", ".viewonce", ".saveviewonce", ".save"].includes(lower)) return false;
  const quoted = getQuotedMessage(msg);
  const media = getMediaMessage(quoted);
  if (!media) {
    await sock.sendMessage(jid, { text: "❌ View-once photo/video ni reply chesi `.vv` pampu." });
    return true;
  }
  const stream = await downloadContentFromMessage(media.data, media.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const payload = media.type === "image" ? { image: buffer } : { video: buffer };
  await sock.sendMessage(jid, { ...payload, caption: "✅ View-once media saved." });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = {
  cacheIncomingMessage,
  handleDeletedMessage,
  handleViewOnceCommand,
};

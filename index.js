// index.js — slim orchestrator
require("dotenv").config();
require("./logger");   // MUST be before any console usage

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const pino = require("pino");
const path = require("path");
const fs = require("fs");

const env = require("./config");
const state = require("./state");
const { DATA_DIR } = require("./db");
const { processMessage, enqueue } = require("./features/router");
const { startMusicPolling, stopMusicPolling } = require("./features/spotify");
const { startWeatherSchedule } = require("./features/weather");
const createApp = require("./features/admin");

// ======================================================
// WHATSAPP CONNECTION
// ======================================================

async function startBot() {
  if (state.isStarting) return;
  state.isStarting = true;

  try {
    const authDir = path.join(DATA_DIR, "auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);

    state.sock = makeWASocket({
      auth: authState,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
    });

    state.sock.ev.on("creds.update", saveCreds);

    state.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 Scan this QR in WhatsApp:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        state.isConnected = true;
        state.isStarting = false;
        console.log("✅ WhatsApp connected");

        startMusicPolling();
        if (env.WHATSAPP_TARGET_JID) {
          startWeatherSchedule(env.WHATSAPP_TARGET_JID);
        }
      }

      if (connection === "close") {
        state.isConnected = false;
        state.isStarting = false;
        stopMusicPolling();

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          console.log("🚪 Logged out. Delete ./data/auth and restart.");
          return;
        }

        console.log("🔁 Reconnecting in 3s...");
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = setTimeout(startBot, 3000);
      }
    });

    state.sock.ev.on("messages.upsert", async (event) => {
      const { messages, type } = event;
      if (type !== "notify") return;
      for (const msg of messages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        enqueue(jid, () => processMessage(msg));
      }
    });
  } catch (err) {
    state.isStarting = false;
    console.error("startBot error:", err);
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(startBot, 5000);
  }
}

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = createApp();
app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`🌐 Admin: http://127.0.0.1:${env.PORT}/admin`);
});

// ======================================================
// BOOT
// ======================================================

startBot();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

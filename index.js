// index.js — slim orchestrator with multi-session support
require("dotenv").config();
require("./logger"); // MUST be before any console usage

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
const { startWeatherSchedule } = require("./features/weather");
const { startDailyAutomation, stopDailyAutomation } = require("./features/daily");
const { startLastfmPolling, stopLastfmPolling } = require("./features/lastfm");
const createApp = require("./features/admin");

// ======================================================
// SESSIONS LIST
// ======================================================

const SESSIONS = (env.WHATSAPP_SESSIONS || "main")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ======================================================
// WHATSAPP CONNECTION (per session)
// ======================================================

async function startSession(sessionName) {
  try {
    const authDir = path.join(DATA_DIR, "sessions", sessionName, "auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);

    const sessionSock = makeWASocket({
      auth: authState,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
      markOnlineOnConnect: false, // 👈 Online status hide chestundi
    });

    if (!state.sockets) state.sockets = new Map();
    state.sockets.set(sessionName, sessionSock);

    // First session = primary (music + weather)
    if (!state.primarySession) state.primarySession = sessionName;
    if (sessionName === state.primarySession) {
      state.sock = sessionSock;
    }

    sessionSock.ev.on("creds.update", saveCreds);

    // ======================================================
    // PAIRING CODE LOGIC (Cloud kosam)
    // ======================================================
    let pairingCodeRequested = false; // Oka sari ne code adagadaniki

    sessionSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR leda Pairing Code Logic
      if (qr) {
        const pairingNumber = env.PAIRING_NUMBER || process.env.PAIRING_NUMBER;

        if (pairingNumber && !pairingCodeRequested) {
          pairingCodeRequested = true;
          try {
            let code = await sessionSock.requestPairingCode(pairingNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code; // Format: XXXX-XXXX
            console.log(`\n🔑 [${sessionName}] Pairing Code: \x1b[32m${code}\x1b[0m`);
            console.log(`📱 WhatsApp -> Linked Devices -> Link with phone number instead -> Enter code.\n`);
          } catch (err) {
            console.error(`[${sessionName}] Pairing code error:`, err.message);
            pairingCodeRequested = false;
          }
        } else if (!pairingNumber) {
          // Pairing number lekapothe QR print avutundi (Local kosam)
          console.log(`\n📱 [${sessionName}] Scan QR:`);
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === "open") {
        console.log(`✅ [${sessionName}] WhatsApp connected`);

        // 👇 Force Offline (Online kanipinchakunda)
        try {
          await sessionSock.sendPresenceUpdate("unavailable");
        } catch (e) {}

        // 👇 Dashboard Status Fix (Edaina okka session open unte chalu)
        if (!state.sessionStatus) state.sessionStatus = new Map();
        state.sessionStatus.set(sessionName, true);
        state.isConnected = Array.from(state.sessionStatus.values()).some(v => v === true);

        // Weather + daily automation only for primary session.
        if (sessionName === state.primarySession) {
          state.isStarting = false;

          if (env.WHATSAPP_TARGET_JID) {
            try {
              startWeatherSchedule(sessionSock, env.WHATSAPP_TARGET_JID);
            } catch (e) {
              console.error("Weather schedule error:", e.message);
            }
          }
          startDailyAutomation(sessionSock);
        }

        // Last.fm can use any connected session when the primary session is logged out.
        startLastfmPolling(sessionSock);
      }

      if (connection === "close") {
        console.log(`⚠️  [${sessionName}] Disconnected`);

        // 👇 Dashboard Status Fix (Anni close aithe offline avvali)
        if (!state.sessionStatus) state.sessionStatus = new Map();
        state.sessionStatus.set(sessionName, false);
        state.isConnected = Array.from(state.sessionStatus.values()).some(v => v === true);

        if (sessionName === state.primarySession) {
          state.isStarting = false;
          try {
            stopDailyAutomation();
          } catch (e) {}
        }

        if (!state.isConnected) {
          try {
            stopLastfmPolling();
          } catch (e) {}
        }

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          console.log(
            `🚪 [${sessionName}] Logged out. Delete data/sessions/${sessionName} and restart.`
          );
          return;
        }

        console.log(`🔁 [${sessionName}] Reconnecting in 3s...`);
        setTimeout(() => startSession(sessionName), 3000);
      }
    });

    sessionSock.ev.on("messages.upsert", async (event) => {
      const { messages, type } = event;
      console.log(`📨 [${sessionName}] messages.upsert type=${type} count=${messages?.length || 0}`);
      if (!["notify", "append"].includes(type)) return;

      for (const msg of messages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;

        const messageTypes = Object.keys(msg.message || {}).join(",") || "no-message";
        console.log(
          `📨 [${sessionName}] received ${jid}${msg.key?.fromMe ? " [fromMe]" : ""} type=${messageTypes}`
        );

        enqueue(`${sessionName}:${jid}`, () =>
          processMessage(msg, sessionSock, sessionName)
        );
      }
    });

    return sessionSock;
  } catch (err) {
    console.error(`[${sessionName}] startSession error:`, err);
    setTimeout(() => startSession(sessionName), 5000);
  }
}

// ======================================================
// START ALL SESSIONS
// ======================================================

async function startBot() {
  if (state.isStarting) return;
  state.isStarting = true;

  state.primarySession = SESSIONS[0];
  state.sockets = state.sockets || new Map();
  state.sessionStatus = state.sessionStatus || new Map();

  console.log(
    `🚀 Starting ${SESSIONS.length} session(s): ${SESSIONS.join(", ")}`
  );

  for (const sessionName of SESSIONS) {
    console.log(`▶️  Starting session: ${sessionName}`);
    await startSession(sessionName);
    // Gap between sessions (QR print avvadaniki)
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("✅ All sessions initialized\n");
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

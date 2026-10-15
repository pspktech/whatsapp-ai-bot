require("dotenv").config();

const util = require("util");

// ======================================================
// SUPPRESS NOISY LIBSIGNAL / BAILEYS LOGS
// ======================================================

const NOISE_PATTERNS = [
  "Failed to decrypt",
  "Bad MAC",
  "Session error",
  "MessageCounterError",
  "libsignal",
  "session_cipher",
  "sessioncipher",
  "queue_job",
  "Decrypted message with closed session",
  "Closing session:",
  "closing session:",
  "Removing old closed session",
  "removing old closed session",
  "SessionEntry",
  "sessionentry",
  "_chains:",
  "registrationId:",
  "currentRatchet:",
  "ephemeralKeyPair:",
  "lastRemoteEphemeralKey:",
  "indexInfo:",
  "pendingPreKey:",
  "rootKey:",
  "baseKey:",
  "remoteIdentityKey:",
  "pubKey: <Buffer",
  "privKey: <Buffer",
  "signedKeyId:",
  "preKeyId:",
  "previousCounter:",
  "chainKey:",
  "chainType:",
  "messageKeys:",
  "baseKeyType:",
];

function isNoise(args) {
  try {
    const full = args
      .map((a) => {
        if (a == null) return "";
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.message || "";
        if (Buffer.isBuffer(a)) return "";
        if (typeof a === "object") {
          const ctor = a.constructor?.name || "";
          if (
            ctor.includes("Session") ||
            ctor.includes("Entry") ||
            ctor.includes("Cipher") ||
            ctor.includes("Ratchet")
          ) {
            return "SessionEntry";
          }
          if (
            a._chains ||
            a.registrationId ||
            a.currentRatchet ||
            a.indexInfo ||
            a.pendingPreKey
          ) {
            return "SessionEntry";
          }
        }
        try {
          return util.inspect(a, { depth: 0, breakLength: Infinity });
        } catch {
          return "";
        }
      })
      .join(" ")
      .toLowerCase();

    return NOISE_PATTERNS.some((p) => full.includes(p.toLowerCase()));
  } catch {
    return false;
  }
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (isNoise(args)) return;
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (isNoise(args)) return;
  originalConsoleWarn(...args);
};

const originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
  if (isNoise(args)) return;
  originalConsoleLog(...args);
};

// ======================================================
// IMPORTS
// ======================================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const pino = require("pino");
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ======================================================
// CONFIG
// ======================================================

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------- MULTIPLE SESSIONS ----------
const WHATSAPP_SESSIONS = (
  process.env.WHATSAPP_SESSIONS || "main"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Per-session target JID (music updates)
// Format in .env: SESSION_TARGET_main=91xxx@s.whatsapp.net
function getSessionTarget(sessionName) {
  const key = `SESSION_TARGET_${sessionName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[key] || process.env.WHATSAPP_TARGET_JID || null;
}

// ======================================================
// DATABASE (shared)
// ======================================================

const Database = require("better-sqlite3");
const db = new Database(path.join(DATA_DIR, "assistant.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT NOT NULL,
    session TEXT NOT NULL DEFAULT 'main',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
`);

try {
  db.exec(`ALTER TABLE messages ADD COLUMN session TEXT NOT NULL DEFAULT 'main'`);
} catch (e) {
  // column already exists
}

const insertMessage = db.prepare(`
  INSERT INTO messages (jid, session, role, content, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const getHistory = db.prepare(`
  SELECT role, content FROM messages
  WHERE jid = ? AND session = ?
  ORDER BY id DESC LIMIT ?
`);

function incrementStat(key) {
  db.prepare(`
    INSERT INTO stats(key, value) VALUES (?, 1)
    ON CONFLICT(key) DO UPDATE SET value = value + 1
  `).run(key);
}

function getStat(key) {
  const row = db.prepare("SELECT value FROM stats WHERE key = ?").get(key);
  return row ? row.value : 0;
}

// ======================================================
// FEATURE MODULES (graceful load)
// ======================================================

let features = {
  ai: null,
  media: null,
  weather: null,
  spotify: null,
  reminder: null,
};

try {
  features.ai = require("./features/ai");
} catch (e) {
  console.warn("⚠️  features/ai.js not loaded:", e.message);
}

try {
  features.media = require("./features/media");
} catch (e) {
  console.warn("⚠️  features/media.js not loaded:", e.message);
}

try {
  features.weather = require("./features/weather");
} catch (e) {
  console.warn("⚠️  features/weather.js not loaded:", e.message);
}

try {
  features.spotify = require("./features/spotify");
} catch (e) {
  console.warn("⚠️  features/spotify.js not loaded:", e.message);
}

try {
  features.reminder = require("./features/reminder");
} catch (e) {
  console.warn("⚠️  features/reminder.js not loaded:", e.message);
}

// ======================================================
// STATE
// ======================================================

const sockets = new Map();
const startedAt = Date.now();
let isConnected = false;

const queues = new Map();

function enqueue(key, task) {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    });
  queues.set(key, next);
  return next;
}

// ======================================================
// TEXT EXTRACTION
// ======================================================

function extractMessageText(message) {
  if (!message) return "";
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.ephemeralMessage?.message)
    return extractMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message)
    return extractMessageText(message.viewOnceMessage.message);
  return "";
}


// ======================================================
// MESSAGE PROCESSING
// ======================================================

async function processMessage(msg, sessionSock, sessionName) {
  try {
    if (!msg?.message) return;
    if (msg.key?.fromMe) return;

    const jid = msg.key?.remoteJid;
    if (!jid) return;

    if (jid.endsWith("@g.us") || jid === "status@broadcast") return;

    const text = extractMessageText(msg.message).trim();
    if (!text) return;

    console.log(`📩 [${sessionName}] ${jid} | ${text}`);

    incrementStat("messages_received");

    // Self-chat skip
    const selfTarget = getSessionTarget(sessionName);
    if (selfTarget && jid === selfTarget) return;

    // ---------- Manual song command ----------
    const lowerText = text.toLowerCase().trim();
    if (lowerText.startsWith("song ")) {
      const songName = text.slice(5).trim();
      if (songName) {
        await sessionSock.sendPresenceUpdate("composing", jid);
        const reply = `🎧 Ippudu vintunna:\n\n🎵 *${songName}*`;
        await sessionSock.sendMessage(jid, { text: reply });

        insertMessage.run(jid, sessionName, "user", text, Date.now());
        insertMessage.run(jid, sessionName, "assistant", reply, Date.now());

        incrementStat("messages_sent");
        incrementStat("spotify_updates");
        return;
      }
    }

    // ---------- Media download ----------
    const urlMatch = text.match(
      /https?:\/\/(?:www\.)?(youtube\.com|youtu\.be|instagram\.com|x\.com|twitter\.com|open\.spotify\.com)\/[^\s]+/i
    );

    if (urlMatch) {
      const url = urlMatch[0].replace(/[),.!?]+$/, "");
      const isAudio = /open\.spotify\.com\/(track|album|playlist)\//i.test(url);

      try {
        if (!features.media) throw new Error("media module not loaded");
        await sessionSock.sendPresenceUpdate("composing", jid);

        if (isAudio && features.media.downloadAudio) {
          const media = await features.media.downloadAudio(url);
          if (media?.filePath) {
            await sessionSock.sendMessage(jid, {
              audio: { url: media.filePath },
              mimetype: "audio/mpeg",
              ptt: false,
            });
            incrementStat("audio_sent");
            incrementStat("media_sent");
            if (media.tempDir) {
              fs.rmSync(media.tempDir, { recursive: true, force: true });
            }
            return;
          }
        }

        if (features.media.downloadMedia) {
          const media = await features.media.downloadMedia(url);
          if (media?.filePath) {
            await sessionSock.sendMessage(jid, {
              video: { url: media.filePath },
              caption: "Downloaded media",
            });
            incrementStat("media_sent");
            if (media.tempDir) {
              fs.rmSync(media.tempDir, { recursive: true, force: true });
            }
            return;
          }
        }
      } catch (err) {
        console.error("❌ Media error:", err?.message || err);
        incrementStat("errors");
        await sessionSock.sendMessage(jid, {
          text: "Sorry ra, aa media download cheyyalekapoya 😕",
        });
        return;
      }
    }

    // ---------- AI reply ----------
    let reply = null;

    if (features.ai) {
      try {
        if (typeof features.ai.generateReply === "function") {
          reply = await features.ai.generateReply(sessionName, jid, text);
        } else if (typeof features.ai.getAIReply === "function") {
          reply = await features.ai.getAIReply(sessionName, jid, text);
        } else if (typeof features.ai.chat === "function") {
          reply = await features.ai.chat(sessionName, jid, text);
        }
      } catch (err) {
        console.error("❌ AI error:", err?.message || err);
      }
    }

    if (!reply) {
      reply = "Hmm... cheppu 🥺";
    }

    await sessionSock.sendPresenceUpdate("composing", jid);
    const delay = Math.min(1800, Math.max(500, reply.length * 18));
    await new Promise((r) => setTimeout(r, delay));

    await sessionSock.sendMessage(jid, { text: reply });

    insertMessage.run(jid, sessionName, "user", text, Date.now());
    insertMessage.run(jid, sessionName, "assistant", reply, Date.now());

    incrementStat("ai_replies");
    incrementStat("messages_sent");
  } catch (error) {
    incrementStat("errors");
    console.error(`[${sessionName}] Message error:`, error.message);
  }
}

// ======================================================
// SPOTIFY MUSIC POLLING (per session)
// ======================================================

const spotifyPollTimers = new Map();
const lastSpotifyTrackId = new Map();

function formatTrackMessage(track) {
  let msg = `🎧 Ippudu vintunna:\n\n`;
  msg += `🎵 *${track.name}*\n`;
  msg += `🎤 ${track.artists}\n`;
  if (track.album) msg += `💿 ${track.album}`;
  return msg;
}

async function startMusicPollingForSession(sessionSock, sessionName) {
  const target = getSessionTarget(sessionName);
  if (!target) {
    console.log(`ℹ️  [${sessionName}] Music polling skipped (no target JID)`);
    return;
  }

  if (!features.spotify) {
    console.log(`ℹ️  [${sessionName}] Music polling skipped (no spotify module)`);
    return;
  }

  const pollInterval = Number(process.env.SPOTIFY_POLL_INTERVAL || 10000);

  // Clear existing timer for this session
  if (spotifyPollTimers.has(sessionName)) {
    clearInterval(spotifyPollTimers.get(sessionName));
  }

  console.log(
    `🎧 [${sessionName}] Spotify polling started (every ${pollInterval / 1000}s) → ${target}`
  );

  const timer = setInterval(async () => {
    try {
      if (!sessionSock) return;

      let track = null;
      if (typeof features.spotify.getCurrentlyPlaying === "function") {
        track = await features.spotify.getCurrentlyPlaying(sessionName);
      } else if (typeof features.spotify.getNowPlaying === "function") {
        track = await features.spotify.getNowPlaying(sessionName);
      }

      if (!track || !track.isPlaying) return;

      const prevTrack = lastSpotifyTrackId.get(sessionName);
      if (track.id === prevTrack) return;

      lastSpotifyTrackId.set(sessionName, track.id);

      await sessionSock.sendMessage(target, {
        text: formatTrackMessage(track),
      });

      incrementStat("spotify_updates");
      console.log(`🎵 [${sessionName}] Music sent: ${track.name}`);
    } catch (err) {
      console.error(`[${sessionName}] Music poll error:`, err.message);
    }
  }, pollInterval);

  spotifyPollTimers.set(sessionName, timer);
}


// ======================================================
// WHATSAPP SESSION
// ======================================================

async function startSession(sessionName) {
  try {
    const authDir = path.join(DATA_DIR, "sessions", sessionName, "auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sessionSock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
    });

    sockets.set(sessionName, sessionSock);

    sessionSock.ev.on("creds.update", saveCreds);

    sessionSock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`\n📱 [${sessionName}] Scan QR:`);
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        isConnected = true;
        console.log(`✅ [${sessionName}] WhatsApp connected`);
        startMusicPollingForSession(sessionSock, sessionName);
      }

      if (connection === "close") {
        console.log(`⚠️  [${sessionName}] Disconnected`);

        if (spotifyPollTimers.has(sessionName)) {
          clearInterval(spotifyPollTimers.get(sessionName));
          spotifyPollTimers.delete(sessionName);
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
      if (type !== "notify") return;

      for (const msg of messages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
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

async function startBot() {
  console.log(
    `🚀 Starting ${WHATSAPP_SESSIONS.length} session(s): ${WHATSAPP_SESSIONS.join(", ")}`
  );
  for (const sessionName of WHATSAPP_SESSIONS) {
    await startSession(sessionName);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  const sessions = Array.from(sockets.keys()).join(", ");
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>WhatsApp AI Bot</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:Arial;background:#111;color:white;padding:30px;}
      .box{max-width:500px;margin:auto;padding:25px;background:#1d1d1d;border-radius:15px;}
      a{color:#4ade80;}
    </style>
    </head>
    <body>
      <div class="box">
        <h2>WhatsApp AI Bot</h2>
        <p>Status: <strong>${isConnected ? "ONLINE" : "OFFLINE"}</strong></p>
        <p>Sessions: <strong>${sessions || "none"}</strong></p>
        <p><a href="/admin">Admin Dashboard</a></p>
      </div>
    </body>
    </html>
  `);
});

app.get("/admin", (req, res) => {
  res.send(`
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:white;font-family:Arial;}
.card{width:90%;max-width:380px;background:#181b21;padding:25px;border-radius:18px;box-sizing:border-box;}
input{width:100%;box-sizing:border-box;padding:13px;margin:10px 0;border:0;border-radius:10px;background:#252932;color:white;}
button{width:100%;padding:13px;border:0;border-radius:10px;background:#25d366;color:#061006;font-weight:bold;}
</style></head><body>
<div class="card">
<h2>Admin Dashboard</h2>
<input id="password" type="password" placeholder="Admin password"/>
<button onclick="login()">Login</button>
<p id="error"></p>
</div>
<script>
async function login(){
  const password=document.getElementById("password").value;
  const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
  const d=await r.json();
  if(d.success){localStorage.setItem("admin_token",d.token);location.href="/dashboard";}
  else{document.getElementById("error").innerText="Wrong password";}
}
</script></body></html>
  `);
});

const adminTokens = new Set();

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false });
  }
  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.add(token);
  res.json({ success: true, token });
});

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/api/admin/stats", adminAuth, (req, res) => {
  const messages = db.prepare("SELECT COUNT(*) AS count FROM messages").get();
  const uniqueChats = db
    .prepare("SELECT COUNT(DISTINCT jid) AS count FROM messages")
    .get();

  res.json({
    online: isConnected,
    sessions: Array.from(sockets.keys()),
    uptime: Date.now() - startedAt,
    received: getStat("messages_received"),
    sent: getStat("messages_sent"),
    aiReplies: getStat("ai_replies"),
    mediaSent: getStat("media_sent"),
    audioSent: getStat("audio_sent"),
    spotifyUpdates: getStat("spotify_updates"),
    errors: getStat("errors"),
    totalDatabaseMessages: messages.count,
    activeChats: uniqueChats.count,
  });
});

app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Bot Dashboard</title>
<style>
*{box-sizing:border-box;}
body{margin:0;background:#0f1115;color:white;font-family:Arial;}
header{padding:20px;background:#181b21;border-bottom:1px solid #292d35;}
.container{max-width:900px;margin:auto;padding:20px;}
.status{padding:15px;border-radius:12px;margin-bottom:20px;background:#181b21;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;}
.card{background:#181b21;padding:20px;border-radius:15px;}
.number{font-size:30px;font-weight:bold;margin-top:10px;}
.online{color:#4ade80;}.offline{color:#f87171;}
button{margin-top:20px;padding:12px 20px;border:0;border-radius:10px;cursor:pointer;}
.logout{background:#f87171;color:#111;margin-left:8px;}
</style></head><body>
<header><h2>WhatsApp AI Admin</h2></header>
<div class="container">
<div class="status">Bot Status: <strong id="status">...</strong></div>
<div class="status">Sessions: <strong id="sessions">-</strong></div>
<div class="grid">
<div class="card">Messages Received<div class="number" id="received">0</div></div>
<div class="card">Messages Sent<div class="number" id="sent">0</div></div>
<div class="card">AI Replies<div class="number" id="aiReplies">0</div></div>
<div class="card">Active Chats<div class="number" id="activeChats">0</div></div>
<div class="card">Media Sent<div class="number" id="mediaSent">0</div></div>
<div class="card">Audio Sent<div class="number" id="audioSent">0</div></div>
<div class="card">Music Updates<div class="number" id="spotifyUpdates">0</div></div>
<div class="card">Errors<div class="number" id="errors">0</div></div>
<div class="card">DB Messages<div class="number" id="database">0</div></div>
</div>
<button onclick="loadStats()">Refresh</button>
<button class="logout" onclick="logout()">Logout</button>
</div>
<script>
async function loadStats(){
  const t=localStorage.getItem("admin_token");
  if(!t){location.href="/admin";return;}
  const r=await fetch("/api/admin/stats",{headers:{Authorization:"Bearer "+t}});
  if(!r.ok){localStorage.removeItem("admin_token");location.href="/admin";return;}
  const d=await r.json();
  const s=document.getElementById("status");
  s.innerText=d.online?"ONLINE":"OFFLINE";
  s.className=d.online?"online":"offline";
  document.getElementById("sessions").innerText=(d.sessions||[]).join(", ")||"none";
  document.getElementById("received").innerText=d.received;
  document.getElementById("sent").innerText=d.sent;
  document.getElementById("aiReplies").innerText=d.aiReplies;
  document.getElementById("mediaSent").innerText=d.mediaSent;
  document.getElementById("audioSent").innerText=d.audioSent;
  document.getElementById("spotifyUpdates").innerText=d.spotifyUpdates;
  document.getElementById("errors").innerText=d.errors;
  document.getElementById("database").innerText=d.totalDatabaseMessages;
  document.getElementById("activeChats").innerText=d.activeChats;
}
function logout(){localStorage.removeItem("admin_token");location.href="/admin";}
loadStats();setInterval(loadStats,5000);
</script></body></html>
  `);
});

// ======================================================
// BOOT
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Admin: http://127.0.0.1:${PORT}/admin`);
});

startBot();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});



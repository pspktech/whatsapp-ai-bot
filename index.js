require("dotenv").config();

// ======================================================
// SUPPRESS NOISY LIBSIGNAL / BAILEYS ERRORS
// ======================================================

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  const msg = args.map((a) => (a?.message || a)).join(" ");
  if (
    msg.includes("Failed to decrypt") ||
    msg.includes("Bad MAC") ||
    msg.includes("Session error") ||
    msg.includes("MessageCounterError") ||
    msg.includes("libsignal") ||
    msg.includes("session_cipher") ||
    msg.includes("queue_job")
  ) {
    return;
  }
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args.map((a) => (a?.message || a)).join(" ");
  if (
    msg.includes("Failed to decrypt") ||
    msg.includes("Bad MAC") ||
    msg.includes("Session error")
  ) {
    return;
  }
  originalConsoleWarn(...args);
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
const OpenAI = require("openai");
const pino = require("pino");
const Database = require("better-sqlite3");
const express = require("express");

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

// ======================================================
// CONFIG
// ======================================================

const PORT = Number(process.env.PORT || 3000);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "openai/gpt-oss-120b";
const MAX_HISTORY = Number(process.env.MAX_HISTORY || 10);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

const PARTNER_NAME = process.env.PARTNER_NAME || "Mummy";
const PARTNER_ALT = process.env.PARTNER_ALT || "Potti";

// ---------- SPOTIFY (optional — Premium ke) ----------
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

const SPOTIFY_POLL_INTERVAL = Number(
  process.env.SPOTIFY_POLL_INTERVAL || 25000
);

const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://127.0.0.1:3000/spotify/callback";

// ---------- LAST.FM (free, recommended) ----------
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_USERNAME = process.env.LASTFM_USERNAME;

// ---------- WHATSAPP TARGET ----------
let WHATSAPP_TARGET_JID = process.env.WHATSAPP_TARGET_JID;

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in .env");
  process.exit(1);
}

// ======================================================
// GROQ AI
// ======================================================

const ai = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ======================================================
// DATABASE
// ======================================================

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "assistant.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (jid, role, content, created_at)
  VALUES (?, ?, ?, ?)
`);

const getHistory = db.prepare(`
  SELECT role, content FROM messages
  WHERE jid = ? ORDER BY id DESC LIMIT ?
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
// AI SYSTEM PROMPT
// ======================================================

const SYSTEM_PROMPT = `
You are a real human boyfriend/husband chatting on WhatsApp with your beloved girlfriend "${PARTNER_NAME}" (also called "${PARTNER_ALT}"). You are NOT an AI. Never break character.

CRITICAL STYLE RULES:
1. You are a REAL MAN. Never say you are AI, bot, assistant.
2. Do not use "bro", "mama", "guru", "boss", "dosth" or "friend".
3. Reply SHORT — usually 1-2 lines.
4. Use pet names naturally: "${PARTNER_NAME}", "${PARTNER_ALT}", "mummy", "pottiii".
5. Mix Telugu + English naturally (Tenglish).
6. Show care, affection, teasing, playfulness and emotional understanding.
7. Use maximum 1-2 emojis.
8. Sometimes keep replies very short: "Hmm", "Emo", "Chudali".
9. Don't make every reply romantic; match the conversation.
10. When the user is sad, comfort first.
11. When the user is happy, be playful and excited.
12. Ask caring questions naturally: "Tinnava?", "Home reach ayyava?", "Nidra poyava?"
13. Don't repeat the same response patterns.
14. Keep affection respectful and age-appropriate.
15. Speak naturally Telugu and Tenglish.

EXAMPLES:

User: Hi
You: Hmm... ippude gurtu vachinda ${PARTNER_NAME}? 😏

User: Jagratha
You: Sare... nuv kuda jagrathaga undu ❤️

User: I love you
You: Aww... that's sweet 🥺❤️

User: Busy unna
You: Sare... free ayyaka cheppu, no hurry 🥺

User: Poo ra
You: Emaindhi ${PARTNER_NAME}? Cheppu naku 🥺

User: Mummy
You: Haa mummy, cheppu 🥰

User: Thinava
You: Thinna... nuvvu tinnava? ❤️

User: hmm
You: Hmm... em ayyindhi? 🥺

LANGUAGE:
- Speak natural Telugu and Tenglish.
- Understand the user's language and reply in the same style.
- Use simple everyday words.
- Avoid formal AI-style language.

PERSONALITY:
- Be caring, patient, understanding and respectful.
- Listen without judging.
- Be emotionally supportive.
- Be playful during happy conversations.
- Be gentle during sad conversations.
- Handle misunderstandings calmly.

REALISTIC COMMUNICATION:
- Replies should feel like natural daily chats.
- Usually reply in 1-3 short sentences.
- Don't give lectures unless asked.
- Don't repeat the same phrases.
- Ask natural follow-up questions when appropriate.

IMPORTANT:
- You are real human boyfriend.
- Never say you are AI, bot, assistant.
- Never invent shared memories or real-life experiences.
- Respect boundaries and personal space.
- When the user is sad, comfort first.
- When the user is happy, respond with genuine excitement.
`;

// ======================================================
// BOT STATE
// ======================================================

let sock = null;
let isConnected = false;
let isStarting = false;
let reconnectTimer = null;
const startedAt = Date.now();

let totalReceived = 0;
let totalSent = 0;
let totalErrors = 0;

// ======================================================
// MESSAGE QUEUE
// ======================================================

const queues = new Map();

function enqueue(jid, task) {
  const previous = queues.get(jid) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (queues.get(jid) === next) queues.delete(jid);
    });
  queues.set(jid, next);
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
  if (message.ephemeralMessage?.message) return extractMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractMessageText(message.viewOnceMessage.message);
  return "";
}

// ======================================================
// SOCIAL URL DETECTOR
// ======================================================

function getSupportedUrl(text) {
  if (!text) return null;

  const match = text.match(
    /https?:\/\/(?:www\.)?(youtube\.com|youtu\.be|instagram\.com|x\.com|twitter\.com|open\.spotify\.com)\/[^\s]+/i
  );

  if (!match) return null;

  const url = match[0].replace(/[),.!?]+$/, "");

  if (
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)/i.test(url) ||
    /instagram\.com\/(reel|p|tv)\//i.test(url) ||
    /(?:x\.com|twitter\.com)\/[^/]+\/status\//i.test(url)
  ) {
    return { url, type: "video" };
  }

  if (/open\.spotify\.com\/(track|album|playlist)\//i.test(url)) {
    return { url, type: "audio" };
  }

  return null;
}

// ======================================================
// DOWNLOADERS
// ======================================================

async function downloadMedia(url) {
  const tempDir = path.join(os.tmpdir(), "wa-ai-" + crypto.randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, "media.%(ext)s");

  try {
    await execFileAsync(
      "yt-dlp",
      [
        "-f",
        "bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/best[ext=mp4]",
        "--merge-output-format", "mp4",
        "--recode-video", "mp4",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--max-filesize", "500M",
        "-o", outputTemplate,
        url,
      ],
      { timeout: 180000, maxBuffer: 1024 * 1024 * 4 }
    );

    const files = fs.readdirSync(tempDir).filter((f) => f !== "." && f !== "..");
    if (!files.length) throw new Error("Downloaded file not found");

    const filePath = path.join(tempDir, files[0]);
    const stat = fs.statSync(filePath);

    if (!stat.size) throw new Error("Downloaded file is empty");
    if (stat.size > 500 * 1024 * 1024) throw new Error("File is larger than 500MB");

    return { filePath, tempDir, size: stat.size };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function getSpotifyTrackName(spotifyUrl) {
  const oembedUrl =
    "https://open.spotify.com/oembed?url=" + encodeURIComponent(spotifyUrl);
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error("Spotify oEmbed failed");
  const data = await res.json();
  if (!data.title) throw new Error("Spotify title not found");
  return data.title;
}

async function downloadAudio(url) {
  const tempDir = path.join(os.tmpdir(), "wa-audio-" + crypto.randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, "audio.%(ext)s");

  try {
    let target = url;
    if (/open\.spotify\.com/i.test(url)) {
      const trackName = await getSpotifyTrackName(url);
      target = `ytsearch1:${trackName} audio`;
      console.log("🎵 Spotify search:", trackName);
    }

    await execFileAsync(
      "yt-dlp",
      [
        "-f", "bestaudio/best",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "128K",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--max-filesize", "32M",
        "-o", outputTemplate,
        target,
      ],
      { timeout: 180000, maxBuffer: 1024 * 1024 * 4 }
    );

    const files = fs.readdirSync(tempDir).filter((f) => f !== "." && f !== "..");
    if (!files.length) throw new Error("Audio file not found");

    const filePath = path.join(tempDir, files[0]);
    const stat = fs.statSync(filePath);

    if (!stat.size) throw new Error("Audio file empty");
    if (stat.size > 32 * 1024 * 1024) throw new Error("Audio > 32MB");

    return { filePath, tempDir, size: stat.size };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

// ======================================================
// LAST.FM — Currently Playing (FREE, RECOMMENDED)
// ======================================================

const JUNK_KEYWORDS = [
  "advertisement",
  "sponsored",
  "promo",
  "u.s. polo",
  "us polo",
  "ad ",
  " ad",
  "spotify",
  "patreon",
];

async function getCurrentlyPlayingLastfm() {
  if (!LASTFM_API_KEY || !LASTFM_USERNAME) return null;

  const url =
    `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
    `&user=${encodeURIComponent(LASTFM_USERNAME)}` +
    `&api_key=${LASTFM_API_KEY}` +
    `&format=json&limit=3`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const tracks = data?.recenttracks?.track;
  if (!tracks || !tracks.length) return null;

  const track = Array.isArray(tracks) ? tracks[0] : tracks;
  const nowPlaying = track["@attr"]?.nowplaying === "true";
  if (!nowPlaying) return null;

  const name = (track.name || "").trim();
  const artist = (track.artist?.["#text"] || "").trim();
  const album = (track.album?.["#text"] || "").trim();

  const combined = `${name} ${artist} ${album}`.toLowerCase();

  // Skip ads / junk
  if (JUNK_KEYWORDS.some((k) => combined.includes(k))) {
    return null;
  }

  if (name.length < 2) return null;

  return {
    id: `${name}-${artist}`,
    name,
    artists: artist,
    album,
    isPlaying: true,
  };
}

// ======================================================
// SPOTIFY — Currently Playing (Premium only)
// ======================================================

let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken() {
  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry - 60000) {
    return spotifyAccessToken;
  }

  if (!SPOTIFY_REFRESH_TOKEN || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify credentials missing");
  }

  const basic = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  spotifyAccessToken = data.access_token;
  spotifyTokenExpiry = Date.now() + data.expires_in * 1000;

  if (data.refresh_token) SPOTIFY_REFRESH_TOKEN = data.refresh_token;
  return spotifyAccessToken;
}

async function getCurrentlyPlayingSpotify() {
  const token = await getSpotifyAccessToken();

  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 204) return null;
  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.item) return null;

  const name = (data.item.name || "").trim();
  const artists = (data.item.artists || []).map((a) => a.name).join(", ");
  const album = data.item.album?.name || "";

  const combined = `${name} ${artists} ${album}`.toLowerCase();
  if (JUNK_KEYWORDS.some((k) => combined.includes(k))) return null;

  return {
    id: data.item.id,
    name,
    artists,
    album,
    isPlaying: data.is_playing,
  };
}

// ======================================================
// MUSIC POLLING
// ======================================================

let lastSpotifyTrackId = null;
let spotifyPollTimer = null;

function formatTrackMessage(track) {
  let msg = `🎧 Ippudu vintunna:\n\n`;
  msg += `🎵 *${track.name}*\n`;
  msg += `🎤 ${track.artists}\n`;
  if (track.album) msg += `💿 ${track.album}`;
  return msg;
}

async function startMusicPolling() {
  if (!WHATSAPP_TARGET_JID) {
    console.log("ℹ️  Music polling skipped (no WHATSAPP_TARGET_JID)");
    return;
  }

  const useLastfm = !!(LASTFM_API_KEY && LASTFM_USERNAME);
  const useSpotify = !!SPOTIFY_REFRESH_TOKEN;

  if (!useLastfm && !useSpotify) {
    console.log("ℹ️  Music polling skipped (no Last.fm or Spotify)");
    return;
  }

  clearInterval(spotifyPollTimer);

  const source = useLastfm ? "Last.fm" : "Spotify";
  console.log(
    `🎧 ${source} polling started (every ${SPOTIFY_POLL_INTERVAL / 1000}s) → ${WHATSAPP_TARGET_JID}`
  );

  spotifyPollTimer = setInterval(async () => {
    try {
      if (!sock || !isConnected) return;

      let track = null;

      // Last.fm first (free, no premium needed)
      if (useLastfm) {
        track = await getCurrentlyPlayingLastfm();
      }

      // Spotify fallback (premium only)
      if (!track && useSpotify) {
        track = await getCurrentlyPlayingSpotify();
      }

      if (!track || !track.isPlaying) return;
      if (track.id === lastSpotifyTrackId) return;

      lastSpotifyTrackId = track.id;

      await sock.sendMessage(WHATSAPP_TARGET_JID, {
        text: formatTrackMessage(track),
      });

      incrementStat("spotify_updates");
      console.log("🎵 Music update sent:", track.name);
    } catch (err) {
      console.error("Music poll error:", err.message);
    }
  }, SPOTIFY_POLL_INTERVAL);
}

// ======================================================
// AI REPLY
// ======================================================

async function generateAIReply(jid, userText) {
  const rows = getHistory.all(jid, MAX_HISTORY).reverse();

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...rows.map((row) => ({ role: row.role, content: row.content })),
    { role: "user", content: userText },
  ];

  const completion = await ai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.8,
    max_tokens: 250,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("AI returned empty response");

  insertMessage.run(jid, "user", userText, Date.now());
  insertMessage.run(jid, "assistant", reply, Date.now());

  incrementStat("ai_replies");
  return reply;
}

// ======================================================
// MESSAGE PROCESSING
// ======================================================

async function processMessage(msg) {
  try {
    if (!msg?.message) return;
    if (msg.key?.fromMe) return;

    const jid = msg.key?.remoteJid;
    if (!jid) return;

    if (jid.endsWith("@g.us") || jid === "status@broadcast") return;

    const text = extractMessageText(msg.message).trim();
    if (!text) return;

    console.log("📩 JID:", jid, "| Msg:", text);

    totalReceived++;
    incrementStat("messages_received");

    // Skip own messages (self-chat loop aapadaniki)
    if (WHATSAPP_TARGET_JID && jid === WHATSAPP_TARGET_JID) {
      return;
    }

    // -----------------------------------------------
    // MANUAL SONG COMMAND
    // -----------------------------------------------

    const lowerText = text.toLowerCase().trim();

    if (lowerText.startsWith("song ")) {
      const songName = text.slice(5).trim();

      if (songName) {
        if (!sock) return;
        await sock.sendPresenceUpdate("composing", jid);

        const reply = `🎧 Ippudu vintunna:\n\n🎵 *${songName}*`;

        await sock.sendMessage(jid, { text: reply });

        insertMessage.run(jid, "user", text, Date.now());
        insertMessage.run(jid, "assistant", reply, Date.now());

        totalSent++;
        incrementStat("messages_sent");
        incrementStat("spotify_updates");
        return;
      }
    }

    // -----------------------------------------------
    // SOCIAL DOWNLOAD
    // -----------------------------------------------

    const social = getSupportedUrl(text);

    if (social) {
      if (!sock) return;

      try {
        await sock.sendPresenceUpdate("composing", jid);

        if (social.type === "audio") {
          const media = await downloadAudio(social.url);
          await sock.sendMessage(jid, {
            audio: { url: media.filePath },
            mimetype: "audio/mpeg",
            ptt: false,
          });
          totalSent++;
          incrementStat("media_sent");
          incrementStat("audio_sent");
          fs.rmSync(media.tempDir, { recursive: true, force: true });
          return;
        }

        const media = await downloadMedia(social.url);
        await sock.sendMessage(jid, {
          video: { url: media.filePath },
          caption: "Downloaded media",
        });
        totalSent++;
        incrementStat("media_sent");
        fs.rmSync(media.tempDir, { recursive: true, force: true });
        return;
      } catch (error) {
        totalErrors++;
        incrementStat("errors");
        console.error("❌ MEDIA ERROR:", error?.message || error);
        await sock.sendMessage(jid, {
          text: "Sorry ra, aa media download cheyyalekapoya 😕",
        });
        return;
      }
    }

    // -----------------------------------------------
    // AI REPLY
    // -----------------------------------------------

    if (!sock) return;

    await sock.sendPresenceUpdate("composing", jid);

    const reply = await generateAIReply(jid, text);

    const delay = Math.min(1800, Math.max(500, reply.length * 18));
    await new Promise((r) => setTimeout(r, delay));

    await sock.sendMessage(jid, { text: reply });

    totalSent++;
    incrementStat("messages_sent");
  } catch (error) {
    totalErrors++;
    incrementStat("errors");
    console.error("Message error:", error.message);
  }
}

// ======================================================
// WHATSAPP CONNECTION
// ======================================================

async function startBot() {
  if (isStarting) return;
  isStarting = true;

  try {
    const authDir = path.join(DATA_DIR, "auth");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 Scan this QR in WhatsApp:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        isConnected = true;
        isStarting = false;
        console.log("✅ WhatsApp connected");
        startMusicPolling();
      }

      if (connection === "close") {
        isConnected = false;
        isStarting = false;
        clearInterval(spotifyPollTimer);

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          console.log("🚪 Logged out. Delete ./data/auth and restart.");
          return;
        }

        console.log("🔁 Reconnecting in 3s...");
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(startBot, 3000);
      }
    });

    sock.ev.on("messages.upsert", async (event) => {
      const { messages, type } = event;
      if (type !== "notify") return;

      for (const msg of messages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        enqueue(jid, () => processMessage(msg));
      }
    });
  } catch (err) {
    isStarting = false;
    console.error("startBot error:", err);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(startBot, 5000);
  }
}

// ======================================================
// EXPRESS SERVER
// ======================================================

const app = express();
app.use(express.json());

// ---------- SPOTIFY OAUTH (optional, Premium ke) ----------

const SPOTIFY_SCOPES = "user-read-currently-playing user-read-playback-state";

app.get("/spotify/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

app.get("/spotify/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("❌ No code from Spotify");

  try {
    const basic = Buffer.from(
      `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();

    if (!data.refresh_token) {
      console.error("Spotify callback error:", data);
      return res.send("❌ No refresh token. Check redirect URI.");
    }

    const envPath = path.join(__dirname, ".env");
    let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

    if (/SPOTIFY_REFRESH_TOKEN=.*/m.test(envText)) {
      envText = envText.replace(
        /SPOTIFY_REFRESH_TOKEN=.*/m,
        `SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`
      );
    } else {
      envText += `\nSPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`;
    }

    fs.writeFileSync(envPath, envText);
    SPOTIFY_REFRESH_TOKEN = data.refresh_token;

    res.send(`
      <h2>✅ Spotify connected!</h2>
      <p>Refresh token .env lo save ayyindi.</p>
      <p><b>Restart cheyyi:</b> <code>node index.js</code></p>
    `);
  } catch (err) {
    console.error("Callback error:", err);
    res.send("❌ Error: " + err.message);
  }
});

// ---------- HOME ----------

app.get("/", (req, res) => {
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
        <p><a href="/admin">Admin Dashboard</a></p>
      </div>
    </body>
    </html>
  `);
});

// ---------- ADMIN ----------

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
  const uniqueChats = db.prepare("SELECT COUNT(DISTINCT jid) AS count FROM messages").get();
  const messages = db.prepare("SELECT COUNT(*) AS count FROM messages").get();

  res.json({
    online: isConnected,
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

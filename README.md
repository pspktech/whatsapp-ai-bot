# 🤖 WhatsApp AI Bot v3

Made With Love @MadhuPatel

A personal WhatsApp bot with AI chat (Groq), Spotify "now playing" updates, weather reports, and media downloader — built with Baileys + Express.

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **AI Chat** | Human-like Telugu/English (Tenglish) replies using Groq (LLaMA / GPT-OSS) |
| 🎧 **Spotify Now Playing** | Auto-polls Spotify every 10s, sends "Ippudu vintunna" updates |
| 🌤️ **Weather** | `/weather` command + daily 7 AM auto report (Open-Meteo, no API key) |
| 🎬 **Media Downloader** | YouTube / Instagram / X / Twitter — video + audio via `yt-dlp` |
| 🎵 **Spotify Downloader** | Paste a Spotify link → bot downloads MP3 from YouTube |
| 📊 **Admin Dashboard** | Live stats: messages, AI replies, media sent, uptime |
| 🔒 **Session Persistence** | WhatsApp login saved in `data/auth`, no QR on restart |
| 🧹 **Noise Filter** | Suppresses Baileys/libsignal verbose logs |

---

## 📁 Project Structure

```
whatsapp-ai-v3/
├── index.js                    # Entry point — WhatsApp setup + boot
├── config.js                   # Env vars loader
├── logger.js                   # Suppress noisy Baileys logs
├── state.js                    # Shared mutable state
├── db.js                       # SQLite (better-sqlite3)
├── features/
│   ├── ai.js                   # Groq AI + system prompt
│   ├── weather.js              # Open-Meteo weather
│   ├── spotify.js              # Spotify auth + polling
│   ├── media.js                # URL detect + yt-dlp download
│   ├── router.js               # Message router
│   └── admin.js                # Express routes + dashboard
├── data/                       # SQLite DB + WhatsApp auth (gitignored)
├── .env                        # Secrets (gitignored)
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **yt-dlp** (media downloader)
- **ffmpeg** (audio conversion)
- **Spotify Premium** (for "now playing" — optional)

### Install

```bash
# 1. Clone
git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot

# 2. Install deps
npm install

# 3. Install system tools (Termux / Linux)
pkg install yt-dlp ffmpeg        # Termux
# OR
sudo apt install yt-dlp ffmpeg   # Debian/Ubuntu

# 4. Copy env template
cp .env.example .env
# Edit .env with your keys (see below)

# 5. Run
npm start
```

First run → QR code terminal lo vastundi. Phone lo **WhatsApp → Linked Devices → Link a Device** scan cheyyi.

---

## 🔐 Environment Variables (`.env`)

```env
# ---------- Server ----------
PORT=3000
ADMIN_PASSWORD=change-this-password

# ---------- Groq AI ----------
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
AI_MODEL=openai/gpt-oss-120b
MAX_HISTORY=10

# ---------- Partner persona ----------
PARTNER_NAME=Mummy
PARTNER_ALT=Potti

# ---------- Spotify ----------
SPOTIFY_CLIENT_ID=xxxxxxxxxxxx
SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxx
SPOTIFY_REFRESH_TOKEN=xxxxxxxxxxxx
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/spotify/callback
SPOTIFY_POLL_INTERVAL=10000

# ---------- WhatsApp ----------
WHATSAPP_TARGET_JID=91XXXXXXXXXX@s.whatsapp.net

# ---------- Weather ----------
WEATHER_CITY=Hyderabad
```

### Getting keys

**Groq API Key** → https://console.groq.com/keys

**Spotify** →
1. https://developer.spotify.com/dashboard → Create App
2. Redirect URI add cheyyi: `http://127.0.0.1:3000/spotify/callback`
3. Copy Client ID + Secret → `.env` lo paste
4. Browser lo open: `http://127.0.0.1:3000/spotify/login` → authorize
5. Refresh token auto `.env` lo save avutundi ✅

---

## 💬 Commands

| Command | Description |
|---------|-------------|
| `/weather` | Weather — default city (`WEATHER_CITY`) |
| `/weather Mumbai` | Weather — specific city |
| `weather hyderabad` | Same, lowercase without slash |
| `song <name>` | Manual "now playing" message |
| `<YouTube/IG/X URL>` | Auto download + send video |
| `<Spotify URL>` | Auto download MP3 from YouTube |
| Any other text | AI reply (Tenglish boyfriend persona) |

---

## 📊 Admin Dashboard

Local: http://127.0.0.1:3000/admin

Password: `.env` lo `ADMIN_PASSWORD`

Live stats:
- Bot status (ONLINE / OFFLINE)
- Messages received / sent
- AI replies count
- Media sent, audio sent
- Spotify updates
- Errors
- Active chats, DB messages

---

## ☁️ Deployment

### Render (recommended free tier)

1. Push code to GitHub
2. https://render.com → **New Web Service** → connect repo
3. Settings:
   - **Build**: `npm install`
   - **Start**: `npm start`
   - **Runtime**: Node
4. **Environment** tab → add all `.env` vars
5. **Disks** tab → Add Disk:
   - Name: `whatsapp-session`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1 GB
6. Deploy → check **Logs** for QR → scan

⚠️ **Free tier sleeps after 15 min idle** → use [cron-job.org](https://cron-job.org) to ping every 10 min.

### VPS (Oracle Cloud / Hostinger / Cyfuture)

```bash
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs yt-dlp ffmpeg

# Clone + setup
git clone <your-repo> && cd whatsapp-ai-bot
npm install
nano .env   # add keys
npm start
```

**Keep alive** with `pm2`:

```bash
npm i -g pm2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup
```

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| `🚪 Logged out` | `rm -rf data/auth && npm start` → re-scan QR |
| `Waiting for this message` | `rm -rf data/auth` + `npm install @whiskeysockets/baileys@latest` → re-scan |
| `Closing session: SessionEntry` spam | `logger.js` — stdout/stderr filter add cheyyi |
| Spotify `invalid_grant` | Auth code single-use, 10 min expire. Fresh code theesuko |
| Weather "city not found" | Spelling check cheyyi |
| `yt-dlp: command not found` | `pkg install yt-dlp` (Termux) / `apt install yt-dlp` |

---

## 📝 Notes

- **`.env` never commit** — it's in `.gitignore`
- **`data/` never commit** — contains WhatsApp auth (account access!)
- **Client Secret rotate** if accidentally exposed
- **Only one instance** — multiple `node index.js` corrupts sessions
- **Baileys version** — keep updated: `npm install @whiskeysockets/baileys@latest`

---

## 📜 License

MIT — free to use, modify, share.

---

## 🙏 Credits

- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API
- [Groq](https://groq.com) — Fast LLM inference
- [Open-Meteo](https://open-meteo.com) — Free weather API
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Media downloader
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Database

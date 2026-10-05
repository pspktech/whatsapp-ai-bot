<div align="center">

# 🤖 WhatsApp AI Bot

**A personal WhatsApp companion bot with AI chat, media downloads, and live music tracking.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-WhatsApp-25D366?logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![Groq](https://img.shields.io/badge/Groq-AI-FF6B35)](https://groq.com)
[![Last.fm](https://img.shields.io/badge/Last.fm-Music-D51007?logo=last.fm&logoColor=white)](https://www.last.fm)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 📖 Overview

**WhatsApp AI Bot** is a personal companion that lives in your WhatsApp. It chats like a real human (Tenglish — Telugu + English mix), downloads videos from social links, sends Spotify songs as audio, and auto-updates your currently playing music — all for **free**, no Spotify Premium needed.

Built with **Baileys**, **Groq AI**, **Last.fm API**, and **SQLite** for local storage.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **AI Chat Replies** | Natural Tenglish replies via Groq AI (Llama 3.3 70B) |
| 📥 **Media Downloads** | YouTube, Instagram Reels, X/Twitter videos |
| 🎵 **Spotify Songs** | Send a Spotify link → get MP3 audio back |
| 🎧 **Live Music Updates** | Auto-posts "Ippudu vintunna..." from Last.fm |
| 🎤 **Manual Song Command** | Type `song <name>` → bot sends it |
| 🖥️ **Admin Dashboard** | Web UI with live stats and token auth |
| 💾 **SQLite Storage** | Chat history + usage stats saved locally |
| 🔐 **Password Protected** | Admin login with bearer tokens |
| 🚫 **Smart Ad Filter** | Auto-skips Spotify/Last.fm ad tracks |
| 🎨 **Clean Console** | Suppresses noisy Baileys/libsignal errors |

---

## 🎬 Demo

### Chat with AI
```
You:  Em chestunnav?
Bot:  Songs vintunna 🎧 nuvvu em chestunnav?

You:  Tinnava?
Bot:  Thinna... nuvvu tinnava? ❤️

You:  I love you
Bot:  Aww... that's sweet 🥺❤️
```

### Manual song command
```
You:  song Kesariya
Bot:  🎧 Ippudu vintunna:

      🎵 Kesariya
```

### Auto music updates (from Last.fm)
```
🎧 Ippudu vintunna:

🎵 Moosina Muthyalake
🎤 Annamayya Keerthana, S. P. Balasubrahmanyam
💿 Annamayya
```

### Media download
```
You:  https://www.youtube.com/watch?v=xxxxx
Bot:  [sends video]

You:  https://open.spotify.com/track/xxxxx
Bot:  [sends audio]
```

---

## 📋 Prerequisites

Before you begin, make sure you have:

- ✅ **Node.js** v18 or higher
- ✅ **Termux** (Android) or **Linux/Ubuntu**
- ✅ **yt-dlp** + **ffmpeg** for media downloads
- ✅ **Groq API Key** (free) → [Get one](https://console.groq.com/keys)
- ✅ **Last.fm API Key** (free, optional) → [Get one](https://www.last.fm/api/account/create)
- ✅ **WhatsApp account** with linked device support

---

## 🚀 Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot
```

### Step 2 — Install Node dependencies

```bash
npm install
```

### Step 3 — Install system dependencies

**Termux:**
```bash
pkg update && pkg upgrade -y
pkg install yt-dlp ffmpeg nodejs-lts git -y
```

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install yt-dlp ffmpeg nodejs npm git -y
```

**macOS (Homebrew):**
```bash
brew install yt-dlp ffmpeg node git
```

### Step 4 — Create `.env` file

```bash
nano .env
```

Paste the following template and fill in your values:

```env
# ============================================
# AI (required)
# ============================================
GROQ_API_KEY=your_groq_api_key_here
AI_MODEL=openai/gpt-oss-120b
MAX_HISTORY=10

# ============================================
# Admin Dashboard
# ============================================
PORT=3000
ADMIN_PASSWORD=change-this-password

# ============================================
# Character / Personality
# ============================================
PARTNER_NAME=Mummy
PARTNER_ALT=Potti

# ============================================
# WhatsApp Target (where music updates go)
# ============================================
WHATSAPP_TARGET_JID=91XXXXXXXXXX@s.whatsapp.net

# ============================================
# Last.fm (FREE music tracking — recommended)
# ============================================
LASTFM_API_KEY=your_lastfm_api_key
LASTFM_USERNAME=your_lastfm_username

# ============================================
# Spotify (optional — Premium account only)
# ============================================
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REFRESH_TOKEN=
SPOTIFY_POLL_INTERVAL=25000
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/spotify/callback
```

Save with `Ctrl+O` → `Enter` → `Ctrl+X`

### Step 5 — Start the bot

```bash
npm start
```

### Step 6 — Link WhatsApp

1. A **QR code** appears in the terminal
2. Open WhatsApp on your phone
3. Go to **Settings → Linked Devices → Link a Device**
4. Scan the QR code

You should see:

```
🌐 Admin: http://127.0.0.1:3000/admin
✅ WhatsApp connected
🎧 Last.fm polling started (every 25s) → 91xxx@s.whatsapp.net
```

---

## 🎧 Last.fm Setup (Free Music Tracking)

Spotify's `currently-playing` API requires **Spotify Premium**, but **Last.fm is free** and works with Spotify Free.

### Step 1 — Create Last.fm account

Sign up at → https://www.last.fm/join

Note your **username** (you'll need it later).

### Step 2 — Connect Spotify to Last.fm

1. Go to → https://www.last.fm/settings/applications
2. Find **Spotify** section
3. Click **Connect** → authorize with your Spotify account

Now every song you play on Spotify will **auto-scrobble** to Last.fm.

> ⚠️ Spotify requires you to re-authorize Last.fm every **6 months**.

### Step 3 — Get Last.fm API Key

1. Go to → https://www.last.fm/api/account/create
2. Fill the form:
   - **Application name:** `WhatsApp Music Bot`
   - **Description:** `Personal bot`
   - **Callback URL:** *(leave empty)*
3. Click **Submit**
4. Copy the **API key**

### Step 4 — Add to `.env`

```env
LASTFM_API_KEY=your_api_key_here
LASTFM_USERNAME=your_lastfm_username
```

### Step 5 — Restart the bot

```bash
pkill -f "node index.js"
npm start
```

You should see:

```
🎧 Last.fm polling started (every 25s) → 91xxx@s.whatsapp.net
```

Now any song you play on Spotify will auto-post to your WhatsApp! 🎵

---

## 📱 WhatsApp JID Setup

To send music updates to a specific number, add its JID to `.env`:

```env
WHATSAPP_TARGET_JID=91××××××××@s.whatsapp.net
```

### JID Format

```
<country_code><number>@s.whatsapp.net
```

**Rules:**
- ❌ No `+` sign
- ❌ No spaces or dashes
- ❌ No brackets
- ✅ Only digits + `@s.whatsapp.net`

**Examples:**

| Phone Number | JID |
|---|---|
| +91 98765 43210 | `919876543210@s.whatsapp.net` |
| +1 415 555 0100 | `14155550100@s.whatsapp.net` |
| +44 7911 123456 | `447911123456@s.whatsapp.net` |

### How to Find Your JID

1. Send any message to the bot number (or to yourself via "Message Yourself")
2. Check the terminal — you'll see:
   ```
   📩 JID: 91××××××××××@s.whatsapp.net | Msg: hi
   ```
3. Copy the JID and paste it into `.env`

---

## 🎵 Usage

### 💬 Just chat normally

The bot replies in **Tenglish** style — short, caring, playful.

```
You:  Em chestunnav?
Bot:  Songs vintunna 🎧 nuvvu em chestunnav?

You:  Jagratha
Bot:  Sare... nuv kuda jagrathaga undu ❤️

You:  Poo ra
Bot:  Emaindhi Mummy? Cheppu naku 🥺
```

### 🎤 Send a song name manually

```
song Kesariya
```

Response:

```
🎧 Ippudu vintunna:

🎵 Kesariya
```

### 🎧 Auto music updates (Last.fm)

Play any song on Spotify → wait 30-60 seconds → bot auto-posts it to your WhatsApp.

### 📥 Media downloads

Just paste a link in WhatsApp:

| Link Type | Result |
|---|---|
| `https://www.youtube.com/watch?v=...` | 📹 Video (MP4) |
| `https://youtube.com/shorts/...` | 📹 Short video |
| `https://www.instagram.com/reel/...` | 📹 Reel video |
| `https://x.com/.../status/...` | 📹 Tweet video |
| `https://open.spotify.com/track/...` | 🎵 MP3 audio |

---

## 🖥️ Admin Dashboard

Access the web dashboard at:

```
http://127.0.0.1:3000/admin
```

Login with your `ADMIN_PASSWORD`.

### Dashboard Stats

| Metric | Description |
|---|---|
| **Bot Status** | ONLINE / OFFLINE |
| **Messages Received** | Total incoming messages |
| **Messages Sent** | Total bot replies sent |
| **AI Replies** | AI-generated responses |
| **Active Chats** | Unique chat count |
| **Media Sent** | Videos/audio sent |
| **Audio Sent** | Spotify audio specifically |
| **Music Updates** | Last.fm/Spotify auto-posts |
| **Errors** | Failed operations |
| **DB Messages** | Total messages in SQLite |

Auto-refreshes every 5 seconds.

---

## 📁 Project Structure

```
whatsapp-ai-bot/
├── index.js                  # Main bot file
├── package.json              # Node dependencies
├── .env                      # Secrets (NOT committed)
├── .gitignore                # Git ignore rules
├── README.md                 # This file
└── data/                     # Runtime data (NOT committed)
    ├── assistant.db          # SQLite database
    └── auth/                 # WhatsApp session files
```

---

## ⚙️ Environment Variables

### AI

| Variable | Required | Description | Default |
|---|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq AI API key | — |
| `AI_MODEL` | ❌ | Model to use | `openai/gpt-oss-120b` |
| `MAX_HISTORY` | ❌ | Messages in context | `10` |

### Admin Dashboard

| Variable | Required | Description | Default |
|---|---|---|---|
| `PORT` | ❌ | Server port | `3000` |
| `ADMIN_PASSWORD` | ✅ | Dashboard password | `change-this-password` |

### Character

| Variable | Required | Description | Default |
|---|---|---|---|
| `PARTNER_NAME` | ❌ | Primary pet name | `Mummy` |
| `PARTNER_ALT` | ❌ | Alternative pet name | `Potti` |

### WhatsApp

| Variable | Required | Description | Default |
|---|---|---|---|
| `WHATSAPP_TARGET_JID` | ❌ | Music updates receiver | — |

### Last.fm

| Variable | Required | Description | Default |
|---|---|---|---|
| `LASTFM_API_KEY` | ❌ | Last.fm API key | — |
| `LASTFM_USERNAME` | ❌ | Last.fm username | — |

### Spotify (optional)

| Variable | Required | Description | Default |
|---|---|---|---|
| `SPOTIFY_CLIENT_ID` | ❌ | Spotify app client ID | — |
| `SPOTIFY_CLIENT_SECRET` | ❌ | Spotify app secret | — |
| `SPOTIFY_REFRESH_TOKEN` | ❌ | OAuth refresh token | — |
| `SPOTIFY_POLL_INTERVAL` | ❌ | Poll interval (ms) | `25000` |
| `SPOTIFY_REDIRECT_URI` | ❌ | OAuth redirect | `http://127.0.0.1:3000/spotify/callback` |

---

## 🐛 Troubleshooting

### ❌ `Bad MAC` / `Failed to decrypt` errors

**Symptom:**
```
Failed to decrypt message with any known session...
Session error:Error: Bad MAC
```

**Cause:** Normal Baileys warning after connecting — old WhatsApp session keys.

**Fix:** Ignore them. The bot already filters these out in the console. Bot works fine.

---

### ❌ Music updates not arriving

**Checklist:**

1. **Last.fm username correct?** → https://www.last.fm/user/YOUR_USERNAME
2. **Spotify connected to Last.fm?** → https://www.last.fm/settings/applications
3. **Play a full song** (30+ seconds) on Spotify
4. **Wait 30-60 seconds** for Last.fm to sync
5. **Test the API directly:**
   ```bash
   curl "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=YOUR_USERNAME&api_key=YOUR_KEY&format=json&limit=1"
   ```
   Look for `"nowplaying":"true"` in the response.

---

### ❌ `Spotify token failed (401)`

Spotify refresh token expired. Re-run the OAuth flow:

```
http://127.0.0.1:3000/spotify/login
```

---

### ❌ `Cannot find module 'xxx'`

Missing dependency:

```bash
npm install
```

---

### ❌ `EADDRINUSE: address already in use`

Port 3000 already in use. Kill the old process:

```bash
pkill -f "node index.js"
```

Or change `PORT` in `.env`.

---

### ❌ `yt-dlp: command not found`

Install yt-dlp:

```bash
# Termux
pkg install yt-dlp -y

# Ubuntu
sudo apt install yt-dlp -y

# macOS
brew install yt-dlp
```

---

### ❌ Server not starting

Check for syntax errors:

```bash
node -c index.js
```

If no output → syntax is clean. Otherwise, error message will show the line.

---

### ❌ QR code not appearing

Delete the auth folder and restart:

```bash
rm -rf data/auth
npm start
```

---

## 🔐 Security Best Practices

| ⚠️ Rule | Why |
|---|---|
| **Never commit `.env`** | Contains API keys and secrets |
| **Use strong `ADMIN_PASSWORD`** | Dashboard has full stats access |
| **Rotate keys if exposed** | Regenerate on Groq/Last.fm/Spotify |
| **Private repo preferred** | Personal bot, not for public |
| **`.gitignore` includes:** | `.env`, `data/`, `node_modules/`, `*.backup` |

### If keys are accidentally committed

1. **Revoke the key immediately:**
   - Groq → https://console.groq.com/keys
   - Last.fm → https://www.last.fm/api/accounts
   - Spotify → https://developer.spotify.com/dashboard
2. **Generate a new key**
3. **Update `.env`**
4. **Remove from Git history:**
   ```bash
   git rm --cached .env
   git commit -m "Remove secrets"
   git push --force
   ```

---

## 📦 Dependencies

### NPM Packages

| Package | Purpose |
|---|---|
| `@whiskeysockets/baileys` | WhatsApp Web API |
| `openai` | Groq AI client (OpenAI-compatible) |
| `better-sqlite3` | Fast local database |
| `express` | Admin dashboard server |
| `qrcode-terminal` | QR code display |
| `pino` | Structured logging |
| `dotenv` | Load `.env` variables |

### System Tools

| Tool | Purpose |
|---|---|
| `yt-dlp` | Download videos/audio from URLs |
| `ffmpeg` | Merge video+audio, convert formats |
| `node` | JavaScript runtime |

---

## 🗺️ Roadmap

- [x] AI chat replies (Tenglish)
- [x] YouTube / Instagram / X downloads
- [x] Spotify link → audio
- [x] Last.fm live music updates
- [x] Manual `song <name>` command
- [x] Admin dashboard with stats
- [x] Ad track filtering
- [x] Console error filtering
- [ ] Voice note replies
- [ ] Image generation
- [ ] Weather updates
- [ ] Daily good morning messages
- [ ] Reminders / alarms
- [ ] News headlines
- [ ] Group chat support
- [ ] Multi-user support

---

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m "Add amazing feature"`)
4. Push (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **MIT License** — use freely, modify as you wish.

---

## 🙏 Credits

Special thanks to:

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp Web library
- **[Groq](https://groq.com)** — Blazing fast AI inference
- **[Last.fm](https://www.last.fm)** — Free music scrobbling API
- **[Spotify](https://spotify.com)** — Music streaming platform
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Powerful media downloader

---

## 📞 Support

For issues, questions, or feature requests:

- 🐛 **Open an issue:** [GitHub Issues](https://github.com/pspktech/whatsapp-ai-bot/issues)
- 💬 **Discussion:** Start a new discussion

---

<div align="center">

**Made with ❤️ for personal use.**

⭐ Star this repo if you found it useful!

</div>

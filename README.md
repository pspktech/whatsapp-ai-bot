# 🤖 WhatsApp AI Bot

A personal WhatsApp bot with AI replies, YouTube/Instagram downloads, Spotify auto-updates, AFK mode, weather, translation, and more. Built with Baileys + Groq AI.

---

## ✨ Features

### 💬 AI Chat
- **Telugu/Tenglish boyfriend bot** — natural, personal replies
- Powered by **Groq** (`openai/gpt-oss-120b`)
- Remembers chat history per contact
- **ON/OFF toggle** — `.ai on` / `.ai off` / `.ai`
- Never breaks character, never says "I am an AI"

### 💤 AFK Mode
- `.afk <reason>` — set away status
- Auto-replies to incoming messages while away
- Auto OFF when you send any normal message
- Shows away duration in reply

### 📥 Media Download
- **YouTube** — `.yta <song>` (MP3) / `.ytv <song> [quality]` (video)
- **Instagram** — send any reel/post link (auto-download)
- **Twitter/X** — send any tweet link
- **Spotify** — send track/album/playlist link → MP3
- Powered by **yt-dlp** + **deno** + cookies

### 🎵 Spotify Auto-Update
- Detects currently playing track
- Sends message to target JID every 10s when track changes
- Format: `🎧 Ippudu vintunna: 🎵 <song>`

### 🌤️ Weather
- `/weather <city>` — current + 3-day forecast
- Daily schedule (~7 AM IST) to target JID

### 🌐 Translation
- `.tr <text> to <lang>` — Google Translate
- Example: `.tr Hello world to te`

### 📝 Notes
- `.note add <text>` — save note
- `.note list` — show notes
- `.note del <num>` — delete note

### ⏰ Reminders
- `/remind <time> <text>` — set reminder

### 🖼️ Profile Picture
- `.pp` — reply to image to set, or mention user to get PP

### 🌐 Admin Dashboard
- Web UI: `http://127.0.0.1:3000/admin`
- Stats: uptime, RAM, messages, errors
- Password protected

---

## 📋 Commands Reference

| Command | Description |
|---------|-------------|
| `.ai on` | Enable AI replies |
| `.ai off` | Disable AI replies |
| `.ai` | Show AI status |
| `.afk <reason>` | Set AFK mode |
| `.afk off` | Clear AFK mode |
| `.yta <song>` | Download YouTube audio (MP3) |
| `.ytv <song> [q]` | Download YouTube video (720p default) |
| `.ytv <song> 1080` | Download 1080p video |
| `song <name>` | Send song info |
| `.tr <text> to <lang>` | Translate text |
| `.note add/list/del` | Personal notes |
| `/weather <city>` | Weather forecast |
| `/remind <time> <text>` | Set reminder |
| `.pp` | Set/get profile picture |

Send any link from Instagram / YouTube / Twitter → auto-download.

---

## 🚀 Setup

### Prerequisites
- **Termux** (Android) — install from [F-Droid](https://f-droid.org/packages/com.termux/)
- **Node.js 20+**
- **yt-dlp** + **deno** + **ffmpeg**
- **Groq API key** — [console.groq.com](https://console.groq.com)
- **Spotify API credentials** (optional, for auto-update)
- **cookies.txt** for Instagram/YouTube (optional)

### Install

```bash
# Update packages
pkg update && pkg upgrade -y

# Install Node + tools
pkg install nodejs-lts git python make clang ffmpeg deno python-yt-dlp -y

# Clone repo
git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot

# Install dependencies
npm install
npm install-scripts approve --all
npm rebuild better-sqlite3

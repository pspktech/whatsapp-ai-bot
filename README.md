# 🤖 WhatsApp AI Bot (Personal Assistant)

A powerful, multi-session WhatsApp bot built with Baileys, Groq AI, and Last.fm. It acts as a caring companion, downloads media, fetches Telugu lyrics, and auto-updates your currently playing music!

## ✨ Features

- 💬 **AI Chat Replies:** Natural Tenglish (Telugu + English) replies using Groq (Llama 3).
- 🎧 **Live Music Tracking:** Auto-posts "Now Playing" songs with Album Art using Last.fm.
- 🎵 **Lyrics Finder:** Fetches accurate Telugu/Hindi/English lyrics using JioSaavn API.
- 📥 **Media Downloader:** Downloads YouTube, Instagram, and X/Twitter links (using `yt-dlp`).
- 🌤️ **Daily Weather:** Sends automated weather updates every morning.
- 👥 **Multi-Session Support:** Run multiple WhatsApp numbers on a single bot instance.
- 🖥️ **Admin Dashboard:** Web UI to monitor bot status, messages, and errors.
- 🔒 **AFK & Auto-Reply:** Custom commands like `.ai off`, `.afk`, and `.lyrics`.

---

## 📋 Prerequisites

- **Node.js** v18 or higher
- **Termux** (Android) or any Linux/Ubuntu server
- **yt-dlp** & **ffmpeg** (for media downloading)
- **Groq API Key** (Free) - [Get it here](https://console.groq.com/keys)
- **Last.fm API Key** (Free) - [Get it here](https://www.last.fm/api/account/create)

---

## 🚀 Installation (Termux)

### 1. Install System Dependencies
```bash
pkg update && pkg upgrade -y
pkg install nodejs git python clang make build-essential ffmpeg -y
```

2. Install yt-dlp

```bash
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /data/data/com.termux/files/usr/bin/yt-dlp
chmod +x /data/data/com.termux/files/usr/bin/yt-dlp
```

3. Clone the Repository

```bash
git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot
```

4. Install NPM Packages

```bash
echo "allow-git=all" >> .npmrc
npm install --allow-git=all
npm install lyrics-lib
```

5. Setup .env File

Create a .env file and add your credentials:

```bash
nano .env
```

Paste this template:

```env
PORT=3000
ADMIN_PASSWORD=your_password

# AI Config
GROQ_API_KEY=your_groq_api_key
AI_MODEL=openai/gpt-oss-120b

# Music Tracking (Last.fm)
LASTFM_API_KEY=your_lastfm_api_key
LASTFM_USERNAME=your_lastfm_username

# WhatsApp Config
WHATSAPP_SESSIONS=main
WHATSAPP_TARGET_JID=91XXXXXXXXXX@s.whatsapp.net
```

6. Run the Bot

```bash
npm start
```

Scan the QR code in WhatsApp (Linked Devices).

---

🎮 Commands
Command Description
.menu / .help Shows all bot features, commands, and uses
.lyrics <Song - Artist> Fetches lyrics (e.g., .lyrics Samajavaragamana - Sid Sriram)
.lyrics Fetches lyrics for the currently playing song
.lfm Shows the latest 10 Last.fm tracks
.ai off / .ai on Toggles AI auto-reply
.afk <reason> Sets Away From Keyboard status
.weather <city> Gets live weather updates
(Just send a link) Automatically downloads YouTube/Insta media

---

📂 Project Structure

```text
whatsapp-ai-bot/
├── index.js              # Main entry point (Multi-session loader)
├── config.js             # Environment variables setup
├── state.js              # Shared memory/state
├── db.js                 # SQLite Database handler
├── logger.js             # Filters annoying Baileys logs
└── features/
    ├── router.js         # Message routing (Core logic)
    ├── ai.js             # Groq AI integration
    ├── lastfm.js         # Music tracking logic
    ├── lyrics.js         # JioSaavn lyrics fetcher
    ├── weather.js        # Weather API
    └── media.js          # yt-dlp downloader
```

---

⚠️ Troubleshooting

· EALLOWGIT error during install: Run echo "allow-git=all" >> .npmrc before npm install.
· better-sqlite3 build error: Ensure you installed python, clang, and make via pkg install.
· Last.fm not updating: Check LASTFM_API_KEY, LASTFM_USERNAME, and Track My Music/scrobbling settings.
· Bot Disconnecting: Ensure your phone's battery optimization is turned OFF for Termux so Android doesn't kill it.

---

📝 License

This project is for personal use. Feel free to fork and modify it!

Made with ❤️ by Madhu

```

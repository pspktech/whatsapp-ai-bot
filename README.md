<div align="center">🤖 WhatsApp AI Bot

⚡ Smart • Fast • Customizable WhatsApp AI Assistant

<p>
  <b>Built with Node.js + Baileys + Groq + SQLite</b>
</p><p>
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/Groq-AI-orange?style=for-the-badge">
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white">
  <img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp&logoColor=white">
</p><p>
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-dashboard">Dashboard</a>
</p></div>---

🚀 About

WhatsApp AI Bot is a Node.js based WhatsApp automation project that connects WhatsApp with an AI model through the Groq API.

It can generate natural conversational replies, remember recent conversations using SQLite, download supported social media media, and provide a simple admin dashboard.

---

✨ Features

Feature| Description
🤖 AI Replies| AI-powered WhatsApp conversations
💬 Tenglish| Telugu + English natural chat style
🧠 Memory| SQLite conversation history
⚡ Queue| Per-chat message processing
⌨️ Typing| WhatsApp typing indicator
📥 Downloader| Instagram / X media support
📊 Dashboard| Real-time bot statistics
🔐 Admin| Password-protected dashboard
🔄 Reconnect| Automatic WhatsApp reconnection
📈 Statistics| Messages, errors & AI reply counts

---

🧠 How It Works

             ┌─────────────────┐
             │     WhatsApp    │
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │     Baileys     │
             └────────┬────────┘
                      │
             ┌────────▼────────┐
             │ Message Handler │
             └───────┬─────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
   ┌─────────────┐       ┌─────────────┐
   │  Groq AI    │       │   yt-dlp    │
   │   Replies   │       │   Download  │
   └──────┬──────┘       └──────┬──────┘
          │                     │
          └──────────┬──────────┘
                     ▼
              ┌─────────────┐
              │   SQLite    │
              │   Memory    │
              └─────────────┘

---

🛠️ Tech Stack

<div align="center">Technology| Purpose
🟢 Node.js| Backend runtime
💚 Baileys| WhatsApp connection
🧠 Groq| AI responses
🗄️ SQLite| Conversation memory
🌐 Express| Admin web server
📥 yt-dlp| Media downloading
🎬 FFmpeg| Media processing

</div>---

📦 Requirements

Before starting, install:

Node.js
Python
FFmpeg
yt-dlp
Git

---

📥 Installation

1️⃣ Clone Repository

git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot

2️⃣ Install Node Dependencies

npm install

3️⃣ Install yt-dlp

pip install -U yt-dlp

---

🔑 Configuration

Create a ".env" file:

GROQ_API_KEY=YOUR_GROQ_API_KEY

AI_MODEL=openai/gpt-oss-120b

MAX_HISTORY=10

ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

PARTNER_NAME=NAME
PARTNER_ALT=NAME

📝 Customize AI Style

Change:

PARTNER_NAME=YOURNAME
PARTNER_ALT=YOURNAME 

to your preferred names.

«⚠️ Never upload your ".env" file to GitHub.»

---

▶️ Start Bot

Run:

npm start

A WhatsApp QR code will appear in your terminal.

📱 Connect WhatsApp

WhatsApp
   ↓
Linked Devices
   ↓
Link a Device
   ↓
Scan QR Code

After scanning, the bot will connect.

---

📊 Admin Dashboard

Start the bot:

npm start

Then open:

http://127.0.0.1:3000/admin

Login using the password configured in:

ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

Dashboard includes

🟢 Bot Status
📨 Messages Received
📤 Messages Sent
🤖 AI Replies
👥 Active Chats
📥 Media Sent
❌ Errors
🗄️ Database Messages

---

📱 Termux Setup

For Android users:

pkg update && pkg upgrade -y

pkg install nodejs-lts python ffmpeg git -y

pip install -U yt-dlp

Clone and run:

git clone https://github.com/pspktech/whatsapp-ai-bot.git

cd whatsapp-ai-bot

npm install

npm start

---

🔒 Security

The following files should never be uploaded:

.env
auth_info/
data/
node_modules/
index-backup.js

Make sure ".gitignore" contains:

.env
auth_info/
data/
node_modules/
index-backup.js

🚨 Never share

❌ GROQ API Key
❌ Admin Password
❌ WhatsApp Auth Session
❌ Private Database

---

📁 Project Structure

whatsapp-ai-bot/
│
├── 📄 index.js
├── 📄 package.json
├── 📄 package-lock.json
├── 📄 README.md
├── 📄 .gitignore
│
├── 📁 auth_info/
├── 📁 data/
└── 📁 node_modules/

«"auth_info", "data", and "node_modules" are ignored by Git.»

---

⚙️ Configuration Flow

.env
 │
 ├── GROQ_API_KEY
 ├── AI_MODEL
 ├── MAX_HISTORY
 ├── ADMIN_PASSWORD
 ├── PARTNER_NAME
 └── PARTNER_ALT
        │
        ▼
     index.js
        │
        ├── WhatsApp
        ├── Groq AI
        ├── SQLite
        └── Admin Dashboard

---

🧪 Development

Check JavaScript syntax before starting:

node --check index.js

Then:

npm start

---

📌 Important Notes

- Keep your API credentials private.
- Keep WhatsApp authentication files private.
- Use automation responsibly.
- Follow the applicable WhatsApp terms and policies.
- This project is intended for learning and personal development.

---

<div align="center">👨‍💻 CodeWithMadhu

Building • Learning • Coding 🚀

⭐ If you find this project useful, consider starring the repository.

</div>

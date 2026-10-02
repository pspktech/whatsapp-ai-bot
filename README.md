🤖 WhatsApp AI Bot

A WhatsApp AI assistant built with Node.js, Baileys, Groq API, and SQLite.

✨ Features

- 🤖 AI-powered WhatsApp replies
- 💬 Tenglish / Telugu conversation style
- 🧠 SQLite conversation history
- ⚡ Per-chat message queue
- ⌨️ Typing indicator
- 📥 Instagram / X media download support
- 📊 Admin dashboard
- 🔐 Admin password authentication
- 🔄 Automatic WhatsApp reconnect
- 📈 Bot statistics

🛠️ Requirements

Install these first:

- Node.js
- Python
- FFmpeg
- yt-dlp
- Git

📥 Installation

Clone the repository:

git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot

Install dependencies:

npm install

Install yt-dlp:

pip install -U yt-dlp

🔑 Environment Setup

Create a ".env" file:

GROQ_API_KEY=YOUR_GROQ_API_KEY
AI_MODEL=openai/gpt-oss-120b
MAX_HISTORY=10

ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

PARTNER_NAME=Mummy
PARTNER_ALT=Potti

⚠️ Never publish your ".env" file or API key.

▶️ Start the Bot

npm start

A QR code will appear in the terminal.

Open WhatsApp → Linked Devices → Link a Device → scan the QR code.

📊 Admin Dashboard

After starting the bot, open:

http://127.0.0.1:3000/admin

Login using the "ADMIN_PASSWORD" from your ".env" file.

The dashboard displays:

- Bot status
- Messages received
- Messages sent
- AI replies
- Active chats
- Media sent
- Errors
- Database message count

📱 Termux Setup

For Android / Termux:

pkg update && pkg upgrade -y
pkg install nodejs-lts python ffmpeg git -y
pip install -U yt-dlp

Then:

git clone https://github.com/pspktech/whatsapp-ai-bot.git
cd whatsapp-ai-bot
npm install
npm start

🔒 Security

Do NOT upload:

.env
auth_info/
data/
node_modules/
index-backup.js

These files are already included in ".gitignore".

Never share:

- Groq API keys
- Admin passwords
- WhatsApp authentication/session files

⚙️ Configuration

You can customize the AI chat style using:

PARTNER_NAME=NAME
PARTNER_ALT=NANE

Example:

PARTNER_NAME=YourName
PARTNER_ALT=YourNickname

🧩 Tech Stack

- Node.js
- Express
- Baileys
- Groq API
- OpenAI SDK
- SQLite
- yt-dlp
- FFmpeg

⚠️ Disclaimer

This project is provided for educational and personal development purposes.

Use WhatsApp automation responsibly and follow WhatsApp's applicable terms and policies.

👨‍💻 Author

CodeWithMadhu

Built with ❤️ using Node.js.

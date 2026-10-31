// features/about-resume.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");
const { PROJECTS } = require("./projects");

const SKILLS = [
  "JavaScript / Node.js",
  "HTML / CSS / Responsive UI",
  "Express.js / REST APIs",
  "WhatsApp & Telegram Bots",
  "AI API Integrations",
  "Android / Kotlin",
  "Git / GitHub",
  "Netlify / Vercel Deployment",
];

function projectLines() {
  return PROJECTS.map((project, index) => {
    const link = project.live || project.source || "Link coming soon";
    return `${index + 1}. ${project.title}\n   ${project.description}\n   ${link}`;
  });
}

async function handleAboutResumeCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".about" && lower !== ".resume") return false;

  const isResume = lower === ".resume";
  const reply = isResume
    ? [
        `📄 *${env.OWNER_NAME} — Resume*`,
        "",
        "🧠 *Tagline:* Overthinker hacker",
        "💼 Self-taught web, app and automation developer",
        "",
        "🛠️ *Skills*",
        ...SKILLS.map((skill) => `• ${skill}`),
        "",
        "🚀 *Projects*",
        ...projectLines(),
        "",
        `🌐 Portfolio: ${env.OWNER_SITE}`,
        `🌐 Projects: ${env.PROJECTS_URL}`,
      ].join("\n")
    : [
        `👋 *About ${env.OWNER_NAME}*`,
        "",
        "Not a genius. Just obsessed.",
        "",
        "No CS degree. No bootcamp. Just a laptop, YouTube and a lot of console.log(). I learn by building real products—bots, websites and apps—each one breaking something the last one taught me.",
        "",
        "When I'm not coding, I'm gaming, travelling or overthinking a bug that had a one-line fix.",
        "",
        "🧠 *Overthinker hacker*",
        "💻 Web Development + Bots & Automation",
        "🚀 Build it. Break it. Learn it. Ship it.",
        "",
        `🌐 ${env.OWNER_SITE}`,
        `📁 Type *.resume* for skills and project details.`,
      ].join("\n");

  await sock.sendMessage(jid, { text: reply });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { SKILLS, handleAboutResumeCommand };

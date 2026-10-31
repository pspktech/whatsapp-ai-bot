// features/utility.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");
const { PROJECTS } = require("./projects");

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getSessionStatus() {
  if (!state.sessionStatus?.size) return "OFFLINE";
  return [...state.sessionStatus.entries()]
    .map(([name, online]) => `${name}: ${online ? "ONLINE" : "OFFLINE"}`)
    .join(" | ");
}

function formatProjectsMessage() {
  const lines = ["🚀 *Madhu Patel — Projects*", ""];
  PROJECTS.forEach((project, index) => {
    lines.push(`${index + 1}. ${project.icon} *${project.title}*`);
    lines.push(`   ${project.description}`);
    lines.push(`   🛠️ ${project.tags.join(", ")}`);
    lines.push(`   🔗 Live: ${project.live || "Not available"}`);
    lines.push(`   💻 Source: ${project.source || "Not public"}`);
    lines.push("");
  });
  lines.push(`🌐 Full page: ${env.PROJECTS_URL}`);
  return lines.join("\n");
}

async function handleUtilityCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (![".ping", ".owner", ".info", ".projects", ".project"].includes(lower)) return false;

  let reply;
  if (lower === ".ping") {
    const started = Date.now();
    await sock.sendMessage(jid, { text: "🏓 Pong!" });
    console.log(`🏓 Ping handled in ${Date.now() - started}ms`);
  } else if (lower === ".owner") {
    reply = `👤 *Owner:* ${env.OWNER_NAME}\n💌 Made with love\n🌐 ${env.OWNER_SITE}`;
  } else if (lower === ".projects" || lower === ".project") {
    reply = formatProjectsMessage();
  } else {
    reply = [
      "🤖 *WhatsApp AI Bot*",
      `⏱️ Uptime: ${formatUptime(Date.now() - state.startedAt)}`,
      `📡 Sessions: ${getSessionStatus()}`,
      `📨 Received: ${state.totalReceived}`,
      `📤 Sent: ${state.totalSent}`,
      `❌ Errors: ${state.totalErrors}`,
      `💌 Made with love, ${env.OWNER_NAME}`,
      `🌐 ${env.OWNER_SITE}`,
    ].join("\n");
  }

  if (reply) await sock.sendMessage(jid, { text: reply });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleUtilityCommand, formatUptime, formatProjectsMessage };

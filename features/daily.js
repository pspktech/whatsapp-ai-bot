// features/daily.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");

let timer = null;
let lastSentDate = null;

function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function currentISTHourMinute() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value || 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 0),
  };
}

async function sendDailyMessage(sock, target) {
  const message = env.DAILY_MESSAGE ||
    "☀️ Good morning!\n\nNew day, new build. Keep learning, keep shipping. 🚀\n\n— Madhu Patel";
  await sock.sendMessage(target, { text: message });
  state.totalSent++;
  incrementStat("messages_sent");
  console.log(`☀️ Daily 9 AM message sent → ${target}`);
}

function startDailyAutomation(sock) {
  if (env.DAILY_AUTOMATION_ENABLED === false) return;
  const target = env.DAILY_TARGET_JID || env.WHATSAPP_TARGET_JID || sock?.user?.id;
  if (!target) {
    console.log("ℹ️ Daily automation skipped (no DAILY_TARGET_JID or WHATSAPP_TARGET_JID)");
    return;
  }
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    const now = currentISTHourMinute();
    const date = todayIST();
    if (now.hour !== env.DAILY_HOUR || now.minute !== env.DAILY_MINUTE || lastSentDate === date) return;
    try {
      if (state.isConnected && sock) {
        await sendDailyMessage(sock, target);
        lastSentDate = date;
      }
    } catch (error) {
      console.error("Daily automation error:", error.message);
    }
  }, 30 * 1000);
  console.log(`☀️ Daily automation scheduled at ${String(env.DAILY_HOUR).padStart(2, "0")}:${String(env.DAILY_MINUTE).padStart(2, "0")} IST → ${target}`);
}

function stopDailyAutomation() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startDailyAutomation, stopDailyAutomation, currentISTHourMinute };

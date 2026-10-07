// features/reminder.js
const state = require("../state");

// In-memory reminders (server restart ayyaka povu)
const activeReminders = new Map();

function parseDuration(str) {
  // "10s", "5m", "2h"
  const match = str.match(/^(\d+)(s|m|h)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const ms = unit === "s" ? value * 1000
           : unit === "m" ? value * 60 * 1000
           : value * 60 * 60 * 1000;
  return { value, unit, ms };
}

async function handleRemindCommand(jid, text) {
  // Format: /remind 10m Buy milk
  const match = text.match(/^\/remind\s+(\d+[smh])\s+(.+)$/i);
  if (!match) {
    return "❌ Usage: `/remind 10m <message>`\nExample: `/remind 5m Tea taagali`";
  }

  const duration = parseDuration(match[1]);
  const reminderText = match[2].trim();

  if (!duration) {
    return "❌ Invalid duration. Use: 10s, 5m, 2h";
  }

  // Confirmation
  const confirmMsg = `⏰ Reminder set for *${duration.value}${duration.unit}*\n📝 "${reminderText}"`;

  // Schedule the reminder
  const timerId = setTimeout(async () => {
    try {
      if (state.sock && state.isConnected) {
        await state.sock.sendMessage(jid, {
          text: `🔔 *REMINDER:* ${reminderText}\n\n_From WhatsApp AI Bot_`,
        });
        console.log(`🔔 Reminder sent to ${jid}: ${reminderText}`);
      }
    } catch (e) {
      console.error("Reminder send error:", e.message);
    } finally {
      activeReminders.delete(timerId);
    }
  }, duration.ms);

  activeReminders.set(timerId, { jid, text: reminderText, ms: duration.ms });

  return confirmMsg;
}

// Optional: list active reminders
function listReminders() {
  return Array.from(activeReminders.values());
}

module.exports = { handleRemindCommand, listReminders };

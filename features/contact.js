// features/contact.js
const state = require("../state");
const env = require("../config");
const { incrementStat } = require("../db");

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

async function handleContactCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".contact" && lower !== ".me") return false;

  const phone = cleanPhone(env.OWNER_PHONE);
  if (phone) {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${env.OWNER_NAME}`,
      `ORG:${env.OWNER_NAME}`,
      `TEL;type=CELL;type=VOICE:+${phone.replace(/^\+/, "")}`,
      `URL:${env.OWNER_SITE}`,
      "END:VCARD",
    ].join("\n");
    await sock.sendMessage(jid, {
      contacts: { displayName: env.OWNER_NAME, contacts: [{ vcard }] },
    });
  } else {
    await sock.sendMessage(jid, {
      text: [
        `👤 *${env.OWNER_NAME}*`,
        "💻 Web, app and automation developer",
        `🌐 ${env.OWNER_SITE}`,
        `💻 ${env.GITHUB_URL}`,
        `📱 ${env.TELEGRAM_URL}`,
        "",
        "OWNER_PHONE .env lo add chesthe ee command WhatsApp contact card pampistundi.",
      ].join("\n"),
    });
  }
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleContactCommand };

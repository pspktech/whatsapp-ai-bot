// features/presence.js
const env = require("../config");

const privacyTimers = new Map();

function privacyEnabled() {
  return env.HIDE_ONLINE || env.ONLINE_FREEZE;
}

async function hideOnline(sock) {
  if (!sock || !privacyEnabled()) return false;
  try {
    await sock.sendPresenceUpdate("unavailable");
    return true;
  } catch {
    return false;
  }
}

function startPresencePrivacy(sock, sessionName) {
  if (!privacyEnabled() || !sock) return;
  stopPresencePrivacy(sessionName);
  // Re-apply unavailable periodically because WhatsApp may refresh presence
  // after reconnects or message activity.
  const timer = setInterval(() => {
    hideOnline(sock).catch(() => {});
  }, 25 * 1000);
  timer.unref?.();
  privacyTimers.set(sessionName, timer);
  hideOnline(sock).catch(() => {});
}

function stopPresencePrivacy(sessionName) {
  const timer = privacyTimers.get(sessionName);
  if (timer) clearInterval(timer);
  privacyTimers.delete(sessionName);
}

async function sendPresenceUpdate(sock, type, jid) {
  // Typing/composing presence can reveal that the account is online. Suppress
  // it while either privacy mode is enabled.
  if (!sock || privacyEnabled()) return false;
  try {
    await sock.sendPresenceUpdate(type, jid);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  privacyEnabled,
  hideOnline,
  startPresencePrivacy,
  stopPresencePrivacy,
  sendPresenceUpdate,
};

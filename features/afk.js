// features/afk.js
const state = require("../state");
const { incrementStat } = require("../db");

// ---------- AFK command (owner only) ----------
async function handleAfkCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".afk" && !lower.startsWith(".afk ")) return false;
  if (!sock) return true;

  const reason = text.slice(4).trim();

  if (reason.toLowerCase() === "off") {
    const since = state.afkSince
      ? Math.floor((Date.now() - state.afkSince) / 1000)
      : 0;
    const dur = since > 0 ? ` (was away ${Math.floor(since / 60)}m)` : "";
    state.afk = false;
    state.afkReason = "";
    state.afkSince = 0;
    await sock.sendMessage(jid, { text: `✅ AFK mode OFF${dur}` });
  } else {
    state.afk = true;
    state.afkReason = reason || "No reason";
    state.afkSince = Date.now();
    await sock.sendMessage(jid, {
      text: `💤 AFK mode ON\n📝 Reason: _${state.afkReason}_\n\n_(Send any normal message to turn it off)_`,
    });
  }

  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

// ---------- AFK auto-reply (non-owner) ----------
async function sendAfkReply(sock, jid, msg) {
  if (state.afk !== true) return false;
  if (!sock) return false;

  const since = Math.floor((Date.now() - state.afkSince) / 1000);
  const mins = Math.floor(since / 60);
  const dur = mins > 0 ? `${mins}m` : `${since}s`;

  await sock.sendMessage(
    jid,
    {
      text: `💤 *Currently AFK* (${dur} ago)\n📝 _${state.afkReason || "No reason"}_\n\n_I'll reply when I'm back._`,
    },
    { quoted: msg }
  );

  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

// ---------- Auto clear when owner sends a normal message ----------
function clearAfkIfOwner(text) {
  if (!state.afk) return false;
  if (!text || text.startsWith(".")) return false;

  state.afk = false;
  state.afkReason = "";
  state.afkSince = 0;
  return true;
}

module.exports = { handleAfkCommand, sendAfkReply, clearAfkIfOwner };

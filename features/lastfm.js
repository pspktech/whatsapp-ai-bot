// features/lastfm.js
const env = require("../config");
const state = require("../state");
const { incrementStat } = require("../db");

let lastTrackKey = null;
let pollTimer = null;

async function getRecentTracks(limit = 1) {
  if (!env.LASTFM_API_KEY || !env.LASTFM_USERNAME) {
    throw new Error("Last.fm API key or username missing");
  }

  const url =
    "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks" +
    "&user=" + encodeURIComponent(env.LASTFM_USERNAME) +
    "&api_key=" + encodeURIComponent(env.LASTFM_API_KEY) +
    "&format=json&limit=" + limit;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Last.fm API failed: " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.message || "Last.fm error");

  const tracks = data.recenttracks?.track;
  if (!tracks) return [];
  return Array.isArray(tracks) ? tracks : [tracks];
}

function parseTrack(t) {
  if (!t) return null;
  const name = t.name || "";
  const artist = t.artist?.["#text"] || t.artist?.name || "";
  const album = t.album?.["#text"] || "";
  const image =
    (t.image || []).slice().reverse().find((i) => i["#text"])?.["#text"] || null;
  const nowPlaying = t["@attr"]?.nowplaying === "true";
  const key = (name + "|" + artist).toLowerCase();
  return { name, artist, album, image, nowPlaying, key };
}

function formatTrackMessage(track) {
  const userName = env.LASTFM_USER_NAME || "Madhu";
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  let msg = `🎧 *${userName} is listening on Last.fm*\n\n`;
  msg += `🎵 *${track.name}*\n`;
  msg += `🎤 ${track.artist}\n`;
  if (track.album) msg += `💿 ${track.album}\n`;
  msg += `\n📅 ${date}\n⏰ ${time}`;
  return msg;
}

async function startLastfmPolling() {
  if (!env.WHATSAPP_TARGET_JID) {
    console.log("ℹ️  Last.fm polling skipped (no WHATSAPP_TARGET_JID)");
    return;
  }
  if (!env.LASTFM_API_KEY || !env.LASTFM_USERNAME) {
    console.log("ℹ️  Last.fm polling skipped (no API key / username)");
    return;
  }

  if (pollTimer) clearInterval(pollTimer);

  console.log(
    `🎧 Last.fm polling started (every ${env.LASTFM_POLL_INTERVAL / 1000}s) → ${env.WHATSAPP_TARGET_JID}`
  );

  pollTimer = setInterval(async () => {
    try {
      if (!state.sock || !state.isConnected) return;

      const tracks = await getRecentTracks(1);
      const track = parseTrack(tracks[0]);
      if (!track || !track.nowPlaying) return;
      if (track.key === lastTrackKey) return;

      lastTrackKey = track.key;

      if (track.image) {
        await state.sock.sendMessage(env.WHATSAPP_TARGET_JID, {
          image: { url: track.image },
          caption: formatTrackMessage(track),
        });
      } else {
        await state.sock.sendMessage(env.WHATSAPP_TARGET_JID, {
          text: formatTrackMessage(track),
        });
      }

      incrementStat("lastfm_updates");
      console.log("🎵 Last.fm update sent:", track.name);
    } catch (err) {
      console.error("Last.fm poll error:", err.message);
    }
  }, env.LASTFM_POLL_INTERVAL);
}

function stopLastfmPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// Command: .lfm  /  .lastfm
async function handleLastfmCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (lower !== ".lfm" && lower !== ".lastfm" && !lower.startsWith(".lfm ")) {
    return false;
  }

  try {
    const tracks = await getRecentTracks(5);
    if (!tracks.length) {
      await sock.sendMessage(jid, { text: "❌ No recent tracks on Last.fm" });
      return true;
    }

    let msg = `🎧 *Last.fm — ${env.LASTFM_USERNAME}*\n\n`;
    tracks.forEach((t, i) => {
      const p = parseTrack(t);
      if (!p) return;
      const tag = p.nowPlaying ? "▶️ " : `${i + 1}. `;
      msg += `\( {tag}* \){p.name}* — ${p.artist}\n`;
    });

    await sock.sendMessage(jid, { text: msg });
    state.totalSent++;
    incrementStat("messages_sent");
  } catch (e) {
    await sock.sendMessage(jid, { text: "❌ Last.fm error: " + e.message });
  }
  return true;
}

module.exports = {
  startLastfmPolling,
  stopLastfmPolling,
  handleLastfmCommand,
  getRecentTracks,
};

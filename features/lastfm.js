// features/lastfm.js
const env = require("../config");
const state = require("../state");
const { incrementStat } = require("../db");

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
let pollTimer = null;
let lastTrackKey = null;
let lastTrackWasNowPlaying = false;

function hasLastfmConfig() {
  return Boolean(env.LASTFM_API_KEY && env.LASTFM_USERNAME);
}

function normalizeJid(value) {
  if (!value) return value;
  if (String(value).includes("@")) return value;
  const digits = String(value).replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : value;
}

async function lastfmRequest(params) {
  const query = new URLSearchParams({
    ...params,
    api_key: env.LASTFM_API_KEY,
    format: "json",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  let data;

  try {
    response = await fetch(`${LASTFM_API_URL}?${query}`, {
      signal: controller.signal,
    });
    data = await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Last.fm API request timed out after 10 seconds");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || data.error) {
    throw new Error(data.message || `Last.fm API error (${response.status})`);
  }
  return data;
}

async function getRecentTracks(limit = 10) {
  if (!hasLastfmConfig()) throw new Error("Last.fm API key or username missing");
  const data = await lastfmRequest({
    method: "user.getrecenttracks",
    user: env.LASTFM_USERNAME,
    limit: Math.min(Math.max(Number(limit) || 10, 1), 10),
  });
  const tracks = data?.recenttracks?.track || [];
  return Array.isArray(tracks) ? tracks : [tracks];
}

function isNowPlaying(track) {
  return track?.["@attr"]?.nowplaying === "true" || track?.["@attr"]?.nowplaying === true;
}

function normalizeTrack(track) {
  const images = Array.isArray(track?.image) ? track.image : [];
  const artist = typeof track?.artist === "string"
    ? track.artist
    : track?.artist?.["#text"];
  const image = images.find((item) => item.size === "extralarge")?.["#text"] ||
    images.find((item) => item.size === "large")?.["#text"] || null;

  return {
    name: track?.name || "Unknown track",
    artist: artist || "Unknown artist",
    album: track?.album?.["#text"] || track?.album || "",
    url: track?.url || null,
    image: image && !image.includes("2a96cbd8b46e442fc41c2b86b821562f")
      ? image
      : null,
    nowPlaying: isNowPlaying(track),
    playedAt: track?.date?.uts ? new Date(Number(track.date.uts) * 1000) : null,
  };
}

function trackKey(track) {
  const item = normalizeTrack(track);
  return `${item.artist}::${item.name}::${item.url || ""}`.toLowerCase();
}

function formatDate(date) {
  if (!date) return "Now playing";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRecentTracks(tracks) {
  const lines = [`🎧 *${env.LASTFM_USERNAME} — Last.fm Recent Tracks*`, ""];
  tracks.slice(0, 10).forEach((rawTrack, index) => {
    const track = normalizeTrack(rawTrack);
    lines.push(`${index + 1}. ${track.nowPlaying ? "▶️" : "🎵"} *${track.name}*`);
    lines.push(`   🎤 ${track.artist}${track.album ? ` · 💿 ${track.album}` : ""}`);
    lines.push(`   ⏰ ${formatDate(track.playedAt)}`);
    if (track.url) lines.push(`   🔗 ${track.url}`);
    lines.push("");
  });
  lines.push(`🔗 Scrobbling setup: ${env.LASTFM_SCROBBLING_URL}`);
  lines.push(`📱 Last.fm app: ${env.LASTFM_APP_URL}`);
  return lines.join("\n");
}

function formatNowPlaying(track) {
  const item = normalizeTrack(track);
  const heading = item.nowPlaying ? "Now playing" : "Recently played";
  let text = `🎧 *${heading} on ${env.LASTFM_USERNAME}'s Last.fm*\n\n`;
  text += `🎵 *${item.name}*\n🎤 ${item.artist}`;
  if (item.album) text += `\n💿 ${item.album}`;
  if (item.url) text += `\n🔗 ${item.url}`;
  return { text, image: item.image };
}

function formatTrackMessage(track) {
  return formatNowPlaying({
    name: track.name,
    artist: track.artists || track.artist,
    album: track.album,
    url: track.url,
    image: track.imageUrl || track.image,
    "@attr": track.isPlaying ? { nowplaying: "true" } : undefined,
  }).text;
}

async function getCurrentlyPlayingLastfm() {
  const tracks = await getRecentTracks(1);
  const current = tracks.find(isNowPlaying);
  if (!current) return null;
  const track = normalizeTrack(current);
  return {
    id: trackKey(current),
    name: track.name,
    artists: track.artist,
    album: track.album,
    imageUrl: track.image,
    isPlaying: true,
  };
}

async function pollLastfm(sock, target) {
  if (!state.isConnected || !hasLastfmConfig()) return;
  const tracks = await getRecentTracks(1);
  const current = tracks.find(isNowPlaying) || tracks[0];
  if (!current) return;

  const key = trackKey(current);
  const nowPlaying = isNowPlaying(current);
  if (key === lastTrackKey && !(nowPlaying && !lastTrackWasNowPlaying)) return;

  // Some scrobblers do not send @attr.nowplaying. Arm a recent-track fallback
  // without sending the old track immediately after a restart.
  if (!nowPlaying && lastTrackKey === null) {
    lastTrackKey = key;
    lastTrackWasNowPlaying = false;
    console.log("ℹ️ Last.fm nowplaying flag unavailable; recent-track fallback armed");
    return;
  }

  const message = formatNowPlaying(current);
  if (message.image) {
    await sock.sendMessage(target, {
      image: { url: message.image },
      caption: message.text,
    });
  } else {
    await sock.sendMessage(target, { text: message.text });
  }

  lastTrackKey = key;
  lastTrackWasNowPlaying = nowPlaying;
  incrementStat("lastfm_updates");
  console.log(`${nowPlaying ? "🎵" : "🕘"} Last.fm update sent:`, normalizeTrack(current).name);
}

function stopLastfmPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function startLastfmPolling(sock) {
  if (!hasLastfmConfig()) {
    console.log("ℹ️ Last.fm polling skipped (set LASTFM_API_KEY and LASTFM_USERNAME)");
    return;
  }

  const target = normalizeJid(
    env.LASTFM_TARGET_JID || env.WHATSAPP_TARGET_JID || sock?.user?.id
  );
  if (!target) {
    console.log("ℹ️ Last.fm polling skipped (no Last.fm target JID)");
    return;
  }

  stopLastfmPolling();
  lastTrackKey = null;
  lastTrackWasNowPlaying = false;
  console.log(`🎧 Last.fm polling started (every ${env.LASTFM_POLL_INTERVAL / 1000}s) → ${target}`);

  pollLastfm(sock, target).catch((error) =>
    console.error("Last.fm poll error:", error.message)
  );
  pollTimer = setInterval(() => {
    pollLastfm(sock, target).catch((error) =>
      console.error("Last.fm poll error:", error.message)
    );
  }, env.LASTFM_POLL_INTERVAL);
}

async function handleLastfmCommand(sock, jid, text) {
  const command = text.toLowerCase().trim();
  if (command !== ".lfm" && command !== ".lastfm") return false;

  console.log(`📡 Last.fm recent tracks requested by ${jid}`);
  if (!hasLastfmConfig()) {
    await sock.sendMessage(jid, {
      text: [
        "❌ Last.fm not configured.",
        "Set LASTFM_API_KEY and LASTFM_USERNAME in .env, then restart the bot.",
        `🔗 Scrobbling setup: ${env.LASTFM_SCROBBLING_URL}`,
      ].join("\n"),
    });
    return true;
  }

  try {
    const tracks = await getRecentTracks(10);
    console.log(`📡 Last.fm returned ${tracks.length} recent track(s)`);
    await sock.sendMessage(jid, { text: formatRecentTracks(tracks) });
  } catch (error) {
    console.error("Last.fm recent tracks error:", error.message);
    await sock.sendMessage(jid, { text: `❌ Last.fm error: ${error.message}` });
  }
  return true;
}

module.exports = {
  getRecentTracks,
  getCurrentlyPlayingLastfm,
  handleLastfmCommand,
  startLastfmPolling,
  stopLastfmPolling,
  pollLastfm,
  formatRecentTracks,
  formatNowPlaying,
  formatTrackMessage,
};

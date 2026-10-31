// features/lastfm.js
const env = require("../config");
const state = require("../state");
const { incrementStat } = require("../db");

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
let lastfmPollTimer = null;
let lastNowPlayingKey = null;

function hasLastfmConfig() {
  return Boolean(env.LASTFM_API_KEY && env.LASTFM_USERNAME);
}

async function lastfmRequest(params) {
  const query = new URLSearchParams({
    ...params,
    api_key: env.LASTFM_API_KEY,
    format: "json",
  });
  const response = await fetch(`${LASTFM_API_URL}?${query}`);
  const data = await response.json();
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

function normaliseTrack(track) {
  const artist = typeof track?.artist === "string" ? track.artist : track?.artist?.["#text"];
  const images = Array.isArray(track?.image) ? track.image : [];
  return {
    name: track?.name || "Unknown track",
    artist: artist || "Unknown artist",
    album: track?.album?.["#text"] || track?.album || "",
    url: track?.url || null,
    image: images.find((item) => item.size === "extralarge")?.["#text"] ||
      images.find((item) => item.size === "large")?.["#text"] || null,
    nowPlaying: isNowPlaying(track),
    playedAt: track?.date?.uts ? new Date(Number(track.date.uts) * 1000) : null,
  };
}

function trackKey(track) {
  const item = normaliseTrack(track);
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
  const lines = [
    `🎧 *${env.LASTFM_USERNAME} — Last.fm Recent Tracks*`,
    "",
  ];
  tracks.slice(0, 10).forEach((rawTrack, index) => {
    const track = normaliseTrack(rawTrack);
    lines.push(`${index + 1}. ${track.nowPlaying ? "▶️" : "🎵"} *${track.name}*`);
    lines.push(`   🎤 ${track.artist}${track.album ? ` · 💿 ${track.album}` : ""}`);
    lines.push(`   ⏰ ${formatDate(track.playedAt)}`);
    if (track.url) lines.push(`   🔗 ${track.url}`);
    lines.push("");
  });
  lines.push(`🔗 Spotify scrobbling: ${env.LASTFM_SCROBBLING_URL}`);
  lines.push(`📱 Last.fm app: ${env.LASTFM_APP_URL}`);
  return lines.join("\n");
}

function formatNowPlaying(track) {
  const item = normaliseTrack(track);
  let message = `🎧 *Now playing on ${env.LASTFM_USERNAME}'s Last.fm*\n\n`;
  message += `🎵 *${item.name}*\n🎤 ${item.artist}`;
  if (item.album) message += `\n💿 ${item.album}`;
  if (item.url) message += `\n🔗 ${item.url}`;
  return { text: message, image: item.image };
}

async function pollLastfm(sock, target) {
  if (!state.isConnected || !hasLastfmConfig()) return;
  const tracks = await getRecentTracks(1);
  const current = tracks.find(isNowPlaying);
  if (!current) return;

  const key = trackKey(current);
  if (key === lastNowPlayingKey) return;

  const message = formatNowPlaying(current);
  if (message.image) {
    await sock.sendMessage(target, { image: { url: message.image }, caption: message.text });
  } else {
    await sock.sendMessage(target, { text: message.text });
  }
  lastNowPlayingKey = key;
  incrementStat("lastfm_updates");
  console.log("🎵 Last.fm update sent:", normaliseTrack(current).name);
}

function stopLastfmPolling() {
  if (lastfmPollTimer) clearInterval(lastfmPollTimer);
  lastfmPollTimer = null;
}

function startLastfmPolling(sock) {
  if (!hasLastfmConfig()) {
    console.log("ℹ️ Last.fm polling skipped (set LASTFM_API_KEY and LASTFM_USERNAME)");
    return;
  }
  const target = env.LASTFM_TARGET_JID || env.WHATSAPP_TARGET_JID || sock?.user?.id;
  if (!target) {
    console.log("ℹ️ Last.fm polling skipped (no LASTFM_TARGET_JID, WHATSAPP_TARGET_JID or bot self chat)");
    return;
  }

  stopLastfmPolling();
  lastNowPlayingKey = null;
  console.log(`🎧 Last.fm polling started (every ${env.LASTFM_POLL_INTERVAL / 1000}s) → ${target}`);

  pollLastfm(sock, target).catch((error) =>
    console.error("Last.fm poll error:", error.message)
  );
  lastfmPollTimer = setInterval(() => {
    pollLastfm(sock, target).catch((error) =>
      console.error("Last.fm poll error:", error.message)
    );
  }, env.LASTFM_POLL_INTERVAL);
}

async function handleLastfmCommand(sock, jid, text) {
  if (text.toLowerCase().trim() !== ".lfm") return false;

  if (!hasLastfmConfig()) {
    await sock.sendMessage(jid, {
      text: [
        "❌ Last.fm not configured.",
        "Set LASTFM_API_KEY and LASTFM_USERNAME in .env, then restart the bot.",
        `🔗 Spotify scrobbling setup: ${env.LASTFM_SCROBBLING_URL}`,
      ].join("\n"),
    });
    return true;
  }

  try {
    const tracks = await getRecentTracks(10);
    await sock.sendMessage(jid, { text: formatRecentTracks(tracks) });
  } catch (error) {
    console.error("Last.fm recent tracks error:", error.message);
    await sock.sendMessage(jid, { text: `❌ Last.fm error: ${error.message}` });
  }
  return true;
}

module.exports = {
  getRecentTracks,
  handleLastfmCommand,
  startLastfmPolling,
  stopLastfmPolling,
  formatRecentTracks,
  formatNowPlaying,
};

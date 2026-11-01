// features/lastfm.js
const env = require("../config");
const state = require("../state");
const { incrementStat } = require("../db");

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
let lastfmPollTimer = null;
let lastNowPlayingKey = null;
let lastTrackWasNowPlaying = false;
let pollSock = null;

function hasLastfmConfig() {
  return Boolean(env.LASTFM_API_KEY && env.LASTFM_USERNAME);
}

function normalizeJid(value) {
  if (!value) return value;
  if (String(value).includes("@")) return value;
  const digits = String(value).replace(/\D/g, "");
  return digits ? digits + "@s.whatsapp.net" : value;
}

function pollIntervalMs() {
  const n = Number(env.LASTFM_POLL_INTERVAL);
  return Number.isFinite(n) && n >= 5000 ? n : 15000;
}

async function lastfmRequest(params) {
  const query = new URLSearchParams({
    ...params,
    api_key: env.LASTFM_API_KEY,
    format: "json",
  });
  query.set("_", String(Date.now()));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  let data;
  try {
    response = await fetch(LASTFM_API_URL + "?" + query.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "whatsapp-ai-bot/1.0" },
    });
    data = await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Last.fm API timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || data.error) {
    throw new Error(
      data.message || "Last.fm API error (" + (response && response.status) + ")"
    );
  }
  return data;
}

async function getRecentTracks(limit = 10) {
  if (!hasLastfmConfig()) {
    throw new Error("Last.fm API key or username missing");
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const data = await lastfmRequest({
    method: "user.getrecenttracks",
    user: env.LASTFM_USERNAME,
    limit: String(safeLimit),
    extended: "1",
  });
  const tracks = data?.recenttracks?.track || [];
  return Array.isArray(tracks) ? tracks : tracks ? [tracks] : [];
}

function isNowPlaying(track) {
  if (!track) return false;
  const flag = track["@attr"] && track["@attr"].nowplaying;
  return flag === "true" || flag === true || flag === "1";
}

function normaliseTrack(track) {
  const artist =
    typeof track?.artist === "string"
      ? track.artist
      : track?.artist?.["#text"] || track?.artist?.name || "";
  const images = Array.isArray(track?.image) ? track.image : [];
  return {
    name: track?.name || "Unknown track",
    artist: artist || "Unknown artist",
    album:
      track?.album?.["#text"] ||
      (typeof track?.album === "string" ? track.album : "") ||
      "",
    url: track?.url || null,
    image:
      images.find((i) => i.size === "extralarge")?.["#text"] ||
      images.find((i) => i.size === "large")?.["#text"] ||
      images.find((i) => i.size === "medium")?.["#text"] ||
      null,
    nowPlaying: isNowPlaying(track),
    playedAt: track?.date?.uts
      ? new Date(Number(track.date.uts) * 1000)
      : null,
  };
}

function trackKey(track) {
  const item = normaliseTrack(track);
  return (item.artist + "::" + item.name).toLowerCase();
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
    "🎧 *" + env.LASTFM_USERNAME + " — Last.fm Recent*",
    "",
  ];
  tracks.slice(0, 10).forEach((raw, index) => {
    const t = normaliseTrack(raw);
    lines.push(
      index + 1 + ". " + (t.nowPlaying ? "▶️" : "🎵") + " *" + t.name + "*"
    );
    lines.push(
      "   🎤 " + t.artist + (t.album ? " · 💿 " + t.album : "")
    );
    lines.push("   ⏰ " + formatDate(t.playedAt));
    lines.push("");
  });
  return lines.join("\n");
}

function formatNowPlaying(track) {
  const item = normaliseTrack(track);
  let message =
    "🎧 *Now playing on " + env.LASTFM_USERNAME + "'s Last.fm*\n\n";
  message += "🎵 *" + item.name + "*\n🎤 " + item.artist;
  if (item.album) message += "\n💿 " + item.album;
  if (item.url) message += "\n🔗 " + item.url;
  return { text: message, image: item.image };
}

async function sendNowPlaying(sock, target, track) {
  const message = formatNowPlaying(track);
  if (message.image) {
    await sock.sendMessage(target, {
      image: { url: message.image },
      caption: message.text,
    });
  } else {
    await sock.sendMessage(target, { text: message.text });
  }
  state.totalSent++;
  try {
    incrementStat("lastfm_updates");
  } catch (e) {}
}

async function pollLastfm(sock, target) {
  if (!hasLastfmConfig()) return;
  if (!state.isConnected) return;

  const activeSock = sock || pollSock || state.sock;
  if (!activeSock) return;

  const tracks = await getRecentTracks(5);
  if (!tracks.length) {
    console.log("ℹ️ Last.fm: no tracks returned");
    return;
  }

  const first = tracks[0];
  console.log(
    "🐞 Last.fm[0]:",
    first?.name,
    "| @attr=",
    JSON.stringify(first?.["@attr"] || null),
    "| nowPlaying=",
    isNowPlaying(first)
  );

  const nowPlayingTrack = tracks.find(isNowPlaying);

  if (!nowPlayingTrack) {
    if (lastNowPlayingKey === null) {
      lastNowPlayingKey = trackKey(first);
      lastTrackWasNowPlaying = false;
      console.log(
        "ℹ️ Last.fm baseline (not playing):",
        normaliseTrack(first).name
      );
    }
    lastTrackWasNowPlaying = false;
    return;
  }

  const key = trackKey(nowPlayingTrack);
  const item = normaliseTrack(nowPlayingTrack);

  if (key === lastNowPlayingKey && lastTrackWasNowPlaying) {
    return;
  }

  try {
    await sendNowPlaying(activeSock, target, nowPlayingTrack);
    lastNowPlayingKey = key;
    lastTrackWasNowPlaying = true;
    console.log(
      "🎵 Last.fm now-playing sent →",
      target,
      ":",
      item.name
    );
  } catch (err) {
    console.error("Last.fm send error:", err.message);
  }
}

function stopLastfmPolling() {
  if (lastfmPollTimer) clearInterval(lastfmPollTimer);
  lastfmPollTimer = null;
  pollSock = null;
}

function startLastfmPolling(sock) {
  if (!hasLastfmConfig()) {
    console.log(
      "ℹ️ Last.fm polling skipped (set LASTFM_API_KEY and LASTFM_USERNAME)"
    );
    return;
  }

  const target = normalizeJid(
    env.LASTFM_TARGET_JID || env.WHATSAPP_TARGET_JID || sock?.user?.id
  );
  if (!target) {
    console.log(
      "ℹ️ Last.fm polling skipped (set LASTFM_TARGET_JID or WHATSAPP_TARGET_JID)"
    );
    return;
  }

  stopLastfmPolling();
  pollSock = sock || state.sock;
  lastNowPlayingKey = null;
  lastTrackWasNowPlaying = false;

  const interval = pollIntervalMs();
  console.log(
    "🎧 Last.fm polling started (every " +
      interval / 1000 +
      "s) → " +
      target +
      " | user=" +
      env.LASTFM_USERNAME
  );

  pollLastfm(pollSock, target).catch((err) =>
    console.error("Last.fm poll error:", err.message)
  );

  lastfmPollTimer = setInterval(() => {
    pollLastfm(pollSock, target).catch((err) =>
      console.error("Last.fm poll error:", err.message)
    );
  }, interval);
}

async function handleLastfmCommand(sock, jid, text) {
  if (text.toLowerCase().trim() !== ".lfm") return false;

  if (!hasLastfmConfig()) {
    await sock.sendMessage(jid, {
      text: [
        "❌ Last.fm not configured.",
        "Set LASTFM_API_KEY and LASTFM_USERNAME in .env, then restart.",
      ].join("\n"),
    });
    return true;
  }

  try {
    const tracks = await getRecentTracks(10);
    console.log("📡 Last.fm returned", tracks.length, "track(s)");
    if (!tracks.length) {
      await sock.sendMessage(jid, {
        text: "❌ No recent tracks. Scrobbling on unda check cheyyi.",
      });
      return true;
    }
    await sock.sendMessage(jid, { text: formatRecentTracks(tracks) });
    state.totalSent++;
    try {
      incrementStat("messages_sent");
    } catch (e) {}
  } catch (error) {
    console.error("Last.fm recent tracks error:", error.message);
    await sock.sendMessage(jid, {
      text: "❌ Last.fm error: " + error.message,
    });
  }
  return true;
}

module.exports = {
  getRecentTracks,
  handleLastfmCommand,
  startLastfmPolling,
  stopLastfmPolling,
  pollLastfm,
  formatRecentTracks,
  formatNowPlaying,
};

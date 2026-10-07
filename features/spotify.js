// features/spotify.js
const env = require("../config");
const state = require("../state");
const { incrementStat } = require("../db");

const JUNK_KEYWORDS = [
  "advertisement", "sponsored", "promo", "u.s. polo", "us polo",
  "ad ", " ad", "spotify", "patreon",
];

let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;
let lastSpotifyTrackId = null;
let spotifyPollTimer = null;

async function getSpotifyAccessToken() {
  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry - 60000) {
    return spotifyAccessToken;
  }
  if (!env.SPOTIFY_REFRESH_TOKEN || !env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify credentials missing");
  }

  const basic = Buffer.from(
    `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  spotifyAccessToken = data.access_token;
  spotifyTokenExpiry = Date.now() + data.expires_in * 1000;
  if (data.refresh_token) env.SPOTIFY_REFRESH_TOKEN = data.refresh_token;
  return spotifyAccessToken;
}

async function getCurrentlyPlayingSpotify() {
  const token = await getSpotifyAccessToken();
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 204) return null;
  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.item) return null;

  const name = (data.item.name || "").trim();
  const artists = (data.item.artists || []).map((a) => a.name).join(", ");
  const album = data.item.album?.name || "";

  const combined = `${name} ${artists} ${album}`.toLowerCase();
  if (JUNK_KEYWORDS.some((k) => combined.includes(k))) return null;

  return {
    id: data.item.id,
    name,
    artists,
    album,
    isPlaying: data.is_playing,
    image: data.item.album?.images?.[0]?.url || null,
    url: data.item.external_urls?.spotify || null,
  };
}

// ======================================================
// RICH MESSAGE FORMAT (date + time + random emojis)
// ======================================================

const MUSIC_EMOJIS = [
  "🎵", "🎶", "🎧", "🎤", "🎼", "🎹",
  "🎸", "🥁", "🎷", "🎺", "💿", "🔊", "📻",
];

function randomEmoji() {
  return MUSIC_EMOJIS[Math.floor(Math.random() * MUSIC_EMOJIS.length)];
}

function formatTrackMessage(track) {
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

  const userName = env.SPOTIFY_USER_NAME || "Madhu";

  let msg = `${randomEmoji()} *A song is being played by ${userName} on Spotify* ${randomEmoji()}\n\n`;
  msg += `🎵 *${track.name}*\n`;
  msg += `🎤 ${track.artists}\n`;
  if (track.album) msg += `💿 ${track.album}\n`;
  msg += `\n📅 ${date}\n`;
  msg += `⏰ ${time} ${randomEmoji()}`;
  return msg;
}

function stopMusicPolling() {
  if (spotifyPollTimer) clearInterval(spotifyPollTimer);
  spotifyPollTimer = null;
}

async function startMusicPolling() {
  if (!env.WHATSAPP_TARGET_JID) {
    console.log("ℹ️  Music polling skipped (no WHATSAPP_TARGET_JID)");
    return;
  }
  if (!env.SPOTIFY_REFRESH_TOKEN) {
    console.log("ℹ️  Music polling skipped (no Spotify refresh token)");
    return;
  }

  stopMusicPolling();
  console.log(
    `🎧 Spotify polling started (every ${env.SPOTIFY_POLL_INTERVAL / 1000}s) → ${env.WHATSAPP_TARGET_JID}`
  );

  spotifyPollTimer = setInterval(async () => {
    try {
      if (!state.sock || !state.isConnected) return;

      const track = await getCurrentlyPlayingSpotify();
      if (!track || !track.isPlaying) return;
      if (track.id === lastSpotifyTrackId) return;

      lastSpotifyTrackId = track.id;

      // If image available → send with album art
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

      incrementStat("spotify_updates");
      console.log("🎵 Music update sent:", track.name);
    } catch (err) {
      console.error("Music poll error:", err.message);
    }
  }, env.SPOTIFY_POLL_INTERVAL);
}

module.exports = {
  getSpotifyAccessToken,
  getCurrentlyPlayingSpotify,
  startMusicPolling,
  stopMusicPolling,
};

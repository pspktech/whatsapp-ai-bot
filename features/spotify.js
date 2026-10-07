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

  return { id: data.item.id, name, artists, album, isPlaying: data.is_playing };
}

function formatTrackMessage(track) {
  let msg = `🎧 Ippudu vintunna:\n\n`;
  msg += `🎵 *${track.name}*\n`;
  msg += `🎤 ${track.artists}\n`;
  if (track.album) msg += `💿 ${track.album}`;
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
      await state.sock.sendMessage(env.WHATSAPP_TARGET_JID, {
        text: formatTrackMessage(track),
      });
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

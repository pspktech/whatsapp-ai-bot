const env = require("../config");
const state = require("../state");
const { incrementStat } = require("../db");

let pollTimer = null;
let lastTrackId = null; // 👈 Idi chala important (Repeated messages aapadaniki)

const JUNK_KEYWORDS = [
  "advertisement", "sponsored", "promo", "u.s. polo", 
  "us polo", "ad ", " ad", "spotify", "patreon"
];

async function getCurrentlyPlayingLastfm() {
  if (!env.LASTFM_API_KEY || !env.LASTFM_USERNAME) return null;

  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${env.LASTFM_USERNAME}&api_key=${env.LASTFM_API_KEY}&format=json&limit=1`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const tracks = data?.recenttracks?.track;
  if (!tracks || !tracks.length) return null;

  const track = Array.isArray(tracks) ? tracks[0] : tracks;
  const nowPlaying = track["@attr"]?.nowplaying === "true";
  if (!nowPlaying) return null;

  const name = (track.name || "").trim();
  const artist = (track.artist?.["#text"] || "").trim();
  const album = (track.album?.["#text"] || "").trim();

  const combined = `${name} ${artist} ${album}`.toLowerCase();
  if (JUNK_KEYWORDS.some((k) => combined.includes(k))) return null;
  if (name.length < 2) return null;

  return {
    id: `${name}-${artist}`, // Unique ID
    name,
    artists: artist,
    album,
    isPlaying: true,
  };
}

function formatTrackMessage(track) {
  let msg = `🎧 Ippudu vintunna:\n\n`;
  msg += `🎵 *${track.name}*\n`;
  msg += `🎤 ${track.artists}\n`;
  if (track.album) msg += `💿 ${track.album}`;
  return msg;
}

async function startMusicPolling() {
  if (!env.WHATSAPP_TARGET_JID) {
    console.log("ℹ️  Music polling skipped (no WHATSAPP_TARGET_JID)");
    return;
  }

  if (!env.LASTFM_API_KEY || !env.LASTFM_USERNAME) {
    console.log("ℹ️  Music polling skipped (no Last.fm credentials)");
    return;
  }

  clearInterval(pollTimer);

  console.log(`🎧 Last.fm polling started (every 15s) → ${env.WHATSAPP_TARGET_JID}`);

  pollTimer = setInterval(async () => {
    try {
      if (!state.sock || !state.isConnected) return;

      const track = await getCurrentlyPlayingLastfm();
      if (!track || !track.isPlaying) return;

      // 🚨 IKKADA REPEATED MESSAGES AAGUTAYI 🚨
      if (track.id === lastTrackId) return; 
      
      lastTrackId = track.id;

      // Debug log theesesa, ippudu clean ga untundi
      await state.sock.sendMessage(env.WHATSAPP_TARGET_JID, {
        text: formatTrackMessage(track),
      });

      incrementStat("spotify_updates");
      console.log("🎵 Last.fm now-playing sent →", track.name);
    } catch (err) {
      console.error("Music poll error:", err.message);
    }
  }, 15000);
}

function stopMusicPolling() {
  clearInterval(pollTimer);
}

module.exports = { 
  startLastfmPolling: startMusicPolling, 
  stopLastfmPolling: stopMusicPolling 
};

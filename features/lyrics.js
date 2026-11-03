// features/lyrics.js
const { getLyrics } = require("lyrics-lib");

async function fetchLyrics(artist, title) {
  try {
    // lyrics-lib ki artist and title ivvu
    const lyrics = await getLyrics({
      title: title,
      artist: artist || undefined, // Artist lekapothe undefined pettu
    });
    return lyrics || null;
  } catch (err) {
    console.error("Lyrics fetch error:", err.message);
    return null;
  }
}

module.exports = { fetchLyrics };

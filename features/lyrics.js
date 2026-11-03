// features/lyrics.js
async function fetchLyrics(artist, title) {
  try {
    // Free Lyrics API (No API Key needed)
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url);
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return data.lyrics || null;
  } catch (err) {
    console.error("Lyrics fetch error:", err.message);
    return null;
  }
}

module.exports = { fetchLyrics };

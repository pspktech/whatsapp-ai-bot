// features/lyrics.js
async function fetchLyrics(artist, title) {
  try {
    const query = `${title} ${artist || ""}`.trim();
    
    // 1. JioSaavn lo paata ni search chey
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&api_version=4&ctx=web6dot0&query=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const song = searchData.songs?.data?.[0];
    if (!song) return null;
    
    const songId = song.id;
    
    // 2. Aa paata ki unna Lyrics theesuko
    const lyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&api_version=4&_format=json&_marker=0&lyrics_id=${songId}`;
    const lyricsRes = await fetch(lyricsUrl);
    const lyricsData = await lyricsRes.json();
    
    let lyrics = lyricsData.lyrics;
    if (!lyrics) return null;
    
    // 3. HTML tags (<br>) ni clean chey
    lyrics = lyrics.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    return lyrics;
    
  } catch (err) {
    console.error("Lyrics fetch error:", err.message);
    return null;
  }
}

module.exports = { fetchLyrics };

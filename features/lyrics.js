// features/lyrics.js
async function fetchLyrics(artist, title) {
  try {
    // 1. Paata peru lo unna junk words ni theesey (Lyrical Video, Full Song, etc.)
    const cleanTitle = title.replace(/lyrical|video|song|audio|full|official|music|lyrics/gi, "").trim();
    const cleanArtist = (artist || "").replace(/music|official/gi, "").trim();
    
    const query = `${cleanTitle} ${cleanArtist}`.trim();
    
    // 2. JioSaavn lo search chey
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&api_version=4&ctx=web6dot0&query=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const songs = searchData.songs?.data;
    if (!songs || songs.length === 0) return null;

    // 3. Modati 3 results ni check chey (Oka vela cover song ki lyrics lekapothe, next di theesukovadaniki)
    const topResults = songs.slice(0, 3);

    for (const song of topResults) {
      const songId = song.id;
      const lyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&api_version=4&_format=json&_marker=0&lyrics_id=${songId}`;
      
      const lyricsRes = await fetch(lyricsUrl);
      const lyricsData = await lyricsRes.json();
      
      if (lyricsData && lyricsData.lyrics) {
        // HTML tags clean chey (<br> to \n)
        let lyrics = lyricsData.lyrics.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
        return lyrics;
      }
    }
    
    return null; // 3 results lo edi dorakapothe null return chey
    
  } catch (err) {
    console.error("Lyrics fetch error:", err.message);
    return null;
  }
}

module.exports = { fetchLyrics };

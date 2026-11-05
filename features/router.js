// features/router.js
const fs = require("fs");
const env = require("../config");
const state = require("../state");
const { insertMessage, incrementStat } = require("../db");
const { generateAIReply } = require("./ai");
const { getSupportedUrl, downloadMedia, downloadAudio } = require("./media");
const { handleWeatherCommand } = require("./weather");
const { handleRemindCommand } = require("./reminder");
const { handleYtCommand } = require("./youtube");
const { handleAfkCommand, sendAfkReply, clearAfkIfOwner } = require("./afk");
const { handleAiToggleCommand, isAiEnabled } = require("./ai-toggle");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { handleTruthDareCommand } = require("./truth-dare");
const { handleUtilityCommand } = require("./utility");
const { handleAutoReply } = require("./auto-reply");
const { handleMyAppCommand } = require("./myapp");
const { handleAboutResumeCommand } = require("./about-resume");
const { handleSocialCommand } = require("./social");
const { handleContactCommand } = require("./contact");
const { handleFeedbackCommand } = require("./feedback");
const { handleAiStyleCommand } = require("./ai-style");
const { fetchLyrics } = require("./lyrics");
const { handleMenuCommand } = require("./menu");
const { handleLastfmCommand } = require("./lastfm");
const {
  cacheIncomingMessage,
  handleDeletedMessage,
  handleViewOnceCommand,
} = require("./message-cache");

const queues = new Map();

function enqueue(key, task) {
  const prev = queues.get(key) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    });
  queues.set(key, next);
  return next;
}

function extractMessageText(message) {
  if (!message) return "";
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.ephemeralMessage?.message)
    return extractMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message)
    return extractMessageText(message.viewOnceMessage.message);
  return "";
}

async function processMessage(msg, sessionSock, sessionName) {
  const sock = sessionSock || state.sock;
  const session = sessionName || state.primarySession || "main";
  
  try {
    if (!msg?.message) return;

    const jid = msg.key?.remoteJid;
    if (!jid) return;
    if (await handleDeletedMessage(sock, msg)) return;
    cacheIncomingMessage(msg);
    if (jid.endsWith("@g.us") || jid === "status@broadcast") return;

    const text = extractMessageText(msg.message).trim();
    const isOwner = msg.key?.fromMe;

    if (!text) return;

    // ---- Owner "normal" message → clear AFK ----
    if (isOwner && !text.startsWith(".")) {
      clearAfkIfOwner(text);
      return;
    }

    console.log(`📩 [${session}] ${jid} | ${text}`);
    state.totalReceived++;
    incrementStat("messages_received");

    const lower = text.toLowerCase().trim();

    // ---- View-once save (reply to a view-once image/video with .vv) ----
    if (await handleViewOnceCommand(sock, jid, msg, text)) return;

    // ---- Small utility commands ----
    if (await handleMyAppCommand(sock, jid, text)) return;
    if (await handleAboutResumeCommand(sock, jid, text)) return;
    if (await handleSocialCommand(sock, jid, text)) return;
    if (await handleContactCommand(sock, jid, text)) return;
    if (await handleFeedbackCommand(sock, jid, text)) return;
    if (await handleAiStyleCommand(sock, jid, text)) return;
    if (await handleMenuCommand(sock, jid, text)) return;
    if (await handleLastfmCommand(sock, jid, text)) return;
    if (await handleUtilityCommand(sock, jid, text)) return;

    // ---- Truth or Dare ----
    if (await handleTruthDareCommand(sock, jid, text)) return;

    // ---- Profile Picture command ----
    if (lower === ".pp" || lower.startsWith(".pp ")) {
      if (!sock) return;
      try {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;

        if (ctx?.quotedMessage?.imageMessage) {
          const buffer = await downloadMediaMessage(
            { message: ctx.quotedMessage, key: msg.key },
            "buffer",
            {}
          );
          await sock.updateProfilePicture(sock.user.id, buffer);
          await sock.sendMessage(jid, { text: "✅ Profile picture updated!" });
          state.totalSent++;
          incrementStat("messages_sent");
          return;
        }

        const mentioned = ctx?.mentionedJid?.[0];
        if (mentioned) {
          try {
            const url = await sock.profilePictureUrl(mentioned, "image");
            await sock.sendMessage(jid, { image: { url } });
            state.totalSent++;
            incrementStat("messages_sent");
          } catch {
            await sock.sendMessage(jid, {
              text: "❌ User has no profile picture.",
            });
          }
          return;
        }

        await sock.sendMessage(jid, {
          text: "❌ Reply to an image to set, or mention a user to get their PP.",
        });
      } catch (e) {
        await sock.sendMessage(jid, { text: "❌ Failed: " + e.message });
      }
      return;
    }

    // ---- Weather command ----
    if (lower === "/weather" || lower.startsWith("/weather ")) {
      if (!sock) return;
      await sock.sendPresenceUpdate("composing", jid);
      const reply = await handleWeatherCommand(text);
      await sock.sendMessage(jid, { text: reply });
      state.totalSent++;
      incrementStat("messages_sent");
      return;
    }

    // ---- AI ON/OFF toggle ----
    if (await handleAiToggleCommand(sock, jid, text)) return;

    // ---- AFK command ----
    if (await handleAfkCommand(sock, jid, text)) return;

    // ---- Fixed keyword auto-replies (before AI) ----
    if (!isOwner && (await handleAutoReply(sock, jid, text))) return;

    // ---- YouTube video/audio download ----
    if (
      lower.startsWith(".ytv ") ||
      lower === ".ytv" ||
      lower.startsWith(".yta ") ||
      lower === ".yta"
    ) {
      if (!sock) return;
      try {
        await sock.sendPresenceUpdate("composing", jid);
        const parts = text.slice(1).trim().split(/\s+/);
        const cmd = parts.shift().toLowerCase();
        const args = parts.join(" ");

        const result = await handleYtCommand(cmd, args);
        if (!result) {
          await sock.sendMessage(jid, { text: "❌ Invalid command" });
          return;
        }

        if (result.type === "text") {
          await sock.sendMessage(jid, { text: result.text });
        } else if (result.type === "video") {
          await sock.sendMessage(jid, {
            video: { url: result.filePath },
            caption: result.caption,
            mimetype: "video/mp4",
          });
        } else if (result.type === "audio") {
          await sock.sendMessage(jid, {
            audio: { url: result.filePath },
            mimetype: "audio/mpeg",
            ptt: false,
          });
        }

        if (result.tempDir) {
          try {
            fs.rmSync(result.tempDir, { recursive: true, force: true });
          } catch {}
        }

        state.totalSent++;
        incrementStat("messages_sent");
      } catch (err) {
        console.error("❌ YT ERROR:", err?.message || err);
        incrementStat("errors");
        await sock.sendMessage(jid, {
          text: "❌ Download failed: " + (err?.message || "unknown error"),
        });
      }
      return;
    }

    // ---- Translation command ----
    if (lower.startsWith(".tr ")) {
      const input = text.slice(4).trim();
      const parts = input.split(" to ");
      if (parts.length === 2) {
        try {
          const { translate } = require("@vitalets/google-translate-api");
          const res = await translate(parts[0], { to: parts[1] });
          await sock.sendMessage(jid, {
            text: `🌐 *Translated (${parts[1]}):*\n\n${res.text}`,
          });
          state.totalSent++;
          incrementStat("messages_sent");
        } catch (e) {
          await sock.sendMessage(jid, { text: "❌ Translation failed." });
        }
      } else {
        await sock.sendMessage(jid, { text: "Usage: .tr <text> to <lang>" });
      }
      return;
    }

    // ---- Notes command ----
    if (lower.startsWith(".note ")) {
      const path = "./data/notes.json";
      const input = text.slice(6).trim();
      const args = input.split(" ");
      const action = args[0];
      const content = args.slice(1).join(" ");

      if (!fs.existsSync("./data"))
        fs.mkdirSync("./data", { recursive: true });

      let data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
      if (!data[jid]) data[jid] = [];

      if (action === "add") {
        data[jid].push({ text: content, at: Date.now() });
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
        await sock.sendMessage(jid, { text: "✅ Note saved!" });
      } else if (action === "list") {
        const list = data[jid].map((n, i) => `${i + 1}. ${n.text}`).join("\n");
        await sock.sendMessage(jid, {
          text: `📝 *Your Notes:*\n\n${list || "No notes yet."}`,
        });
      } else if (action === "del") {
        const idx = parseInt(content) - 1;
        if (data[jid][idx]) {
          data[jid].splice(idx, 1);
          fs.writeFileSync(path, JSON.stringify(data, null, 2));
          await sock.sendMessage(jid, { text: "🗑️ Note deleted" });
        }
      }
      state.totalSent++;
      incrementStat("messages_sent");
      return;
    }

    // ---- Reminder command ----
    if (lower.startsWith("/remind ")) {
      if (!sock) return;
      const reply = await handleRemindCommand(jid, text);
      await sock.sendMessage(jid, { text: reply });
      state.totalSent++;
      incrementStat("messages_sent");
      return;
    }

    // ---- Manual song command ----
    if (lower.startsWith("song ")) {
      const songName = text.slice(5).trim();
      if (songName && sock) {
        await sock.sendPresenceUpdate("composing", jid);
        const reply = `🎧 Ippudu vintunna:\n\n🎵 *${songName}*`;
        await sock.sendMessage(jid, { text: reply });
        try {
          insertMessage.run(jid, session, "user", text, Date.now());
          insertMessage.run(jid, session, "assistant", reply, Date.now());
        } catch {}
        state.totalSent++;
        incrementStat("messages_sent");
        return;
      }
    }

    // ---- Social download ----
    const social = getSupportedUrl(text);
    if (social && sock) {
      try {
        await sock.sendPresenceUpdate("composing", jid);
        if (social.type === "audio") {
          const media = await downloadAudio(social.url);
          await sock.sendMessage(jid, {
            audio: { url: media.filePath },
            mimetype: "audio/mpeg",
            ptt: false,
          });
          state.totalSent++;
          incrementStat("media_sent");
          incrementStat("audio_sent");
          fs.rmSync(media.tempDir, { recursive: true, force: true });
          return;
        }
        const media = await downloadMedia(social.url);
        await sock.sendMessage(jid, {
          video: { url: media.filePath },
          caption: "Downloaded media",
        });
        state.totalSent++;
        incrementStat("media_sent");
        fs.rmSync(media.tempDir, { recursive: true, force: true });
        return;
      } catch (error) {
        state.totalErrors++;
        incrementStat("errors");
        console.error("❌ MEDIA ERROR:", error?.message || error);
        await sock.sendMessage(jid, {
          text: "Sorry ra, aa media download cheyyalekapoya 😕",
        });
        return;
      }
    }

    // ---- AFK auto-reply (non-owner) ----
    if (!isOwner && (await sendAfkReply(sock, jid, msg))) return;

    // ---- Lyrics Command ----
if (lower.startsWith(".lyrics")) {
  const query = text.slice(7).trim();
  let artist, title;

  if (!query) {
    // User just .lyrics ani adigadu, so currently playing song theesukundam
    if (state.lastPlayedSong) {
      artist = state.lastPlayedSong.artist;
      title = state.lastPlayedSong.title;
    } else {
      await sock.sendMessage(jid, { text: "❌ Ee paata peru cheppu ra. Example: `.lyrics Arijit Singh - Kesariya`" });
      return;
    }
  } else {
    // User "Artist - Title" format lo isthe
    const parts = query.split("-");
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join("-").trim();
    } else {
      // Oka vela artist cheppakapothe, search query ni title ga theesukuntunnam
      title = query;
      artist = ""; 
    }
  }

  await sock.sendPresenceUpdate("composing", jid);
  
  // Lyrics fetch cheddam
  const lyrics = await fetchLyrics(artist, title);

  if (!lyrics) {
    await sock.sendMessage(jid, { text: `❌ Sorry ra, *${title}* lyrics dorakaledu.` });
    return;
  }

  // WhatsApp message limit 65,000 chars, kaani manam konchem trim cheddam
  let formattedLyrics = `🎵 *Lyrics: ${title}* 🎵\n\n${lyrics}`;
  if (formattedLyrics.length > 3000) {
    formattedLyrics = formattedLyrics.slice(0, 3000) + "\n\n... (Lyrics chala peddaga undi, ikkade aagipoyindi)";
  }

  await sock.sendMessage(jid, { text: formattedLyrics });
  state.totalSent++;
  incrementStat("messages_sent");
  return;
}
    
    // ---- AI reply ----
    if (isOwner) return;
    if (!isAiEnabled()) return;
    if (!sock) return;

    await sock.sendPresenceUpdate("composing", jid);

    let reply;
    try {
      reply = await generateAIReply(jid, text, session);
    } catch (err) {
      console.error("❌ AI error:", err.message);
      reply = "Hmm... em ayyindhi ra? 🥺";
    }

    if (!reply) reply = "Hmm... cheppu 🥺";

    const delay = Math.min(1800, Math.max(500, reply.length * 18));
    await new Promise((r) => setTimeout(r, delay));
    
    await sock.sendMessage(jid, { text: reply });

    state.totalSent++;
    incrementStat("messages_sent");

  } catch (error) {
    state.totalErrors++;
    incrementStat("errors");
    console.error(`[${session}] Message error:`, error.message);
  }
}

module.exports = { processMessage, enqueue };

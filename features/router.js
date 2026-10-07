// features/router.js
const fs = require("fs");
const env = require("../config");
const state = require("../state");
const { insertMessage, incrementStat } = require("../db");
const { generateAIReply } = require("./ai");
const { getSupportedUrl, downloadMedia, downloadAudio } = require("./media");
const { handleWeatherCommand } = require("./weather");
const { handleRemindCommand } = require("./reminder");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const queues = new Map();

function enqueue(jid, task) {
  const prev = queues.get(jid) || Promise.resolve();
  const next = prev.catch(() => {}).then(task).finally(() => {
    if (queues.get(jid) === next) queues.delete(jid);
  });
  queues.set(jid, next);
  return next;
}

function extractMessageText(message) {
  if (!message) return "";
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.ephemeralMessage?.message) return extractMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractMessageText(message.viewOnceMessage.message);
  return "";
}

async function processMessage(msg) {
  const sock = state.sock;
  try {
    if (!msg?.message) return;

    const jid = msg.key?.remoteJid;
    if (!jid) return;
    if (jid.endsWith("@g.us") || jid === "status@broadcast") return;

    const text = extractMessageText(msg.message).trim();
    const isOwner = msg.key?.fromMe;

    // Owner పంపిన మెసేజ్ అయినా, "." తో మొదలైతే process చేయి
    // (మిగతావి ignore — infinite loop ఆపడానికి)
    if (isOwner && !text.startsWith(".")) return;

    if (!text) return;

    console.log("📩 JID:", jid, "| Msg:", text);
    state.totalReceived++;
    incrementStat("messages_received");

    if (env.WHATSAPP_TARGET_JID && jid === env.WHATSAPP_TARGET_JID) return;

    const lower = text.toLowerCase().trim();

    // ---- Profile Picture command ----
    if (lower === ".pp" || lower.startsWith(".pp ")) {
      if (!sock) return;
      try {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;

        // కేస్ 1: ఫోటోకి రిప్లై ఇచ్చి బోట్ PP సెట్ చేయడం
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

        // కేస్ 2: మెన్షన్ చేసిన యూజర్ PP తీసుకోవడం
        const mentioned = ctx?.mentionedJid?.[0];
        if (mentioned) {
          try {
            const url = await sock.profilePictureUrl(mentioned, "image");
            await sock.sendMessage(jid, { image: { url } });
            state.totalSent++;
            incrementStat("messages_sent");
          } catch {
            await sock.sendMessage(jid, { text: "❌ User has no profile picture." });
          }
          return;
        }

        // కేస్ 3: ఏదీ లేకపోతే
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

    // ---- Translation command ----
    if (lower.startsWith(".tr ")) {
      const input = text.slice(4).trim();
      const parts = input.split(" to ");
      if (parts.length === 2) {
        try {
          const { translate } = require("@vitalets/google-translate-api");
          const res = await translate(parts[0], { to: parts[1] });
          await sock.sendMessage(jid, { text: `🌐 *Translated (${parts[1]}):*\n\n${res.text}` });
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

      if (!fs.existsSync("./data")) fs.mkdirSync("./data", { recursive: true });

      let data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
      if (!data[jid]) data[jid] = [];

      if (action === "add") {
        data[jid].push({ text: content, at: Date.now() });
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
        await sock.sendMessage(jid, { text: "✅ Note saved!" });
      } else if (action === "list") {
        const list = data[jid].map((n, i) => `${i + 1}. ${n.text}`).join("\n");
        await sock.sendMessage(jid, { text: `📝 *Your Notes:*\n\n${list || "No notes yet."}` });
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
        insertMessage.run(jid, "user", text, Date.now());
        insertMessage.run(jid, "assistant", reply, Date.now());
        state.totalSent++;
        incrementStat("messages_sent");
        incrementStat("spotify_updates");
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

    // ---- AI reply ----
    // Owner పంపిన "." commands కి AI reply వద్దు
    if (isOwner) return;

    if (!sock) return;
    await sock.sendPresenceUpdate("composing", jid);
    const reply = await generateAIReply(jid, text);
    const delay = Math.min(1800, Math.max(500, reply.length * 18));
    await new Promise((r) => setTimeout(r, delay));
    await sock.sendMessage(jid, { text: reply });
    state.totalSent++;
    incrementStat("messages_sent");
  } catch (error) {
    state.totalErrors++;
    incrementStat("errors");
    console.error("Message error:", error.message);
  }
}

module.exports = { processMessage, enqueue };

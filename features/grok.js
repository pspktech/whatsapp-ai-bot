// features/grok.js
const env = require("../config");
const { incrementStat } = require("../db");

function hasGrokConfig() {
  return Boolean(env.XAI_API_KEY);
}

function extractResponseText(response) {
  if (response?.output_text) return response.output_text.trim();

  const parts = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

async function askGrok(question) {
  if (!hasGrokConfig()) {
    throw new Error("XAI_API_KEY missing");
  }

  const response = await fetch(`${env.XAI_BASE_URL || "https://api.x.ai/v1"}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
    model: env.XAI_MODEL || "grok-4.7",
    input: [
      {
        role: "system",
        content:
          "You are Grok, a helpful WhatsApp enquiry assistant. Answer clearly and briefly. Use web search for current, changing, or factual questions. If sources are available, mention them briefly.",
      },
      { role: "user", content: question },
    ],
    tools: [{ type: "web_search" }],
    max_output_tokens: 800,
    }),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw Object.assign(
      new Error(data?.error?.message || `xAI API error (${response.status})`),
      { status: response.status, code: data?.error?.code }
    );
  }

  const answer = extractResponseText(data);
  if (!answer) throw new Error("Grok returned an empty response");
  return answer;
}

async function handleGrokCommand(sock, jid, text) {
  const match = text.trim().match(/^\.(?:grok|ask)(?:\s+([\s\S]+))?$/i);
  if (!match) return false;

  const question = match[1]?.trim();
  if (!question) {
    await sock.sendMessage(jid, {
      text: "Usage: `.grok <your enquiry>`\nExample: `.grok latest AI news`",
    });
    return true;
  }

  if (!hasGrokConfig()) {
    await sock.sendMessage(jid, {
      text: "❌ Grok enquiry setup missing. Add `XAI_API_KEY` in `.env`, then restart the bot.",
    });
    return true;
  }

  try {
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
    const answer = await askGrok(question);
    await sock.sendMessage(jid, { text: `🤖 *Grok Enquiry*\n\n${answer}` });
    incrementStat("grok_replies");
  } catch (error) {
    console.error("Grok enquiry error:", {
      status: error?.status || "unknown",
      code: error?.code || "unknown",
      message: error?.message || String(error),
      model: env.XAI_MODEL || "grok-4.7",
    });
    await sock.sendMessage(jid, {
      text: "❌ Grok enquiry failed. Check `XAI_API_KEY`, model config, and account credits.",
    });
  }
  return true;
}

module.exports = { askGrok, handleGrokCommand, hasGrokConfig };

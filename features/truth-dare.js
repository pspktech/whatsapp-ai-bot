// features/truth-dare.js
const state = require("../state");
const { incrementStat } = require("../db");

const TRUTHS = [
  "Nee phone lo last search enti?",
  "Evarini secretly miss avtunnav?",
  "Nee biggest red flag enti?",
  "Last time eppudu lie cheppav?",
  "Ninnu ekkuva ga hurt chesina matter enti?",
  "Ippudu immediate ga ekkadiki vellali anipistundi?",
  "Nee secret talent enti?",
  "Evaritho one day swap avvali anukuntav?",
];

const DARES = [
  "5 seconds voice note lo nee favourite dialogue cheppu.",
  "Next message lo only three emojis use cheyyi.",
  "Nee gallery lo third photo describe cheyyi.",
  "Oka funny selfie pampu.",
  "10 seconds dance chesi video pampu.",
  "Nuvvu recently vinnina song lo one line type cheyyi.",
  "Nannu one line lo roast cheyyi.",
  "Caps lock lo 'Nenu challenge accept chesa' ani pampu.",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function handleTruthDareCommand(sock, jid, text) {
  const lower = text.toLowerCase().trim();
  if (![".truth", ".dare", ".truthordare", ".truth or dare", ".tod"].includes(lower)) {
    return false;
  }
  const choice = lower.includes("dare") || lower === ".dare" ? "DARE" : "TRUTH";
  const prompt = choice === "DARE" ? pick(DARES) : pick(TRUTHS);
  await sock.sendMessage(jid, { text: `🎲 *${choice}*\n\n${prompt}` });
  state.totalSent++;
  incrementStat("messages_sent");
  return true;
}

module.exports = { handleTruthDareCommand };

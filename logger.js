const util = require("util");

const NOISE_PATTERNS = [
  "Failed to decrypt",
  "Bad MAC",
  "Session error",
  "MessageCounterError",
  "libsignal",
  "session_cipher",
  "sessioncipher",
  "queue_job",
  "Decrypted message with closed session",
  "Closing session:",
  "closing session:",
  "Removing old closed session",
  "removing old closed session",
  "SessionEntry",
  "sessionentry",
  "_chains:",
  "registrationId:",
  "currentRatchet:",
  "ephemeralKeyPair:",
  "lastRemoteEphemeralKey:",
  "indexInfo:",
  "pendingPreKey:",
  "rootKey:",
  "baseKey:",
  "remoteIdentityKey:",
  "pubKey: <Buffer",
  "privKey: <Buffer",
  "signedKeyId:",
  "preKeyId:",
  "previousCounter:",
  "chainKey:",
  "chainType:",
  "messageKeys:",
  "baseKeyType:"
];

function isNoise(msg) {
  if (typeof msg !== "string") {
    try {
      msg = util.inspect(msg, { depth: 0 });
    } catch {
      return false;
    }
  }
  const lowerMsg = msg.toLowerCase();
  return NOISE_PATTERNS.some((p) => lowerMsg.includes(p.toLowerCase()));
}

// 1. Console Filter
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (isNoise(args.map(String).join(" "))) return;
  originalConsoleError(...args);
};

const originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
  if (isNoise(args.map(String).join(" "))) return;
  originalConsoleLog(...args);
};

// 2. Raw Terminal Output Filter (Baileys bypass aapadaniki)
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  if (isNoise(chunk.toString())) return true;
  return originalStdoutWrite(chunk, encoding, callback);
};

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => {
  if (isNoise(chunk.toString())) return true;
  return originalStderrWrite(chunk, encoding, callback);
};

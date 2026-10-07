// logger.js — suppress noisy Baileys/libsignal logs
const util = require("util");

const NOISE_PATTERNS = [
  "Failed to decrypt", "Bad MAC", "Session error", "MessageCounterError",
  "libsignal", "session_cipher", "sessioncipher", "queue_job",
  "Decrypted message with closed session", "Closing session:", "closing session:",
  "Removing old closed session", "removing old closed session",
  "SessionEntry", "sessionentry", "_chains:", "registrationId:",
  "currentRatchet:", "ephemeralKeyPair:", "lastRemoteEphemeralKey:",
  "indexInfo:", "pendingPreKey:", "rootKey:", "baseKey:",
  "remoteIdentityKey:", "pubKey: <Buffer", "privKey: <Buffer",
  "signedKeyId:", "preKeyId:", "previousCounter:", "chainKey:",
  "chainType:", "messageKeys:", "baseKeyType:",
];

function isNoise(args) {
  try {
    const full = args
      .map((a) => {
        if (a == null) return "";
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.message || "";
        if (Buffer.isBuffer(a)) return "";
        if (typeof a === "object") {
          const ctor = a.constructor?.name || "";
          if (
            ctor.includes("Session") || ctor.includes("Entry") ||
            ctor.includes("Cipher") || ctor.includes("Ratchet")
          ) return "SessionEntry";
          if (a._chains || a.registrationId || a.currentRatchet ||
              a.indexInfo || a.pendingPreKey) return "SessionEntry";
        }
        try { return util.inspect(a, { depth: 0, breakLength: Infinity }); }
        catch { return ""; }
      })
      .join(" ")
      .toLowerCase();

    return NOISE_PATTERNS.some((p) => full.includes(p.toLowerCase()));
  } catch {
    return false;
  }
}

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

console.log = (...a) => { if (!isNoise(a)) _log(...a); };
console.warn = (...a) => { if (!isNoise(a)) _warn(...a); };
console.error = (...a) => { if (!isNoise(a)) _error(...a); };

// ============= RAW STDOUT/STDERR FILTER =============
const _stdoutWrite = process.stdout.write.bind(process.stdout);
const _stderrWrite = process.stderr.write.bind(process.stderr);

function shouldSkip(str) {
  if (typeof str !== "string") return false;
  const s = str.toLowerCase();
  return NOISE_PATTERNS.some((p) => s.includes(p.toLowerCase()));
}

process.stdout.write = (chunk, ...rest) => {
  const s = typeof chunk === "string" ? chunk : chunk.toString();
  if (shouldSkip(s)) return true;
  return _stdoutWrite(chunk, ...rest);
};

process.stderr.write = (chunk, ...rest) => {
  const s = typeof chunk === "string" ? chunk : chunk.toString();
  if (shouldSkip(s)) return true;
  return _stderrWrite(chunk, ...rest);
};

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
  "baseKeyType:",
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
            ctor.includes("Session") ||
            ctor.includes("Entry") ||
            ctor.includes("Cipher") ||
            ctor.includes("Ratchet")
          ) {
            return "SessionEntry";
          }
          if (
            a._chains ||
            a.registrationId ||
            a.currentRatchet ||
            a.indexInfo ||
            a.pendingPreKey
          ) {
            return "SessionEntry";
          }
        }
        try {
          return util.inspect(a, { depth: 0, breakLength: Infinity });
        } catch {
          return "";
        }
      })
      .join(" ")
      .toLowerCase();

    return NOISE_PATTERNS.some((p) => full.includes(p.toLowerCase()));
  } catch {
    return false;
  }
}

function installLoggerFilter() {
  const origError = console.error.bind(console);
  console.error = (...args) => {
    if (isNoise(args)) return;
    origError(...args);
  };

  const origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    if (isNoise(args)) return;
    origWarn(...args);
  };

  const origLog = console.log.bind(console);
  console.log = (...args) => {
    if (isNoise(args)) return;
    origLog(...args);
  };
}

module.exports = { isNoise, installLoggerFilter };

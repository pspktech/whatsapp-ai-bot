// state.js — shared mutable state
module.exports = {
  sock: null,
  isConnected: false,
  isStarting: false,
  aiEnabled: true,
  afk: false,
  afkReason: "",
  afkSince: 0,
  reconnectTimer: null,
  startedAt: Date.now(),
  totalReceived: 0,
  totalSent: 0,
  totalErrors: 0,
};

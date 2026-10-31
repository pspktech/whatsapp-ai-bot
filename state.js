// state.js — shared mutable state
module.exports = {
  sock: null,
  sockets: null,
  primarySession: null,
  sessionStatus: new Map(),
  isConnected: false,
  isStarting: false,
  aiEnabled: true,
  aiStyles: new Map(),
  afk: false,
  afkReason: "",
  afkSince: 0,
  reconnectTimer: null,
  startedAt: Date.now(),
  totalReceived: 0,
  totalSent: 0,
  totalErrors: 0,
};

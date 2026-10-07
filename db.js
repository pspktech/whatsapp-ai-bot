// db.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "assistant.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (jid, role, content, created_at)
  VALUES (?, ?, ?, ?)
`);

const getHistory = db.prepare(`
  SELECT role, content FROM messages
  WHERE jid = ? ORDER BY id DESC LIMIT ?
`);

function incrementStat(key) {
  db.prepare(`
    INSERT INTO stats(key, value) VALUES (?, 1)
    ON CONFLICT(key) DO UPDATE SET value = value + 1
  `).run(key);
}

function getStat(key) {
  const row = db.prepare("SELECT value FROM stats WHERE key = ?").get(key);
  return row ? row.value : 0;
}

module.exports = { DATA_DIR, db, insertMessage, getHistory, incrementStat, getStat };

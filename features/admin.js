// features/admin.js
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const env = require("../config");
const state = require("../state");
const { db, getStat } = require("../db");

const adminTokens = new Set();
const SPOTIFY_SCOPES = "user-read-currently-playing user-read-playback-state";

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/spotify/login", (req, res) => {
    const params = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      scope: SPOTIFY_SCOPES,
    });
    res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
  });

  app.get("/spotify/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("❌ No code from Spotify");

    try {
      const basic = Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64");

      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: env.SPOTIFY_REDIRECT_URI,
        }),
      });

      const data = await tokenRes.json();
      if (!data.refresh_token) {
        console.error("Spotify callback error:", data);
        return res.send("❌ No refresh token. Check redirect URI.");
      }

      const envPath = path.join(__dirname, "..", ".env");
      let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

      if (/SPOTIFY_REFRESH_TOKEN=.*/m.test(envText)) {
        envText = envText.replace(
          /SPOTIFY_REFRESH_TOKEN=.*/m,
          `SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`
        );
      } else {
        envText += `\nSPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`;
      }

      fs.writeFileSync(envPath, envText);
      env.SPOTIFY_REFRESH_TOKEN = data.refresh_token;

      res.send(`
        <h2>✅ Spotify connected!</h2>
        <p>Refresh token .env lo save ayyindi.</p>
        <p><b>Restart cheyyi:</b> <code>node index.js</code></p>
      `);
    } catch (err) {
      console.error("Callback error:", err);
      res.send("❌ Error: " + err.message);
    }
  });

  app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html><html><head><title>WhatsApp AI Bot</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial;background:#111;color:white;padding:30px;}
.box{max-width:500px;margin:auto;padding:25px;background:#1d1d1d;border-radius:15px;}
a{color:#4ade80;}</style></head><body>
<div class="box"><h2>WhatsApp AI Bot</h2>
<p>Status: <strong>${state.isConnected ? "ONLINE" : "OFFLINE"}</strong></p>
<p><a href="/admin">Admin Dashboard</a></p></div></body></html>
    `);
  });

  app.get("/admin", (req, res) => {
    res.send(`
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:white;font-family:Arial;}
.card{width:90%;max-width:380px;background:#181b21;padding:25px;border-radius:18px;box-sizing:border-box;}
input{width:100%;box-sizing:border-box;padding:13px;margin:10px 0;border:0;border-radius:10px;background:#252932;color:white;}
button{width:100%;padding:13px;border:0;border-radius:10px;background:#25d366;color:#061006;font-weight:bold;}
</style></head><body>
<div class="card"><h2>Admin Dashboard</h2>
<input id="password" type="password" placeholder="Admin password"/>
<button onclick="login()">Login</button><p id="error"></p></div>
<script>
async function login(){
  const password=document.getElementById("password").value;
  const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
  const d=await r.json();
  if(d.success){localStorage.setItem("admin_token",d.token);location.href="/dashboard";}
  else{document.getElementById("error").innerText="Wrong password";}
}
</script></body></html>
    `);
  });

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (!password || password !== env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false });
    }
    const token = crypto.randomBytes(32).toString("hex");
    adminTokens.add(token);
    res.json({ success: true, token });
  });

  app.get("/api/admin/stats", adminAuth, (req, res) => {
    const uniqueChats = db.prepare("SELECT COUNT(DISTINCT jid) AS count FROM messages").get();
    const messages = db.prepare("SELECT COUNT(*) AS count FROM messages").get();
    res.json({
      online: state.isConnected,
      uptime: Date.now() - state.startedAt,
      received: getStat("messages_received"),
      sent: getStat("messages_sent"),
      aiReplies: getStat("ai_replies"),
      mediaSent: getStat("media_sent"),
      audioSent: getStat("audio_sent"),
      spotifyUpdates: getStat("spotify_updates"),
      errors: getStat("errors"),
      totalDatabaseMessages: messages.count,
      activeChats: uniqueChats.count,
    });
  });

  app.get("/dashboard", (req, res) => {
    res.send(`
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Bot Dashboard</title>
<style>
*{box-sizing:border-box;}
body{margin:0;background:#0f1115;color:white;font-family:Arial;}
header{padding:20px;background:#181b21;border-bottom:1px solid #292d35;}
.container{max-width:900px;margin:auto;padding:20px;}
.status{padding:15px;border-radius:12px;margin-bottom:20px;background:#181b21;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;}
.card{background:#181b21;padding:20px;border-radius:15px;}
.number{font-size:30px;font-weight:bold;margin-top:10px;}
.online{color:#4ade80;}.offline{color:#f87171;}
button{margin-top:20px;padding:12px 20px;border:0;border-radius:10px;cursor:pointer;}
.logout{background:#f87171;color:#111;margin-left:8px;}
</style></head><body>
<header><h2>WhatsApp AI Admin</h2></header>
<div class="container">
<div class="status">Bot Status: <strong id="status">...</strong></div>
<div class="grid">
<div class="card">Messages Received<div class="number" id="received">0</div></div>
<div class="card">Messages Sent<div class="number" id="sent">0</div></div>
<div class="card">AI Replies<div class="number" id="aiReplies">0</div></div>
<div class="card">Active Chats<div class="number" id="activeChats">0</div></div>
<div class="card">Media Sent<div class="number" id="mediaSent">0</div></div>
<div class="card">Audio Sent<div class="number" id="audioSent">0</div></div>
<div class="card">Music Updates<div class="number" id="spotifyUpdates">0</div></div>
<div class="card">Errors<div class="number" id="errors">0</div></div>
<div class="card">DB Messages<div class="number" id="database">0</div></div>
</div>
<button onclick="loadStats()">Refresh</button>
<button class="logout" onclick="logout()">Logout</button>
</div>
<script>
async function loadStats(){
  const t=localStorage.getItem("admin_token");
  if(!t){location.href="/admin";return;}
  const r=await fetch("/api/admin/stats",{headers:{Authorization:"Bearer "+t}});
  if(!r.ok){localStorage.removeItem("admin_token");location.href="/admin";return;}
  const d=await r.json();
  const s=document.getElementById("status");
  s.innerText=d.online?"ONLINE":"OFFLINE";
  s.className=d.online?"online":"offline";
  document.getElementById("received").innerText=d.received;
  document.getElementById("sent").innerText=d.sent;
  document.getElementById("aiReplies").innerText=d.aiReplies;
  document.getElementById("mediaSent").innerText=d.mediaSent;
  document.getElementById("audioSent").innerText=d.audioSent;
  document.getElementById("spotifyUpdates").innerText=d.spotifyUpdates;
  document.getElementById("errors").innerText=d.errors;
  document.getElementById("database").innerText=d.totalDatabaseMessages;
  document.getElementById("activeChats").innerText=d.activeChats;
}
function logout(){localStorage.removeItem("admin_token");location.href="/admin";}
loadStats();setInterval(loadStats,5000);
</script></body></html>
    `);
  });

  return app;
}

module.exports = createApp;

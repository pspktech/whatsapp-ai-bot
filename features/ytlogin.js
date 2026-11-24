// features/ytlogin.js
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "../cookies.txt");

// YouTube login start cheyadam (Device Code isthundi)
async function startYtLogin() {
  return new Promise((resolve, reject) => {
    // --cookies cookies.txt pettadam valla adi automatic ga save avutundi
    const command = `yt-dlp --cookies ${COOKIES_PATH} --username oauth --password "" "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --skip-download`;
    
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error && !stderr.includes("verification_url")) {
        return reject(new Error(stderr || error.message));
      }
      
      // Extract URL and Code from stderr
      const urlMatch = stderr.match(/(https:\/\/www\.google\.com\/device)/);
      const codeMatch = stderr.match(/enter the code:\s*([A-Z0-9-]+)/i);
      
      if (urlMatch && codeMatch) {
        resolve({
          verification_url: urlMatch[0],
          user_code: codeMatch[1]
        });
      } else {
        reject(new Error("Login details dorakaledu."));
      }
    });
  });
}

// Login ayyindo ledo check cheyadam
async function isYtLoggedIn() {
  if (!fs.existsSync(COOKIES_PATH)) return false;
  const stats = fs.statSync(COOKIES_PATH);
  // Cookies file size 100 bytes kanna ekkuva unte login ayyi undochu
  return stats.size > 100;
}

// Logout cheyadam (Cookies delete)
async function clearYtCreds() {
  if (fs.existsSync(COOKIES_PATH)) {
    fs.unlinkSync(COOKIES_PATH);
  }
}

module.exports = { startYtLogin, isYtLoggedIn, clearYtCreds };

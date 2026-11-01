// features/media.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

// Path to cookies file (bot root folder lo undi)
const COOKIES_PATH = path.join(__dirname, "..", "cookies.txt");

// Common yt-dlp args. Cookies are optional; private/login-required media may
// still need a valid cookies.txt file in the project root.
const COMMON_ARGS = [
  "--js-runtimes", "deno",
  "--no-playlist",
  "--no-warnings",
  "--no-progress",
];

if (fs.existsSync(COOKIES_PATH)) {
  COMMON_ARGS.unshift("--cookies", COOKIES_PATH);
}

function getSupportedUrl(text) {
  if (!text) return null;
  const match = text.match(
    /https?:\/\/(?:www\.)?(youtube\.com|youtu\.be|instagram\.com|x\.com|twitter\.com)\/[^\s]+/i
  );
  if (!match) return null;

  const url = match[0].replace(/[),.!?]+$/, "");

  if (
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)/i.test(url) ||
    /instagram\.com\/(reel|p|tv)\//i.test(url) ||
    /(?:x\.com|twitter\.com)\/[^/]+\/status\//i.test(url)
  ) return { url, type: "video" };

  return null;
}

async function downloadMedia(url) {
  const tempDir = path.join(os.tmpdir(), "wa-ai-" + crypto.randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, "media.%(ext)s");

  try {
    await execFileAsync("yt-dlp", [
      ...COMMON_ARGS,
      "-f", "bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/best[ext=mp4]",
      "--merge-output-format", "mp4",
      "--recode-video", "mp4",
      "--max-filesize", "500M",
      "-o", outputTemplate, url,
    ], { timeout: 180000, maxBuffer: 1024 * 1024 * 4 });

    const files = fs.readdirSync(tempDir).filter((f) => f !== "." && f !== "..");
    if (!files.length) throw new Error("Downloaded file not found");

    const filePath = path.join(tempDir, files[0]);
    const stat = fs.statSync(filePath);
    if (!stat.size) throw new Error("Downloaded file is empty");
    if (stat.size > 500 * 1024 * 1024) throw new Error("File > 500MB");

    // Optional: File Manager lo kanipinchadaniki /sdcard/Download ki kuda copy cheyandi
    try {
      const downloadDir = "/sdcard/Download";
      if (fs.existsSync(downloadDir)) {
        fs.copyFileSync(filePath, path.join(downloadDir, files[0]));
        console.log("📁 Saved to /sdcard/Download/" + files[0]);
      }
    } catch (err) {
      console.log("⚠️ Could not copy to /sdcard/Download:", err.message);
    }

    return { filePath, tempDir, size: stat.size };
  } catch (e) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw e;
  }
}

async function downloadAudio(url) {
  const tempDir = path.join(os.tmpdir(), "wa-audio-" + crypto.randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, "audio.%(ext)s");

  try {
    await execFileAsync("yt-dlp", [
      ...COMMON_ARGS,
      "-f", "bestaudio/best", "-x",
      "--audio-format", "mp3", "--audio-quality", "128K",
      "--max-filesize", "32M",
      "-o", outputTemplate, url,
    ], { timeout: 180000, maxBuffer: 1024 * 1024 * 4 });

    const files = fs.readdirSync(tempDir).filter((f) => f !== "." && f !== "..");
    if (!files.length) throw new Error("Audio file not found");

    const filePath = path.join(tempDir, files[0]);
    const stat = fs.statSync(filePath);
    if (!stat.size) throw new Error("Audio file empty");
    if (stat.size > 32 * 1024 * 1024) throw new Error("Audio > 32MB");

    // Optional: File Manager lo kanipinchadaniki
    try {
      const downloadDir = "/sdcard/Download";
      if (fs.existsSync(downloadDir)) {
        fs.copyFileSync(filePath, path.join(downloadDir, files[0]));
        console.log("📁 Saved to /sdcard/Download/" + files[0]);
      }
    } catch (err) {
      console.log("⚠️ Could not copy to /sdcard/Download:", err.message);
    }

    return { filePath, tempDir, size: stat.size };
  } catch (e) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw e;
  }
}

module.exports = { getSupportedUrl, downloadMedia, downloadAudio };

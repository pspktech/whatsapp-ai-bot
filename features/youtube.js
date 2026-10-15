// features/youtube.js
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const COOKIES_PATH = path.join(__dirname, "..", "cookies.txt");

const COMMON_ARGS = [
  "--cookies", COOKIES_PATH,
  "--js-runtimes", "deno",
  "--no-playlist",
  "--no-warnings",
  "--no-progress",
];

const YT_URL_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|v\/)|youtu\.be\/)[-_0-9A-Za-z]{11}[^\s]*/i;

function detectInput(text) {
  if (!text) return null;
  const match = text.match(YT_URL_RE);
  if (match) return { kind: "url", url: match[0].replace(/[),.!?]+$/, "") };
  return { kind: "search", query: text.trim() };
}

async function runYtDlp(args, timeoutMs = 180000) {
  const { stdout, stderr } = await execFileAsync("yt-dlp", args, {
    maxBuffer: 20 * 1024 * 1024,
    timeout: timeoutMs,
  });
  return { stdout, stderr };
}

async function getInfo(input) {
  const target = input.kind === "url" ? input.url : `ytsearch1:${input.query}`;
  const { stdout } = await runYtDlp([
    ...COMMON_ARGS,
    "--dump-single-json",
    "--skip-download",
    target,
  ]);
  const info = JSON.parse(stdout);
  if (info._type === "playlist" && info.entries?.length) return info.entries[0];
  return info;
}

async function downloadVideo(input, quality = "720") {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytv-"));
  const outTpl = path.join(tmpDir, "%(title).80s.%(ext)s");
  const height = parseInt(quality, 10) || 720;
  const format = `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/b[height<=${height}][ext=mp4]/b[height<=${height}]/b`;
  const target = input.kind === "url" ? input.url : `ytsearch1:${input.query}`;

  await runYtDlp([
    ...COMMON_ARGS,
    "-f", format,
    "--merge-output-format", "mp4",
    "-o", outTpl,
    target,
  ]);

  const file = fs.readdirSync(tmpDir).find((f) => !f.endsWith(".part"));
  if (!file) throw new Error("video file not found after download");
  return { filePath: path.join(tmpDir, file), tempDir: tmpDir };
}

async function downloadAudio(input) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yta-"));
  const outTpl = path.join(tmpDir, "%(title).80s.%(ext)s");
  const target = input.kind === "url" ? input.url : `ytsearch1:${input.query}`;

  await runYtDlp([
    ...COMMON_ARGS,
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "192K",
    "-o", outTpl,
    target,
  ]);

  const file = fs.readdirSync(tmpDir).find((f) => f.endsWith(".mp3"));
  if (!file) throw new Error("audio file not found after download");
  return { filePath: path.join(tmpDir, file), tempDir: tmpDir };
}

async function handleYtCommand(command, args) {
  const cmd = command.toLowerCase();

  if (cmd === "ytv") {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    let quality = "720";
    if (parts.length > 1 && /^\d{3,4}$/.test(parts[parts.length - 1])) {
      quality = parts.pop();
    }
    const query = parts.join(" ").trim();
    if (!query) {
      return {
        type: "text",
        text: "Usage: *.ytv <youtube url or song name> [quality]*\nExamples:\n• .ytv https://youtu.be/xxxx\n• .ytv Kesariya 1080",
      };
    }

    const input = detectInput(query);
    const info = await getInfo(input);
    const result = await downloadVideo(input, quality);

    const caption =
      `🎬 *${info.title || "Video"}*\n` +
      `📺 Quality: ${quality}p\n` +
      (info.uploader ? `👤 ${info.uploader}\n` : "");

    return {
      type: "video",
      filePath: result.filePath,
      tempDir: result.tempDir,
      caption,
    };
  }

  if (cmd === "yta") {
    const query = args.trim();
    if (!query) {
      return {
        type: "text",
        text: "Usage: *.yta <youtube url or song name>*\nExamples:\n• .yta https://youtu.be/xxxx\n• .yta Kesariya",
      };
    }

    const input = detectInput(query);
    const info = await getInfo(input);
    const result = await downloadAudio(input);

    const caption =
      `🎵 *${info.title || "Audio"}*\n` +
      (info.uploader ? `👤 ${info.uploader}\n` : "");

    return {
      type: "audio",
      filePath: result.filePath,
      tempDir: result.tempDir,
      caption,
    };
  }

  return null;
}

module.exports = { handleYtCommand };

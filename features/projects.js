// features/projects.js
const PROJECTS = [
  {
    index: "01 — BOT",
    title: "WhatsApp AI Bot",
    category: "AI Automation",
    icon: "💬",
    description: "An AI-powered WhatsApp bot built on Node.js with natural replies, media downloads, utility commands and automation flows.",
    tags: ["Node.js", "Express.js", "AI API", "WhatsApp Web"],
    source: "https://github.com/pspktech/whatsapp-ai-bot",
    live: null,
    featured: false,
  },
  {
    index: "02 — WEBSITE",
    title: "Nandhu Pickles",
    category: "E-Commerce",
    icon: "🫙",
    description: "An e-commerce website for a homemade pickles brand with product showcase, pricing and one-tap WhatsApp ordering.",
    tags: ["HTML", "CSS", "JavaScript", "Netlify"],
    source: null,
    live: "https://nandhupickles.netlify.app",
    featured: false,
  },
  {
    index: "03 — APP",
    title: "MyInstaPro",
    category: "Android App",
    icon: "📱",
    description: "An Android app for downloading Instagram videos, reels, photos and stories without login, ads or tracking.",
    tags: ["Android", "Instagram", "Downloader", "No Watermark"],
    source: null,
    live: "https://t.me/madhupatelpspk",
    featured: true,
  },
  {
    index: "04 — WEBSITE",
    title: "Vigneshwara Youth Group",
    category: "Community",
    icon: "👥",
    description: "A responsive community website for events, member information, photo galleries and announcements.",
    tags: ["HTML", "CSS", "JavaScript", "Netlify"],
    source: null,
    live: "https://teamvya.netlify.app",
    featured: false,
  },
  {
    index: "05 — WEBSITE",
    title: "Homecare",
    category: "Home Services",
    icon: "🏠",
    description: "A modern homecare services website that guides visitors from service discovery to the next action.",
    tags: ["Web App", "Responsive UI", "Vercel"],
    source: null,
    live: "https://homecare-mky9rkq0j-madhupatel.vercel.app/",
    featured: false,
  },
  {
    index: "06 — APP",
    title: "InstaSaver",
    category: "Android App",
    icon: "📸",
    description: "An open-source Kotlin Android app for downloading Instagram reels, posts and profile pictures with a privacy-focused flow.",
    tags: ["Kotlin", "MVVM", "Android Jetpack", "Material Design"],
    source: "https://github.com/pspktech/InstaSaver/releases/latest",
    live: null,
    featured: false,
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function projectCard(project) {
  const links = [];
  if (project.live) {
    links.push(`<a class="button primary" href="${escapeHtml(project.live)}" target="_blank" rel="noopener noreferrer">Live ↗</a>`);
  }
  if (project.source) {
    links.push(`<a class="button primary" href="${escapeHtml(project.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`);
  }
  return `
    <article class="project-card${project.featured ? " featured" : ""}">
      ${project.featured ? '<span class="badge">New</span>' : ""}
      <div class="preview"><span class="orb orb-a"></span><span class="orb orb-b"></span><span class="project-icon">${project.icon}</span><span class="category">${escapeHtml(project.category)}</span></div>
      <div class="project-body">
        <span class="index">${escapeHtml(project.index)}</span>
        <h2>${escapeHtml(project.title)}</h2>
        <p>${escapeHtml(project.description)}</p>
        <div class="tags">${project.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="actions">${links.join(" ") || '<span style="color:var(--muted)">Links coming soon</span>'}</div>
      </div>
    </article>`;
}

function createProjectsPage() {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Projects — Madhu Patel</title>
<meta name="description" content="Selected web, app and automation projects by Madhu Patel.">
<style>
:root{color-scheme:dark;--bg:#0e0e10;--panel:#17171b;--muted:#9b9ba6;--line:#292930;--lime:#c9f36b;--purple:#8b5cf6;--cyan:#22d3ee}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0%,#20172d 0,transparent 35%),var(--bg);color:#f8f8fa;font:15px/1.6 Inter,Arial,sans-serif}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}.top{padding:26px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.brand{font-weight:800;letter-spacing:-.03em;font-size:20px}.brand span{color:var(--lime)}.back{color:var(--muted);text-decoration:none}.back:hover{color:var(--lime)}.hero{padding:68px 0 34px}.eyebrow{color:var(--lime);font:700 12px/1 JetBrains Mono,monospace;text-transform:uppercase;letter-spacing:.16em}.hero h1{font-size:clamp(42px,7vw,76px);line-height:1;margin:18px 0 16px;letter-spacing:-.07em}.hero p{max-width:650px;color:var(--muted);font-size:17px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:20px 0 72px}.project-card{position:relative;overflow:hidden;background:rgba(23,23,27,.88);border:1px solid var(--line);border-radius:24px;transition:transform .2s,border-color .2s}.project-card:hover{transform:translateY(-5px);border-color:#686875}.project-card.featured{border-color:#687d3e;background:linear-gradient(145deg,#202715,#17171b)}.badge{position:absolute;right:18px;top:18px;z-index:2;background:var(--lime);color:#12140c;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:800}.preview{height:170px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(135deg,#252139,#101014)}.project-card:nth-child(2n) .preview{background:linear-gradient(135deg,#18272b,#121416)}.project-card:nth-child(3n) .preview{background:linear-gradient(135deg,#34251d,#161416)}.orb{position:absolute;border-radius:50%;filter:blur(2px);opacity:.7}.orb-a{width:150px;height:150px;background:var(--purple);left:-35px;top:-65px}.orb-b{width:120px;height:120px;background:var(--cyan);right:-30px;bottom:-55px}.project-icon{position:relative;font-size:58px;filter:drop-shadow(0 8px 18px #0008)}.category{position:absolute;bottom:14px;left:16px;border:1px solid #ffffff30;background:#0007;border-radius:99px;padding:4px 10px;color:#fff;font-size:12px}.project-body{padding:22px}.index{color:var(--lime);font:700 11px JetBrains Mono,monospace;letter-spacing:.08em}.project-body h2{font-size:26px;line-height:1.15;margin:10px 0}.project-body p{color:var(--muted);min-height:76px;margin:0 0 18px}.tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:20px}.tags span{border:1px solid var(--line);color:#d7d7de;border-radius:99px;padding:4px 9px;font-size:12px}.button{display:inline-block;border-radius:10px;padding:9px 13px;text-decoration:none;font-weight:700;font-size:13px}.primary{background:var(--lime);color:#15180c}.primary:hover{background:#e0ff9b}@media(max-width:720px){.grid{grid-template-columns:1fr}.hero{padding-top:48px}.preview{height:145px}.project-body p{min-height:0}}
</style></head><body>
<div class="wrap"><header class="top"><div class="brand">Madhu <span>Patel</span></div><a class="back" href="/dashboard">← Dashboard</a></header>
<main><section class="hero"><span class="eyebrow">Selected Work</span><h1>My Projects</h1><p>Web apps, AI bots and Android tools — each one built end-to-end, from idea to deployment.</p></section>
<section class="grid">${PROJECTS.map(projectCard).join("\n")}</section></main></div></body></html>`;
}

module.exports = { PROJECTS, createProjectsPage };

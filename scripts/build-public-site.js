#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "nextsona-public-site");
const output = path.join(root, "dist", "nextsona-public-site");
const publicOrigin = (process.env.PUBLIC_SITE_ORIGIN || "http://localhost:5500").replace(/\/$/, "");
const allowedFiles = [
  "index.html", "404.html", "robots.txt", "sitemap.xml", "site.webmanifest", "vercel.json", "README.md", "THIRD-PARTY-NOTICES.txt",
  "remote/index.html", "privacy/index.html", "terms/index.html", "welcome/index.html", "getting-started/index.html", "guides/chrome-gpu-windows/index.html",
  "assets/css/site.css", "assets/css/remote.css", "assets/js/site.js", "assets/js/donation.js", "assets/js/remote.js", "assets/js/remote-protocol.js", "assets/vendor/peerjs.min.js",
  "assets/images/logo.png", "assets/images/og-image.png", "assets/images/nextsona-showcase.png",
  "assets/images/screenshots/extension-detail.png", "assets/images/screenshots/remote-preview.png", "assets/images/screenshots/video-preview.png",
  "assets/images/guides/1-windows 10 | graphics settings.png", "assets/images/guides/2-windows 10 | choose an app to set perference.png", "assets/images/guides/3-windows 10 | enable high performance.png",
  "assets/images/guides/welcome/1-open extension list.png", "assets/images/guides/welcome/2-set pin nextsona.png", "assets/images/guides/welcome/3-click-nextsona-icon and enjoy.png"
];

function fail(message) {
  console.error(`[public-site] ERROR: ${message}`);
  process.exitCode = 1;
}

function validateOrigin(value) {
  let url;
  try { url = new URL(value); } catch (_) { return false; }
  return ["http:", "https:"].includes(url.protocol) && !/[\r\n]/.test(value);
}

function replacePlaceholders(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) { replacePlaceholders(target); continue; }
    if (!/\.(html|xml|json|txt|js|css)$/.test(entry.name)) continue;
    const text = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, text.replaceAll("__PUBLIC_SITE_ORIGIN__", publicOrigin));
  }
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else files.push(path.relative(directory, target));
  }
  return files;
}

if (!fs.existsSync(source)) { fail("nextsona-public-site/ does not exist"); process.exit(); }
if (!validateOrigin(publicOrigin)) { fail("PUBLIC_SITE_ORIGIN must be an absolute http(s) URL"); process.exit(); }

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.dirname(output), { recursive: true });
for (const relative of allowedFiles) {
  const from = path.join(source, relative);
  const to = path.join(output, relative);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) { fail(`allowlisted source file is missing: ${relative}`); process.exit(); }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
replacePlaceholders(output);

const files = walk(output).sort();
const forbidden = /(^|\/)(?:\.env(?:\..*)?|\.git|node_modules|key\.pem|cert\.pem|.*\.map|.*\.zip|model|.*\.bin)(\/|$|\.)/i;
const blocked = files.filter((file) => forbidden.test(file));
if (blocked.length) { fail(`forbidden deployment files found: ${blocked.join(", ")}`); process.exit(); }

const manifest = { origin: publicOrigin, generatedAt: new Date().toISOString(), files };
fs.writeFileSync(path.join(output, "build-inventory.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[public-site] built ${files.length} files at ${path.relative(root, output)}`);
console.log(`[public-site] origin: ${publicOrigin}`);
console.log(`[public-site] note: set PUBLIC_SITE_ORIGIN to your HTTPS domain before production deployment`);

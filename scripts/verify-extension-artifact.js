#!/usr/bin/env node

/**
 * Verify the generated extension artifact against its build profile.
 *
 * This gate deliberately scans the packaged output, not the source tree. Go
 * source and the internal companion remain in the repository, while the
 * Store ZIP is checked for accidental runtime, UI, endpoint, or native-file
 * leakage after bundling and minification.
 */

const crypto = require("crypto");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const profileArg = process.argv.find((arg) => arg.startsWith("--profile="));
const profile = (profileArg ? profileArg.split("=")[1] : "store").trim().toLowerCase();
if (!['store', 'go-dev'].includes(profile)) {
  console.error(`Unknown extension artifact profile: ${profile}`);
  process.exit(1);
}

const outputName = profile === "store"
  ? "nextstudio-extension-store"
  : "nextstudio-extension-go-dev";
const distDir = path.join(ROOT_DIR, "dist", outputName);
const zipPath = path.join(ROOT_DIR, "dist", `${outputName}.zip`);

function fail(message) {
  console.error(`[-] Artifact gate failed: ${message}`);
  process.exit(1);
}

function requireByteIdentical(sourcePath, packagedPath, label) {
  const source = fs.readFileSync(sourcePath);
  const packaged = fs.readFileSync(packagedPath);
  if (!source.equals(packaged)) fail(`${label} differs from its reviewed source bytes`);
}

if (!fs.existsSync(distDir)) fail(`missing output directory: ${distDir}`);
if (!fs.existsSync(zipPath)) fail(`missing ZIP: ${zipPath}`);

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const outputFiles = walkFiles(distDir);
const textExtensions = new Set([".js", ".mjs", ".html", ".css", ".json", ".map", ".txt"]);
const textFiles = outputFiles.filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
const zipEntries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const forbiddenStoreTokens = [
  "127.0.0.1:41919",
  "localhost:41919",
  "ws://127.0.0.1",
  "http://127.0.0.1",
  "ws://localhost",
  "http://localhost",
  "go_native",
  "goengineclient",
  "go native core",
  "activate go engine",
  "nextstudio-engine",
  "nativemessaging",
  "api.qrserver.com",
  "fonts.googleapis.com",
  "itty.bitty.site",
  "spoo.me",
  "da.gd",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "mount_ui",
  "remote_ui",
  "security-core-protected",
  "nampweb1",
];

function checkStoreFileName(relativePath) {
  const lower = relativePath.toLowerCase();
  if (/(^|\/)(?:\.ds_store|thumbs\.db)$/.test(lower)) {
    fail(`OS metadata file in extension artifact: ${relativePath}`);
  }
  if (/\.(exe|dylib|dll|wasm\.js)$/.test(lower)) {
    fail(`native/raw binary-looking file in Store ZIP: ${relativePath}`);
  }
  if (/(^|\/)(go|native|nextstudio-engine)(\/|\.|$)/.test(lower)) {
    fail(`Go/native artifact name in Store ZIP: ${relativePath}`);
  }
}

for (const file of outputFiles) {
  const relativePath = path.relative(distDir, file);
  checkStoreFileName(relativePath);
}
for (const entry of zipEntries) checkStoreFileName(entry);

function scanText(file, label) {
  const contents = fs.readFileSync(file, "utf8").toLowerCase();
  for (const token of forbiddenStoreTokens) {
    if (contents.includes(token)) fail(`${token} found in ${label}`);
  }
  if (path.extname(file).toLowerCase() === ".html" && /\son[a-z]+\s*=/i.test(contents)) {
    fail(`inline HTML event handler found in ${label}`);
  }
  if (
    /\.(html|js|mjs|css)$/i.test(file) &&
    (/<script[^>]+(?:src|href)\s*=\s*["']https?:/i.test(contents) ||
      /\b(?:import|fetch)\s*\(\s*["'`]https?:/i.test(contents) ||
      /@import\s+(?:url\()?\s*["']?https?:/i.test(contents))
  ) {
    fail(`remote executable/stylesheet URL found in ${label}`);
  }
}

if (profile === "store") {
  for (const file of textFiles) scanText(file, path.relative(ROOT_DIR, file));

  const manifestPath = path.join(distDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) fail("Store manifest is missing");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const csp = manifest.content_security_policy?.extension_pages || "";
  if (/127\.0\.0\.1|localhost/i.test(csp)) fail("Store CSP still allows loopback access");
  if (/qrserver|fonts\.googleapis/i.test(csp)) fail("Store CSP still allows an unnecessary external asset host");
  if (/\*\.peerjs\.com/i.test(csp)) fail("Store CSP still grants wildcard PeerJS access");
  if (!/https:\/\/0\.peerjs\.com/.test(csp) || !/wss:\/\/0\.peerjs\.com/.test(csp)) {
    fail("Store CSP is missing the exact PeerJS signaling host");
  }
  const minimumChrome = Number.parseInt(manifest.minimum_chrome_version, 10);
  if (!Number.isInteger(minimumChrome) || minimumChrome < 116) {
    fail("Store minimum_chrome_version must be at least 116");
  }

  const expectedPermissions = ["activeTab", "offscreen", "scripting", "storage", "tabCapture"].sort();
  const actualPermissions = [...(manifest.permissions || [])].sort();
  if (JSON.stringify(actualPermissions) !== JSON.stringify(expectedPermissions)) {
    fail(`Store permissions changed: ${actualPermissions.join(", ")}`);
  }
  if (manifest.host_permissions?.length) fail("Store manifest requests broad host permissions");
  if (manifest.content_scripts?.length) fail("Store manifest statically injects content scripts");

  const webResources = manifest.web_accessible_resources || [];
  if (
    webResources.length !== 1 ||
    webResources[0].resources?.length !== 1 ||
    webResources[0].resources[0] !== "video-delay-worker.js"
  ) {
    fail("Store web-accessible resources are broader than the required video worker");
  }

  for (const requiredFile of [
    "THIRD-PARTY-NOTICES.txt",
    "MODEL-LICENSE.txt",
    "LICENSE-APACHE-2.0.txt",
    "model/model.json",
    "model/group1-shard1of1.bin",
    "stft_simd.wasm",
    "stft_scalar.wasm",
  ]) {
    if (!fs.existsSync(path.join(distDir, requiredFile))) fail(`required Store file is missing: ${requiredFile}`);
  }
  requireByteIdentical(
    path.join(ROOT_DIR, "next-amp-extension", "model", "model.json"),
    path.join(distDir, "model", "model.json"),
    "Store model JSON"
  );
  requireByteIdentical(
    path.join(ROOT_DIR, "next-amp-extension", "model", "group1-shard1of1.bin"),
    path.join(distDir, "model", "group1-shard1of1.bin"),
    "Store model weights"
  );
  requireByteIdentical(
    path.join(ROOT_DIR, "next-amp-extension", "modules", "ai-vocal", "stft_simd.wasm"),
    path.join(distDir, "stft_simd.wasm"),
    "Store SIMD STFT WASM"
  );
  requireByteIdentical(
    path.join(ROOT_DIR, "next-amp-extension", "modules", "ai-vocal", "stft_scalar.wasm"),
    path.join(distDir, "stft_scalar.wasm"),
    "Store scalar STFT WASM"
  );
  if (outputFiles.some((file) => file.endsWith(".dat"))) fail("encrypted/concealed .dat asset found in Store output");
  if (outputFiles.some((file) => /remote-app|security-core/i.test(path.basename(file)))) {
    fail("legacy remote UI or security core found in Store output");
  }
  if (outputFiles.some((file) => /^(?:tailwindcss|config)\.js$/i.test(path.basename(file)))) {
    fail("runtime Tailwind compiler/config found in Store output");
  }
  if (fs.existsSync(path.join(distDir, "INTERNAL-GO-DEV-BUILD.txt"))) {
    fail("internal Go marker was copied into Store output");
  }

  const zipTextEntries = zipEntries.filter((entry) => textExtensions.has(path.extname(entry).toLowerCase()));
  for (const entry of zipTextEntries) {
    const contents = execFileSync("unzip", ["-p", zipPath, entry], {
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    }).toLowerCase();
    for (const token of forbiddenStoreTokens) {
      if (contents.includes(token)) fail(`${token} found in ZIP entry ${entry}`);
    }
    if (entry.toLowerCase().endsWith(".html") && /\son[a-z]+\s*=/i.test(contents)) {
      fail(`inline HTML event handler found in ZIP entry ${entry}`);
    }
    if (
      /\.(html|js|mjs|css)$/i.test(entry) &&
      (/<script[^>]+(?:src|href)\s*=\s*["']https?:/i.test(contents) ||
        /\b(?:import|fetch)\s*\(\s*["'`]https?:/i.test(contents) ||
        /@import\s+(?:url\()?\s*["']?https?:/i.test(contents))
    ) {
      fail(`remote executable/stylesheet URL found in ZIP entry ${entry}`);
    }
  }
  const playerJsPath = path.join(distDir, "player.js");
  if (fs.existsSync(playerJsPath) && /getUserMedia\s*\(/i.test(fs.readFileSync(playerJsPath, "utf8"))) {
    fail("Store player still requests microphone access");
  }
} else {
  const markerPath = path.join(distDir, "INTERNAL-GO-DEV-BUILD.txt");
  if (!fs.existsSync(markerPath)) fail("Go development marker is missing");
  if (!zipEntries.includes("INTERNAL-GO-DEV-BUILD.txt")) {
    fail("Go development marker is missing from ZIP");
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(distDir, "manifest.json"), "utf8"));
  const csp = manifest.content_security_policy?.extension_pages || "";
  if (!/127\.0\.0\.1|localhost/i.test(csp)) fail("Go development CSP no longer allows its loopback companion");
  for (const file of textFiles) {
    if (path.basename(file) === "INTERNAL-GO-DEV-BUILD.txt") continue;
    // The Go-dev package is allowed to contain its internal bridge. Still
    // reject raw native binaries accidentally embedded in the extension ZIP.
    if (/\.(exe|dylib|dll)$/.test(file.toLowerCase())) fail(`native binary embedded in Go-dev extension ZIP: ${file}`);
  }
}

const zipHash = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
console.log(`[+] ${profile} artifact gate passed (${zipEntries.length} ZIP entries)`);
console.log(`[+] SHA-256 ${path.relative(ROOT_DIR, zipPath)}: ${zipHash}`);

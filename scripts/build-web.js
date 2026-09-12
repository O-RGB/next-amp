#!/usr/bin/env node
/**
 * NextStudio standalone Web production build.
 *
 * The source Web player stays readable/development-friendly. This pipeline
 * creates a deployable static tree in dist/next-amp-web-prod where:
 *   - proprietary AI model/WASM files exist only as authenticated ciphertext;
 *   - application/AI/worklet code is bundled and obfuscated;
 *   - shipped asset names are mangled, so source paths are not reusable;
 *   - the Unauthorized Copy guard is controlled at build time by env.
 *
 * This is client-side protection, not a secret vault: a determined user can
 * still inspect a running browser and recover what the browser decrypts.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require("esbuild");

const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = ROOT_DIR;
const DIST_DIR = path.join(ROOT_DIR, "dist", "next-amp-web-prod");
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nextamp-web-build-"));
const OBFUSCATOR_BIN = path.join(
  ROOT_DIR,
  "node_modules",
  ".bin",
  "javascript-obfuscator"
);

const WEB_ASSET_MAGIC = Buffer.from("NAMPWEB1", "ascii");
const WEB_ASSET_HEADER_BYTES = 20;
const WEB_ASSET_KEY = crypto.randomBytes(32);
const WEB_ASSET_KEY_B64 = WEB_ASSET_KEY.toString("base64");

const unauthorizedCopyDisabled =
  process.env.NEXTAMP_DISABLE_UNAUTHORIZED_COPY === "true";
const serviceWorkerDisabled =
  process.env.NEXTAMP_DISABLE_SERVICE_WORKER === "true";

function getMangledName(key, ext) {
  const hash = crypto
    .createHash("md5")
    .update("nextamp_web_" + key)
    .digest("hex")
    .slice(0, 10);
  return `${hash}${ext}`;
}

const FILE_NAMES = {
  app: getMangledName("app", ".js"),
  aiManager: getMangledName("ai-manager", ".js"),
  vocalWorklet: getMangledName("vocal-worklet", ".js"),
  signalsmith: getMangledName("signalsmith", ".mjs"),
  tailwind: getMangledName("tailwindcss", ".js"),
  lame: getMangledName("lame", ".js"),
  mp3Worker: getMangledName("mp3-worker", ".js"),
  tf: getMangledName("tf", ".js"),
  tfWebgpu: getMangledName("tf-backend-webgpu", ".js"),
  stftSimd: getMangledName("stft-simd-protected", ".dat"),
  stftScalar: getMangledName("stft-scalar-protected", ".dat"),
  model: getMangledName("model-protected", ".dat")
};

const WEB_PATHS = {
  app: `assets/libs/js/${FILE_NAMES.app}`,
  aiManager: `assets/ai/${FILE_NAMES.aiManager}`,
  vocalWorklet: `assets/ai/${FILE_NAMES.vocalWorklet}`,
  signalsmith: `assets/libs/mjs/${FILE_NAMES.signalsmith}`,
  tailwind: `assets/libs/js/${FILE_NAMES.tailwind}`,
  lame: `assets/libs/js/${FILE_NAMES.lame}`,
  mp3Worker: `assets/libs/worker/${FILE_NAMES.mp3Worker}`,
  tf: `assets/libs/js/${FILE_NAMES.tf}`,
  tfWebgpu: `assets/libs/js/${FILE_NAMES.tfWebgpu}`,
  stftSimd: `assets/ai/${FILE_NAMES.stftSimd}`,
  stftScalar: `assets/ai/${FILE_NAMES.stftScalar}`,
  model: `assets/ai/${FILE_NAMES.model}`
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function read(filePath, encoding = null) {
  return fs.readFileSync(filePath, encoding || undefined);
}

function write(filePath, data, encoding = null) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, data, encoding || undefined);
}

function copy(source, destination) {
  ensureDir(destination);
  fs.copyFileSync(source, destination);
}

function replaceAll(value, search, replacement) {
  return value.split(search).join(replacement);
}

function replaceRequired(value, search, replacement, label) {
  if (!value.includes(search)) {
    throw new Error(`Build marker not found: ${label || search}`);
  }
  return replaceAll(value, search, replacement);
}

function protectAsset(plaintext) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", WEB_ASSET_KEY, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([WEB_ASSET_MAGIC, nonce, ciphertext, authTag]);
}

function unprotectAsset(payload) {
  if (!payload.subarray(0, WEB_ASSET_MAGIC.length).equals(WEB_ASSET_MAGIC)) {
    throw new Error("Protected asset magic header validation failed");
  }
  const nonce = payload.subarray(WEB_ASSET_MAGIC.length, WEB_ASSET_HEADER_BYTES);
  const ciphertext = payload.subarray(WEB_ASSET_HEADER_BYTES, payload.length - 16);
  const authTag = payload.subarray(payload.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", WEB_ASSET_KEY, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function writeProtectedAsset(destination, plaintext) {
  const payload = protectAsset(plaintext);
  if (!unprotectAsset(payload).equals(plaintext)) {
    throw new Error(`Protected asset self-test failed: ${destination}`);
  }
  write(destination, payload);
}

function createProtectedModelPayload(modelJson, weights) {
  const modelBytes = Buffer.from(JSON.stringify(modelJson), "utf8");
  const header = Buffer.alloc(8);
  header.writeUInt32LE(modelBytes.length, 0);
  header.writeUInt32LE(weights.length, 4);
  return Buffer.concat([header, modelBytes, weights]);
}

function obfuscate(sourceFile, destination, options = {}) {
  const args = [
    sourceFile,
    "--output",
    destination,
    "--target",
    options.target || "browser-no-eval",
    "--compact",
    "true",
    "--control-flow-flattening",
    options.controlFlow === false ? "false" : "true",
    "--string-array",
    "true",
    "--string-array-encoding",
    "rc4",
    "--string-array-threshold",
    "0.8",
    "--transform-object-keys",
    "true"
  ];
  if (options.deadCode === false) {
    args.push("--dead-code-injection", "false");
  } else {
    args.push("--dead-code-injection", "true", "--dead-code-injection-threshold", "0.2");
  }
  execFileSync(OBFUSCATOR_BIN, args, { cwd: ROOT_DIR, stdio: "inherit" });
}

function minifyJavaScript(sourceFile, destination) {
  esbuild.buildSync({
    entryPoints: [sourceFile],
    outfile: destination,
    bundle: false,
    minify: true,
    format: "esm",
    target: "es2020",
    logLevel: "silent"
  });
}

function minifyHtml(content) {
  return content
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}

function buildApplicationSource() {
  let source = read(path.join(SRC_DIR, "assets", "libs", "js", "app.js"), "utf8");
  const guardValue = unauthorizedCopyDisabled ? "true" : "false";
  source = replaceRequired(
    source,
    '"__NEXTAMP_DISABLE_UNAUTHORIZED_COPY__"',
    JSON.stringify(guardValue),
    "Unauthorized Copy env marker"
  );

  const replacements = [
    ["../mjs/SignalsmithStretch.mjs", `../mjs/${FILE_NAMES.signalsmith}`],
    ["/next-amp-extension/assets/libs/js/tf.min.js", WEB_PATHS.tf],
    ["/next-amp-extension/assets/libs/js/tf-backend-webgpu.min.js", WEB_PATHS.tfWebgpu],
    ["/next-amp-extension/modules/ai-vocal/vocal-worklet.js", WEB_PATHS.vocalWorklet],
    ["/next-amp-extension/modules/ai-vocal/stft_simd.wasm", WEB_PATHS.stftSimd],
    ["/next-amp-extension/modules/ai-vocal/stft_scalar.wasm", WEB_PATHS.stftScalar],
    ["/next-amp-extension/model/model.json", WEB_PATHS.model],
    // app.js is emitted under assets/libs/js/, so this import is relative to
    // that module rather than to the document URL.
    ["../../next-amp-extension/modules/ai-vocal/ai-vocal-manager.js", `../../ai/${FILE_NAMES.aiManager}`],
    ["assetBase: \"/next-amp-extension/\"", "assetBase: \"assets/ai/\""],
    ["protectedAssets: false", "protectedAssets: true"]
  ];
  for (const [search, replacement] of replacements) {
    source = replaceRequired(source, search, replacement, search);
  }

  const sourceFile = path.join(TEMP_DIR, "app.web.js");
  write(sourceFile, source, "utf8");
  return sourceFile;
}

function buildAIManager() {
  const bundledFile = path.join(TEMP_DIR, "ai-manager.bundle.js");
  esbuild.buildSync({
    // Use the Web adapter as the entry point. It imports the unchanged
    // Extension manager, so both targets execute the same AI pipeline.
    entryPoints: [path.join(SRC_DIR, "next-amp-extension", "modules", "ai-vocal", "ai-vocal-manager-web.js")],
    outfile: bundledFile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    minify: true,
    logLevel: "silent"
  });
  let bundled = read(bundledFile, "utf8");
  bundled = replaceRequired(
    bundled,
    '"__NEXTAMP_WEB_ASSET_KEY__"',
    JSON.stringify(WEB_ASSET_KEY_B64),
    "Web asset key placeholder"
  );
  write(bundledFile, bundled, "utf8");
  obfuscate(bundledFile, path.join(DIST_DIR, "assets", "ai", FILE_NAMES.aiManager));
}

function replaceWebAssetReferences(content) {
  const replacements = [
    ["/assets/libs/js/tailwindcss.js", WEB_PATHS.tailwind],
    ["/assets/libs/js/lame.min.js", WEB_PATHS.lame],
    ["/assets/libs/worker/mp3-worker.js", WEB_PATHS.mp3Worker],
    ["/assets/libs/js/obfuscator.js", WEB_PATHS.app]
  ];
  for (const [search, replacement] of replacements) {
    content = replaceAll(content, search, replacement);
  }
  // Keep the whole static output relocatable. This matters when a simple
  // server exposes it under /dist/next-amp-web-prod/ during testing.
  content = content.replace(/(["'])\/assets\//g, "$1assets/");
  return content;
}

function buildHtmlFiles() {
  for (const fileName of ["index.html", "app.html", "install-extension.html"]) {
    let html = read(path.join(SRC_DIR, fileName), "utf8");
    html = replaceWebAssetReferences(html);
    html = replaceAll(html, 'href="/manifest.json"', 'href="./manifest.json"');
    if (fileName === "index.html" && serviceWorkerDisabled) {
      html = replaceAll(
        html,
        'if ("serviceWorker" in navigator)',
        'if (false && "serviceWorker" in navigator)'
      );
    }
    write(path.join(DIST_DIR, fileName), minifyHtml(html), "utf8");
  }

  let serviceWorker = read(path.join(SRC_DIR, "sw.js"), "utf8");
  serviceWorker = replaceAll(serviceWorker, "./assets/libs/js/obfuscator.js", `./${WEB_PATHS.app}`);
  serviceWorker = replaceAll(serviceWorker, "./assets/libs/mjs/SignalsmithStretch.mjs", `./${WEB_PATHS.signalsmith}`);
  serviceWorker = replaceAll(serviceWorker, "./assets/libs/js/tailwindcss.js", `./${WEB_PATHS.tailwind}`);
  serviceWorker = replaceAll(serviceWorker, "./assets/libs/js/lame.min.js", `./${WEB_PATHS.lame}`);
  serviceWorker = replaceAll(serviceWorker, "./assets/libs/worker/mp3-worker.js", `./${WEB_PATHS.mp3Worker}`);
  write(path.join(DIST_DIR, "sw.js"), serviceWorker, "utf8");

  copy(path.join(SRC_DIR, "manifest.json"), path.join(DIST_DIR, "manifest.json"));
}

function copyStaticWebAssets() {
  copy(path.join(SRC_DIR, "assets", "logo", "logo.png"), path.join(DIST_DIR, "assets", "logo", "logo.png"));
  copy(path.join(SRC_DIR, "assets", "post", "image.png"), path.join(DIST_DIR, "assets", "post", "image.png"));
  for (const fileName of ["startup.mp3", "allow-sound.mp3"]) {
    copy(path.join(SRC_DIR, "assets", "sounds", fileName), path.join(DIST_DIR, "assets", "sounds", fileName));
  }

  // The landing page links to these extension download/manual assets.
  fs.cpSync(path.join(SRC_DIR, "assets", "extension"), path.join(DIST_DIR, "assets", "extension"), { recursive: true });
}

function buildLibraries() {
  const sourceSignalsmith = path.join(SRC_DIR, "assets", "libs", "mjs", "SignalsmithStretch.mjs");
  esbuild.buildSync({
    entryPoints: [sourceSignalsmith],
    outfile: path.join(DIST_DIR, "assets", "libs", "mjs", FILE_NAMES.signalsmith),
    minify: true,
    format: "esm",
    target: "es2020",
    logLevel: "silent"
  });

  // These are already vendor-minified. Hashing their names avoids shipping
  // the stable source paths while preserving the tested vendor runtime.
  copy(path.join(SRC_DIR, "assets", "libs", "js", "tailwindcss.js"), path.join(DIST_DIR, "assets", "libs", "js", FILE_NAMES.tailwind));
  copy(path.join(SRC_DIR, "assets", "libs", "js", "lame.min.js"), path.join(DIST_DIR, "assets", "libs", "js", FILE_NAMES.lame));
  copy(path.join(SRC_DIR, "next-amp-extension", "assets", "libs", "js", "tf.min.js"), path.join(DIST_DIR, "assets", "libs", "js", FILE_NAMES.tf));
  copy(path.join(SRC_DIR, "next-amp-extension", "assets", "libs", "js", "tf-backend-webgpu.min.js"), path.join(DIST_DIR, "assets", "libs", "js", FILE_NAMES.tfWebgpu));
  copy(path.join(SRC_DIR, "assets", "libs", "worker", "mp3-worker.js"), path.join(DIST_DIR, "assets", "libs", "worker", FILE_NAMES.mp3Worker));
}

function buildProtectedAIAssets() {
  const sourceRoot = path.join(SRC_DIR, "next-amp-extension");
  writeProtectedAsset(
    path.join(DIST_DIR, "assets", "ai", FILE_NAMES.stftSimd),
    read(path.join(sourceRoot, "modules", "ai-vocal", "stft_simd.wasm"))
  );
  writeProtectedAsset(
    path.join(DIST_DIR, "assets", "ai", FILE_NAMES.stftScalar),
    read(path.join(sourceRoot, "modules", "ai-vocal", "stft_scalar.wasm"))
  );

  const modelJson = JSON.parse(read(path.join(sourceRoot, "model", "model.json"), "utf8"));
  const weights = read(path.join(sourceRoot, "model", "group1-shard1of1.bin"));
  const modelPayload = createProtectedModelPayload(modelJson, weights);
  writeProtectedAsset(path.join(DIST_DIR, "assets", "ai", FILE_NAMES.model), modelPayload);
}

function buildApplicationCode() {
  const appSource = buildApplicationSource();
  obfuscate(appSource, path.join(DIST_DIR, "assets", "libs", "js", FILE_NAMES.app));

  const workletSource = path.join(SRC_DIR, "next-amp-extension", "modules", "ai-vocal", "vocal-worklet.js");
  obfuscate(workletSource, path.join(DIST_DIR, "assets", "ai", FILE_NAMES.vocalWorklet), {
    controlFlow: false,
    deadCode: false
  });

  buildAIManager();
}

function verifyOutput() {
  const forbidden = [
    "model.json",
    "group1-shard1of1.bin",
    "stft_simd.wasm",
    "stft_scalar.wasm",
    "assets/libs/js/app.js",
    "next-amp-extension/modules/ai-vocal/ai-vocal-manager.js"
  ];
  for (const relative of forbidden) {
    if (fs.existsSync(path.join(DIST_DIR, relative))) {
      throw new Error(`Plain/source asset leaked into Web production build: ${relative}`);
    }
  }

  const jsFiles = [];
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      else if (entry.name.endsWith(".js")) jsFiles.push(fullPath);
    }
  }
  collect(DIST_DIR);
  for (const jsFile of jsFiles) {
    execFileSync(process.execPath, ["--check", jsFile], { cwd: ROOT_DIR, stdio: "inherit" });
  }

  const protectedFiles = [FILE_NAMES.stftSimd, FILE_NAMES.stftScalar, FILE_NAMES.model];
  for (const fileName of protectedFiles) {
    const payload = read(path.join(DIST_DIR, "assets", "ai", fileName));
    if (!payload.subarray(0, WEB_ASSET_MAGIC.length).equals(WEB_ASSET_MAGIC)) {
      throw new Error(`Protected header missing: ${fileName}`);
    }
  }
}

function main() {
  console.log("====================================================");
  console.log("NEXTSTUDIO STANDALONE WEB PRODUCTION BUILD");
  console.log("====================================================");
  console.log(`Unauthorized Copy guard: ${unauthorizedCopyDisabled ? "DISABLED (env)" : "ENABLED"}`);
  console.log(`Service Worker: ${serviceWorkerDisabled ? "DISABLED (env)" : "ENABLED"}`);
  console.log(`Output: ${path.relative(ROOT_DIR, DIST_DIR)}/`);

  try {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    fs.mkdirSync(DIST_DIR, { recursive: true });
    buildLibraries();
    buildProtectedAIAssets();
    buildApplicationCode();
    buildHtmlFiles();
    copyStaticWebAssets();
    verifyOutput();
    console.log("✅ Web production build and protection verification complete.");
  } finally {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

main();

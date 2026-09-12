#!/usr/bin/env node
/**
 * NextStudio Extension - Production Hardened Build Pipeline
 *
 * Features:
 * 1. 100% File Name Mangling / Content Hashing (Every file except .html and manifest.json)
 * 2. WebAssembly (WASM) Security Core (compiled from C via emcc)
 * 3. Extension ID Lock verification inside WASM bytecode
 * 4. Anti-Tamper Prototype Integrity Guard & Anti-Debugging Watchdog
 * 5. esbuild bundling + Full javascript-obfuscator protection
 * 6. Automated cross-reference URL rewriting for audio DSP, AI models, workers, fonts & styles
 * 7. Complete HTML & CSS minification (.min) + inline script/style minification
 * 8. Store-ready ZIP package generation
 * 9. Native GO engine + self-contained macOS and Windows binaries
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'next-amp-extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'next-amp-extension-prod');
const TEMP_DIR = path.join(ROOT_DIR, 'dist', 'temp');
const ZIP_FILE = path.join(ROOT_DIR, 'dist', 'next-amp-extension-prod.zip');
const WEB_ASSET_KEY_PLACEHOLDER = '__NEXTAMP_WEB_ASSET_KEY__';
const WEB_ASSET_MAGIC = Buffer.from('NAMPWEB1', 'ascii');
const WEB_ASSET_HEADER_BYTES = 20;
const webAssetKey = crypto.randomBytes(32);
const webAssetKeyB64 = webAssetKey.toString('base64');

console.log('====================================================');
console.log('NEXTSTUDIO PRODUCTION BUILD & COMPLETE HARDENING');
console.log('====================================================');

// Deterministic hashing helper
function getMangledName(key, ext = '.js') {
  const hash = crypto.createHash('md5').update('nextamp_' + key).digest('hex').slice(0, 10);
  return `${hash}${ext}`;
}

const FILE_NAMES = {
  // Bundled JS entries
  popup: getMangledName('popup', '.js'),
  background: getMangledName('background', '.js'),
  offscreen: getMangledName('offscreen', '.js'),
  videoDelay: getMangledName('video-delay', '.js'),
  videoZoom: getMangledName('video-zoom', '.js'),
  player: getMangledName('player', '.js'),
  remoteApp: getMangledName('remote-app', '.js'),

  // Config & Workers & Standalone JS
  config: getMangledName('config', '.js'),
  vocalWorklet: getMangledName('vocal-worklet', '.js'),
  videoDelayWorker: getMangledName('video-delay-worker', '.js'),

  // Vendor JS & MJS libraries
  tailwind: getMangledName('tailwindcss', '.js'),
  peerjs: getMangledName('peerjs', '.js'),
  tf: getMangledName('tf', '.js'),
  tfWebgpu: getMangledName('tf-backend-webgpu', '.js'),
  signalsmith: getMangledName('signalsmith', '.mjs'),

  // WebAssembly cores
  webSecurityWasm: getMangledName('security-core-protected', '.dat'),
  webStftSimd: getMangledName('stft_simd-protected', '.dat'),
  webStftScalar: getMangledName('stft_scalar-protected', '.dat'),

  // AI Models
  webModel: getMangledName('model-protected', '.dat'),

  // Styles, Fonts, Assets
  stylesCss: getMangledName('styles', '.css'),
  phosphorCss: getMangledName('phosphor', '.css'),
  phosphorFont: getMangledName('phosphor-font', '.woff2'),
  logo: getMangledName('logo', '.png')
};

console.log('100% Obfuscated File Mapping Table:');
Object.entries(FILE_NAMES).forEach(([k, v]) => {
  console.log(`  • ${k.padEnd(18)} -> ${v}`);
});

function run(cmd, desc) {
  if (desc) console.log('[+] ' + desc + '...');
  try {
    return execSync(cmd, { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (err) {
    console.error('[-] Error during: ' + desc);
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

function encryptWebAsset(plaintext) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', webAssetKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([WEB_ASSET_MAGIC, nonce, ciphertext, authTag]);
}

function decryptWebAsset(payload) {
  if (!payload.subarray(0, WEB_ASSET_MAGIC.length).equals(WEB_ASSET_MAGIC)) {
    throw new Error('Protected Web asset header validation failed');
  }
  const nonce = payload.subarray(WEB_ASSET_MAGIC.length, WEB_ASSET_HEADER_BYTES);
  const authTag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(WEB_ASSET_HEADER_BYTES, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', webAssetKey, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function writeVerifiedProtectedAsset(filePath, plaintext) {
  const protectedAsset = encryptWebAsset(plaintext);
  if (!decryptWebAsset(protectedAsset).equals(plaintext)) {
    throw new Error('Protected Web asset self-test failed');
  }
  fs.writeFileSync(filePath, protectedAsset);
}

function createProtectedModelPayload(modelJson, weightData) {
  const modelBytes = Buffer.from(JSON.stringify(modelJson), 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(modelBytes.length, 0);
  header.writeUInt32LE(weightData.length, 4);
  return Buffer.concat([header, modelBytes, weightData]);
}

// Build the native engine before packaging the extension so the shipped
// release is always produced alongside the current GO AI implementation.
// The script creates both nextamp-engine and nextamp-engine.exe using the
// embedded model/runtime assets in nextamp-engine-go/.
console.log('\n[0/9] Building native GO engine binaries...');
run(
  'bash "' + path.join(ROOT_DIR, 'nextamp-engine-go', 'build.sh') + '"',
  'Building macOS + Windows GO engine binaries'
);

// 1. Prepare Output Directories
console.log('\n[1/9] Cleaning and preparing output directories...');
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Compile WASM Security Core
console.log('\n[2/9] Compiling WebAssembly Security Core...');
const emccPath = fs.existsSync('/opt/homebrew/bin/emcc') ? '/opt/homebrew/bin/emcc' : 'emcc';
const wasmSrc = path.join(ROOT_DIR, 'scripts', 'security', 'security-core.c');
const wasmPlainOut = path.join(TEMP_DIR, 'security-core.wasm');

run(
  emccPath + ' "' + wasmSrc + '" -O3 -s STANDALONE_WASM=1 --no-entry -s EXPORTED_FUNCTIONS=_verify_extension_id,_validate_token,_compute_dsp_mask_seed -o "' + wasmPlainOut + '"',
  'Compiling security-core.c with emcc -O3 -> ' + FILE_NAMES.webSecurityWasm
);
console.log('    ✓ ' + FILE_NAMES.webSecurityWasm + ' compiled successfully');

// 3. Bundle JS Entry Points & Workers via esbuild
console.log('\n[3/9] Bundling JavaScript modules & workers via esbuild...');

const bundles = [
  { in: 'popup.js', out: FILE_NAMES.popup, temp: 'popup.tmp.js', format: 'esm', injectGuard: true },
  { in: 'background.js', out: FILE_NAMES.background, temp: 'background.tmp.js', format: 'esm', injectGuard: false },
  { in: 'offscreen.js', out: FILE_NAMES.offscreen, temp: 'offscreen.tmp.js', format: 'esm', injectGuard: true },
  { in: 'video-delay.js', out: FILE_NAMES.videoDelay, temp: 'video-delay.tmp.js', format: 'iife', injectGuard: false },
  { in: 'video-zoom.js', out: FILE_NAMES.videoZoom, temp: 'video-zoom.tmp.js', format: 'iife', injectGuard: false },
  { in: 'player.js', out: FILE_NAMES.player, temp: 'player.tmp.js', format: 'esm', injectGuard: false },
  { in: 'remote/app.js', out: FILE_NAMES.remoteApp, temp: 'remote-app.tmp.js', format: 'iife', injectGuard: false },
  { in: 'assets/js/config.js', out: FILE_NAMES.config, temp: 'config.tmp.js', format: 'iife', injectGuard: false },
  { in: 'video-delay-worker.js', out: FILE_NAMES.videoDelayWorker, temp: 'video-delay-worker.tmp.js', format: 'iife', injectGuard: false }
];

bundles.forEach((b) => {
  const srcFile = path.join(SRC_DIR, b.in);
  const tempFile = path.join(TEMP_DIR, b.temp);
  run(
    'npx esbuild "' + srcFile + '" --bundle --format=' + b.format + ' --target=chrome110 --outfile="' + tempFile + '"',
    'Bundling ' + b.in + ' -> ' + b.temp
  );
});

// 4. Cross-Reference Rewriting in JS Bundles
console.log('\n[4/9] Rewriting cross-references to hashed assets in JS bundles...');

function replaceInFile(filePath, search, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(search).join(replacement);
  fs.writeFileSync(filePath, content, 'utf8');
}

// Rewrite in popup bundle
const popupTemp = path.join(TEMP_DIR, 'popup.tmp.js');
replaceInFile(popupTemp, 'assets/libs/mjs/SignalsmithStretch.mjs', FILE_NAMES.signalsmith);

// Rewrite in offscreen bundle
const offscreenTemp = path.join(TEMP_DIR, 'offscreen.tmp.js');
replaceInFile(offscreenTemp, 'modules/ai-vocal/vocal-worklet.js', FILE_NAMES.vocalWorklet);
replaceInFile(offscreenTemp, 'modules/ai-vocal/stft_simd.wasm', FILE_NAMES.webStftSimd);
replaceInFile(offscreenTemp, 'modules/ai-vocal/stft_scalar.wasm', FILE_NAMES.webStftScalar);
replaceInFile(offscreenTemp, 'model/model.json', FILE_NAMES.webModel);
replaceInFile(offscreenTemp, 'assets/libs/mjs/SignalsmithStretch.mjs', FILE_NAMES.signalsmith);
replaceInFile(offscreenTemp, 'assets/libs/js/tf-backend-webgpu.min.js', FILE_NAMES.tfWebgpu);
replaceInFile(offscreenTemp, WEB_ASSET_KEY_PLACEHOLDER, webAssetKeyB64);

// Rewrite in video-delay bundle
const videoDelayTemp = path.join(TEMP_DIR, 'video-delay.tmp.js');
replaceInFile(videoDelayTemp, 'video-delay-worker.js', FILE_NAMES.videoDelayWorker);

// Inject Security Guard into popup & offscreen
let guardCode = fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'security', 'security-guard.js'), 'utf8');
guardCode = guardCode
  .split('security-core.wasm').join(FILE_NAMES.webSecurityWasm)
  .split(WEB_ASSET_KEY_PLACEHOLDER).join(webAssetKeyB64);

[popupTemp, offscreenTemp].forEach((tempFile) => {
  const content = fs.readFileSync(tempFile, 'utf8');
  fs.writeFileSync(tempFile, guardCode + '\n' + content, 'utf8');
});

// 5. Code Obfuscation
console.log('\n[5/9] Applying Advanced Code Obfuscation & Anti-Tamper Protection...');

bundles.forEach((b) => {
  const tempFile = path.join(TEMP_DIR, b.temp);
  const destFile = path.join(DIST_DIR, b.out);

  if (b.in === 'background.js') {
    // Service Worker requires --target service-worker and NO eval/Function constructors to pass MV3 registration
    run(
      'npx javascript-obfuscator "' + tempFile + '" ' +
        '--output "' + destFile + '" ' +
        '--target service-worker ' +
        '--compact true ' +
        '--control-flow-flattening true ' +
        '--control-flow-flattening-threshold 0.75 ' +
        '--string-array true ' +
        '--string-array-encoding rc4 ' +
        '--string-array-threshold 0.8 ' +
        '--transform-object-keys true',
      'Obfuscating Service Worker -> ' + b.out
    );
  } else if (['video-delay-worker.tmp.js', 'vocal-worker.tmp.js'].includes(b.temp)) {
    // Dedicated Web Workers (WorkerGlobalScope)
    run(
      'npx javascript-obfuscator "' + tempFile + '" ' +
        '--output "' + destFile + '" ' +
        '--target service-worker ' +
        '--compact true ' +
        '--control-flow-flattening false ' +
        '--string-array true ' +
        '--string-array-encoding rc4 ' +
        '--string-array-threshold 0.8 ' +
        '--transform-object-keys true',
      'Obfuscating worker -> ' + b.out
    );
  } else {
    // Browser pages and content scripts with browser-no-eval (no eval/Function to respect MV3 CSP)
    run(
      'npx javascript-obfuscator "' + tempFile + '" ' +
        '--output "' + destFile + '" ' +
        '--target browser-no-eval ' +
        '--compact true ' +
        '--control-flow-flattening true ' +
        '--control-flow-flattening-threshold 0.75 ' +
        '--dead-code-injection true ' +
        '--dead-code-injection-threshold 0.2 ' +
        '--string-array true ' +
        '--string-array-encoding rc4 ' +
        '--string-array-threshold 0.8 ' +
        '--transform-object-keys true',
      'Obfuscating (MV3 CSP Compliant) -> ' + b.out
    );
  }
});

// Protect vocal-worklet.js while keeping the AudioWorklet runtime surface
// unchanged. Avoid control-flow/dead-code transforms here: a live audio
// callback must stay as lean and predictable as the tested source path.
run(
  'npx javascript-obfuscator "' + path.join(SRC_DIR, 'modules', 'ai-vocal', 'vocal-worklet.js') + '" ' +
    '--output "' + path.join(DIST_DIR, FILE_NAMES.vocalWorklet) + '" ' +
    '--target browser-no-eval ' +
    '--compact true ' +
    '--control-flow-flattening false ' +
    '--dead-code-injection false ' +
    '--string-array true ' +
    '--string-array-encoding rc4 ' +
    '--string-array-threshold 0.8',
  'Obfuscating AudioWorklet (low-risk mode) -> ' + FILE_NAMES.vocalWorklet
);

// 6. Packaging & Minifying Libraries, Models, WASM
console.log('\n[6/9] Packaging and minifying vendor libraries, WASM, and AI models...');

// Minify large libraries via esbuild
run(
  'npx esbuild "' + path.join(SRC_DIR, 'assets', 'js', 'tailwindcss.js') + '" --minify --outfile="' + path.join(DIST_DIR, FILE_NAMES.tailwind) + '"',
  'Minifying Tailwind CSS -> ' + FILE_NAMES.tailwind
);

run(
  'npx esbuild "' + path.join(SRC_DIR, 'assets', 'libs', 'mjs', 'SignalsmithStretch.mjs') + '" --minify --outfile="' + path.join(DIST_DIR, FILE_NAMES.signalsmith) + '"',
  'Minifying SignalsmithStretch -> ' + FILE_NAMES.signalsmith
);

// Copy pre-minified libraries
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'js', 'peerjs.min.js'), path.join(DIST_DIR, FILE_NAMES.peerjs));
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'libs', 'js', 'tf.min.js'), path.join(DIST_DIR, FILE_NAMES.tf));
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'libs', 'js', 'tf-backend-webgpu.min.js'), path.join(DIST_DIR, FILE_NAMES.tfWebgpu));

// Encrypt proprietary WASM assets. Production keeps only ciphertext on disk;
// the extension decrypts it in memory immediately before instantiation.
const stftSimd = fs.readFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_simd.wasm'));
const stftScalar = fs.readFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_scalar.wasm'));
writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webStftSimd), stftSimd);
writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webStftScalar), stftScalar);

// Join and encrypt the model JSON + weight shard. The plaintext JSON and BIN
// never enter the production directory or ZIP archive.
const modelJsonData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'model', 'model.json'), 'utf8'));
const modelWeights = fs.readFileSync(path.join(SRC_DIR, 'model', 'group1-shard1of1.bin'));
const modelPayload = createProtectedModelPayload(modelJsonData, modelWeights);
writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webModel), modelPayload);

// Encrypt the compiled security core as well. It is loaded through the same
// protected-asset path in the injected guard.
const securityWasm = fs.readFileSync(wasmPlainOut);
writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webSecurityWasm), securityWasm);

// Copy Logo
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'logo.png'), path.join(DIST_DIR, FILE_NAMES.logo));

// Copy Font
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'fonts', 'Phosphor-Bold.woff2'), path.join(DIST_DIR, FILE_NAMES.phosphorFont));

// 7. Minifying CSS & HTML (.min)
console.log('\n[7/9] Minifying CSS stylesheets and HTML pages (.min)...');

// Minify Phosphor CSS with hashed font path
let phosphorCssContent = fs.readFileSync(path.join(SRC_DIR, 'assets', 'css', 'phosphor.css'), 'utf8');
phosphorCssContent = phosphorCssContent.replace('../fonts/Phosphor-Bold.woff2', './' + FILE_NAMES.phosphorFont);
const minPhosphorCss = esbuild.transformSync(phosphorCssContent, { loader: 'css', minify: true }).code;
fs.writeFileSync(path.join(DIST_DIR, FILE_NAMES.phosphorCss), minPhosphorCss, 'utf8');
console.log('    ✓ Phosphor CSS minified -> ' + FILE_NAMES.phosphorCss);

// Minify styles.css
const stylesCssContent = fs.readFileSync(path.join(SRC_DIR, 'styles.css'), 'utf8');
const minStylesCss = esbuild.transformSync(stylesCssContent, { loader: 'css', minify: true }).code;
fs.writeFileSync(path.join(DIST_DIR, FILE_NAMES.stylesCss), minStylesCss, 'utf8');
console.log('    ✓ Styles CSS minified -> ' + FILE_NAMES.stylesCss);

// Zero-dependency HTML Minifier function (minifies tags, inline CSS & inline JS)
function minifyHtml(html) {
  // 1. Minify inline CSS inside <style> tags
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
    try {
      const minCss = esbuild.transformSync(css, { loader: 'css', minify: true }).code.trim();
      return '<style>' + minCss + '</style>';
    } catch {
      return match;
    }
  });

  // 2. Minify inline JS inside <script> tags
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, js) => {
    if (!js.trim() || attrs.includes('src=')) return match;
    try {
      const minJs = esbuild.transformSync(js, { minify: true }).code.trim();
      return '<script' + attrs + '>' + minJs + '</script>';
    } catch {
      return match;
    }
  });

  // 3. Remove all HTML comments
  html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

  // 4. Collapse whitespace between tags
  html = html.replace(/>\s+</g, '><');

  // 5. Collapse duplicate internal whitespace
  html = html.replace(/\s{2,}/g, ' ');

  return html.trim();
}

// 1. popup.html
let popupHtml = fs.readFileSync(path.join(SRC_DIR, 'popup.html'), 'utf8');
popupHtml = popupHtml.replace('./assets/js/tailwindcss.js', './' + FILE_NAMES.tailwind);
popupHtml = popupHtml.replace('./assets/js/config.js', './' + FILE_NAMES.config);
popupHtml = popupHtml.replace('./assets/css/phosphor.css', './' + FILE_NAMES.phosphorCss);
popupHtml = popupHtml.replace('styles.css', FILE_NAMES.stylesCss);
popupHtml = popupHtml.replace('./assets/logo.png', './' + FILE_NAMES.logo);
popupHtml = popupHtml.replace('src="popup.js"', `src="${FILE_NAMES.popup}"`);
fs.writeFileSync(path.join(DIST_DIR, 'popup.html'), minifyHtml(popupHtml), 'utf8');
console.log('    ✓ popup.html minified (1-line .min)');

// 2. offscreen.html
let offscreenHtml = fs.readFileSync(path.join(SRC_DIR, 'offscreen.html'), 'utf8');
offscreenHtml = offscreenHtml.replace('assets/js/peerjs.min.js', FILE_NAMES.peerjs);
offscreenHtml = offscreenHtml.replace('assets/libs/js/tf.min.js', FILE_NAMES.tf);
offscreenHtml = offscreenHtml.replace('assets/libs/js/tf-backend-webgpu.min.js', FILE_NAMES.tfWebgpu);
offscreenHtml = offscreenHtml.replace('src="offscreen.js"', `src="${FILE_NAMES.offscreen}"`);
fs.writeFileSync(path.join(DIST_DIR, 'offscreen.html'), minifyHtml(offscreenHtml), 'utf8');
console.log('    ✓ offscreen.html minified');

// 3. player.html
let playerHtml = fs.readFileSync(path.join(SRC_DIR, 'player.html'), 'utf8');
playerHtml = playerHtml.replace('src="player.js"', `src="${FILE_NAMES.player}"`);
fs.writeFileSync(path.join(DIST_DIR, 'player.html'), minifyHtml(playerHtml), 'utf8');
console.log('    ✓ player.html minified (1-line .min)');

// 4. welcome.html — static first-run page opened by runtime.onInstalled.
let welcomeHtml = fs.readFileSync(path.join(SRC_DIR, 'welcome.html'), 'utf8');
welcomeHtml = welcomeHtml.replace('./assets/logo.png', './' + FILE_NAMES.logo);
fs.writeFileSync(path.join(DIST_DIR, 'welcome.html'), minifyHtml(welcomeHtml), 'utf8');
console.log('    ✓ welcome.html minified');

// Process Manifest.json
const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'manifest.json'), 'utf8'));
manifest.action.default_popup = 'popup.html';
manifest.action.default_icon = FILE_NAMES.logo;
manifest.icons = { '128': FILE_NAMES.logo };
manifest.background.service_worker = FILE_NAMES.background;
manifest.content_scripts = [
  {
    matches: ['<all_urls>'],
    js: [FILE_NAMES.videoDelay, FILE_NAMES.videoZoom],
    run_at: 'document_start',
    all_frames: true
  }
];

manifest.web_accessible_resources = [
  {
    matches: ['<all_urls>'],
    resources: [
      FILE_NAMES.signalsmith,
      FILE_NAMES.phosphorCss,
      FILE_NAMES.phosphorFont,
      FILE_NAMES.peerjs,
      FILE_NAMES.tf,
      FILE_NAMES.tfWebgpu,
      FILE_NAMES.vocalWorklet,
      FILE_NAMES.webStftSimd,
      FILE_NAMES.webStftScalar,
      FILE_NAMES.webModel,
      FILE_NAMES.webSecurityWasm,
      FILE_NAMES.videoDelayWorker,
      FILE_NAMES.logo
    ]
  }
];

fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest), 'utf8');

// Cleanup Temp Dir
fs.rmSync(TEMP_DIR, { recursive: true, force: true });

// 8. Verify all generated JS files for syntax errors
console.log('\n[8/9] Validating syntax of all JS files in production build...');
const jsFiles = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
jsFiles.forEach((f) => {
  run('node -c "' + path.join(DIST_DIR, f) + '"', 'Syntax check: ' + f);
});

// 9. Generate Store-ready ZIP Archive
console.log('\n[9/9] Generating store-ready ZIP archive...');
if (fs.existsSync(ZIP_FILE)) fs.unlinkSync(ZIP_FILE);
run('cd "' + DIST_DIR + '" && zip -rq "' + ZIP_FILE + '" .', 'Compressing extension package');

console.log('\n====================================================');
console.log('✅ 100% PRODUCTION BUILD & HARDENING SUCCESSFUL!');
console.log('📁 Distribution folder: dist/next-amp-extension-prod/');
console.log('📦 Store Ready ZIP:     dist/next-amp-extension-prod.zip');
console.log('====================================================');

#!/usr/bin/env node
/**
 * Next-Amp Extension - Production Hardened Build Pipeline
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

console.log('====================================================');
console.log('NEXT-AMP PRODUCTION BUILD & COMPLETE HARDENING');
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
  vocalWorker: getMangledName('vocal-worker', '.js'),
  videoDelayWorker: getMangledName('video-delay-worker', '.js'),
  debugAiJs: getMangledName('debug-ai', '.js'),

  // Vendor JS & MJS libraries
  tailwind: getMangledName('tailwindcss', '.js'),
  peerjs: getMangledName('peerjs', '.js'),
  tf: getMangledName('tf', '.js'),
  signalsmith: getMangledName('signalsmith', '.mjs'),

  // WebAssembly cores
  secWasm: getMangledName('security-core', '.wasm'),
  stftSimd: getMangledName('stft_simd', '.wasm'),
  stftScalar: getMangledName('stft_scalar', '.wasm'),

  // AI Models
  modelJson: getMangledName('model', '.json'),
  modelBin: getMangledName('group1-shard1of1', '.bin'),

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

// 1. Prepare Output Directories
console.log('\n[1/8] Cleaning and preparing output directories...');
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Compile WASM Security Core
console.log('\n[2/8] Compiling WebAssembly Security Core...');
const emccPath = fs.existsSync('/opt/homebrew/bin/emcc') ? '/opt/homebrew/bin/emcc' : 'emcc';
const wasmSrc = path.join(ROOT_DIR, 'scripts', 'security', 'security-core.c');
const wasmOut = path.join(DIST_DIR, FILE_NAMES.secWasm);

run(
  emccPath + ' "' + wasmSrc + '" -O3 -s STANDALONE_WASM=1 --no-entry -s EXPORTED_FUNCTIONS=_verify_extension_id,_validate_token,_compute_dsp_mask_seed -o "' + wasmOut + '"',
  'Compiling security-core.c with emcc -O3 -> ' + FILE_NAMES.secWasm
);
console.log('    ✓ ' + FILE_NAMES.secWasm + ' compiled successfully');

// 3. Bundle JS Entry Points & Workers via esbuild
console.log('\n[3/8] Bundling JavaScript modules & workers via esbuild...');

const bundles = [
  { in: 'popup.js', out: FILE_NAMES.popup, temp: 'popup.tmp.js', format: 'esm', injectGuard: true },
  { in: 'background.js', out: FILE_NAMES.background, temp: 'background.tmp.js', format: 'esm', injectGuard: false },
  { in: 'offscreen.js', out: FILE_NAMES.offscreen, temp: 'offscreen.tmp.js', format: 'esm', injectGuard: true },
  { in: 'video-delay.js', out: FILE_NAMES.videoDelay, temp: 'video-delay.tmp.js', format: 'iife', injectGuard: false },
  { in: 'video-zoom.js', out: FILE_NAMES.videoZoom, temp: 'video-zoom.tmp.js', format: 'iife', injectGuard: false },
  { in: 'player.js', out: FILE_NAMES.player, temp: 'player.tmp.js', format: 'esm', injectGuard: false },
  { in: 'remote/app.js', out: FILE_NAMES.remoteApp, temp: 'remote-app.tmp.js', format: 'iife', injectGuard: false },
  { in: 'assets/js/config.js', out: FILE_NAMES.config, temp: 'config.tmp.js', format: 'iife', injectGuard: false },
  { in: 'video-delay-worker.js', out: FILE_NAMES.videoDelayWorker, temp: 'video-delay-worker.tmp.js', format: 'iife', injectGuard: false },
  { in: 'modules/ai-vocal/vocal-worker.js', out: FILE_NAMES.vocalWorker, temp: 'vocal-worker.tmp.js', format: 'iife', injectGuard: false },
  { in: 'debug-ai.js', out: FILE_NAMES.debugAiJs, temp: 'debug-ai.tmp.js', format: 'esm', injectGuard: false }
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
console.log('\n[4/8] Rewriting cross-references to hashed assets in JS bundles...');

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
replaceInFile(offscreenTemp, 'modules/ai-vocal/stft_simd.wasm', FILE_NAMES.stftSimd);
replaceInFile(offscreenTemp, 'modules/ai-vocal/stft_scalar.wasm', FILE_NAMES.stftScalar);
replaceInFile(offscreenTemp, 'model/model.json', FILE_NAMES.modelJson);
replaceInFile(offscreenTemp, 'assets/libs/mjs/SignalsmithStretch.mjs', FILE_NAMES.signalsmith);

// Rewrite in video-delay bundle
const videoDelayTemp = path.join(TEMP_DIR, 'video-delay.tmp.js');
replaceInFile(videoDelayTemp, 'video-delay-worker.js', FILE_NAMES.videoDelayWorker);

// Rewrite in vocal-worker bundle
const vocalWorkerTemp = path.join(TEMP_DIR, 'vocal-worker.tmp.js');
replaceInFile(vocalWorkerTemp, '/assets/libs/js/tf.min.js', '/' + FILE_NAMES.tf);
replaceInFile(vocalWorkerTemp, '../../assets/libs/js/tf.min.js', './' + FILE_NAMES.tf);
replaceInFile(vocalWorkerTemp, '/modules/ai-vocal/stft_simd.wasm', '/' + FILE_NAMES.stftSimd);
replaceInFile(vocalWorkerTemp, 'stft_simd.wasm', FILE_NAMES.stftSimd);
replaceInFile(vocalWorkerTemp, 'stft_scalar.wasm', FILE_NAMES.stftScalar);
replaceInFile(vocalWorkerTemp, '/model/model.json', '/' + FILE_NAMES.modelJson);

// Rewrite in debug-ai bundle
const debugAiTemp = path.join(TEMP_DIR, 'debug-ai.tmp.js');
replaceInFile(debugAiTemp, 'modules/ai-vocal/stft_simd.wasm', FILE_NAMES.stftSimd);
replaceInFile(debugAiTemp, 'model/model.json', FILE_NAMES.modelJson);

// Inject Security Guard into popup & offscreen
let guardCode = fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'security', 'security-guard.js'), 'utf8');
guardCode = guardCode.replace('security-core.wasm', FILE_NAMES.secWasm);

[popupTemp, offscreenTemp].forEach((tempFile) => {
  const content = fs.readFileSync(tempFile, 'utf8');
  fs.writeFileSync(tempFile, guardCode + '\n' + content, 'utf8');
});

// 5. Code Obfuscation
console.log('\n[5/8] Applying Advanced Code Obfuscation & Anti-Tamper Protection...');

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
  } else if (b.temp === 'debug-ai.tmp.js') {
    run(
      'npx javascript-obfuscator "' + tempFile + '" ' +
        '--output "' + destFile + '" ' +
        '--target browser-no-eval ' +
        '--compact true ' +
        '--string-array true ' +
        '--string-array-encoding rc4 ' +
        '--string-array-threshold 0.8',
      'Obfuscating diagnostic -> ' + b.out
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

// Minify vocal-worklet.js (must run in AudioWorkletGlobalScope without window/document/timers)
run(
  'npx esbuild "' + path.join(SRC_DIR, 'modules', 'ai-vocal', 'vocal-worklet.js') + '" --minify --target=chrome110 --outfile="' + path.join(DIST_DIR, FILE_NAMES.vocalWorklet) + '"',
  'Minifying AudioWorklet -> ' + FILE_NAMES.vocalWorklet
);

// 6. Packaging & Minifying Libraries, Models, WASM
console.log('\n[6/8] Packaging and minifying vendor libraries, WASM, and AI models...');

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

// Copy WASM files to hashed names
fs.copyFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_simd.wasm'), path.join(DIST_DIR, FILE_NAMES.stftSimd));
fs.copyFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_scalar.wasm'), path.join(DIST_DIR, FILE_NAMES.stftScalar));

// Copy AI Model Shard
fs.copyFileSync(path.join(SRC_DIR, 'model', 'group1-shard1of1.bin'), path.join(DIST_DIR, FILE_NAMES.modelBin));

// Process and Hash AI Model JSON
const modelJsonData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'model', 'model.json'), 'utf8'));
if (modelJsonData.weightsManifest && modelJsonData.weightsManifest[0]) {
  modelJsonData.weightsManifest[0].paths = [FILE_NAMES.modelBin];
}
fs.writeFileSync(path.join(DIST_DIR, FILE_NAMES.modelJson), JSON.stringify(modelJsonData), 'utf8');

// Copy Logo
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'logo.png'), path.join(DIST_DIR, FILE_NAMES.logo));

// Copy Font
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'fonts', 'Phosphor-Bold.woff2'), path.join(DIST_DIR, FILE_NAMES.phosphorFont));

// 7. Minifying CSS & HTML (.min)
console.log('\n[7/8] Minifying CSS stylesheets and HTML pages (.min)...');

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
offscreenHtml = offscreenHtml.replace('src="offscreen.js"', `src="${FILE_NAMES.offscreen}"`);
fs.writeFileSync(path.join(DIST_DIR, 'offscreen.html'), minifyHtml(offscreenHtml), 'utf8');
console.log('    ✓ offscreen.html minified');

// 3. player.html
let playerHtml = fs.readFileSync(path.join(SRC_DIR, 'player.html'), 'utf8');
playerHtml = playerHtml.replace('src="player.js"', `src="${FILE_NAMES.player}"`);
fs.writeFileSync(path.join(DIST_DIR, 'player.html'), minifyHtml(playerHtml), 'utf8');
console.log('    ✓ player.html minified (1-line .min)');

// 4. dos-remote.html
let dosRemoteHtml = fs.readFileSync(path.join(SRC_DIR, 'remote', 'dos-remote.html'), 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'dos-remote.html'), minifyHtml(dosRemoteHtml), 'utf8');
console.log('    ✓ dos-remote.html minified (1-line .min)');

// 5. debug-ai.html
let debugAiHtml = fs.readFileSync(path.join(SRC_DIR, 'debug-ai.html'), 'utf8');
debugAiHtml = debugAiHtml.replace('assets/libs/js/tf.min.js', FILE_NAMES.tf);
debugAiHtml = debugAiHtml.replace('src="debug-ai.js"', `src="${FILE_NAMES.debugAiJs}"`);
fs.writeFileSync(path.join(DIST_DIR, 'debug-ai.html'), minifyHtml(debugAiHtml), 'utf8');
console.log('    ✓ debug-ai.html minified');

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
      FILE_NAMES.vocalWorklet,
      FILE_NAMES.vocalWorker,
      FILE_NAMES.stftSimd,
      FILE_NAMES.stftScalar,
      FILE_NAMES.modelJson,
      FILE_NAMES.modelBin,
      FILE_NAMES.secWasm,
      FILE_NAMES.videoDelayWorker,
      FILE_NAMES.debugAiJs,
      FILE_NAMES.logo,
      'dos-remote.html',
      'debug-ai.html'
    ]
  }
];

fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest), 'utf8');

// Cleanup Temp Dir
fs.rmSync(TEMP_DIR, { recursive: true, force: true });

// 8. Verify all generated JS files for syntax errors
console.log('\n[8/8] Validating syntax of all JS files in production build...');
const jsFiles = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
jsFiles.forEach((f) => {
  run('node -c "' + path.join(DIST_DIR, f) + '"', 'Syntax check: ' + f);
});

// Generate Store-ready ZIP Archive
console.log('\nGenerating store-ready ZIP archive...');
if (fs.existsSync(ZIP_FILE)) fs.unlinkSync(ZIP_FILE);
run('cd "' + DIST_DIR + '" && zip -rq "' + ZIP_FILE + '" .', 'Compressing extension package');

console.log('\n====================================================');
console.log('✅ 100% PRODUCTION BUILD & HARDENING SUCCESSFUL!');
console.log('📁 Distribution folder: dist/next-amp-extension-prod/');
console.log('📦 Store Ready ZIP:     dist/next-amp-extension-prod.zip');
console.log('====================================================');

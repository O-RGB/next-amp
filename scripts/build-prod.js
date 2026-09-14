#!/usr/bin/env node
/**
 * NextSona Extension - Production Build Pipeline
 *
 * Features:
 * 1. 100% File Name Mangling / Content Hashing (Every file except .html and manifest.json)
 * 2. WebAssembly (WASM) Security Core (compiled from C via emcc)
 * 3. Extension ID Lock verification inside WASM bytecode
 * 4. Profile-specific bundling for Store and Go development builds
 * 5. esbuild bundling + asset packaging
 * 6. Automated cross-reference URL rewriting for audio DSP, AI models, workers, fonts & styles
 * 7. Complete HTML & CSS minification (.min) + inline script/style minification
 * 8. ZIP package generation
 * 9. Optional native GO engine for the internal Go development profile
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const ORIGINAL_SRC_DIR = path.join(ROOT_DIR, 'nextsona-extension');
let SRC_DIR = ORIGINAL_SRC_DIR;
const profileArg = process.argv.find((arg) => arg.startsWith('--profile='));
const BUILD_PROFILE = (profileArg ? profileArg.split('=')[1] : 'store').trim().toLowerCase();
if (!['store', 'go-dev'].includes(BUILD_PROFILE)) {
  console.error(`[-] Unknown extension build profile: ${BUILD_PROFILE}`);
  console.error('    Use --profile=store or --profile=go-dev.');
  process.exit(1);
}
const GO_ENGINE_ENABLED = BUILD_PROFILE === 'go-dev';
const STORE_REVIEW_BUILD = BUILD_PROFILE === 'store';
const OUTPUT_NAME = BUILD_PROFILE === 'store'
  ? 'nextsona-extension-store'
  : 'nextsona-extension-go-dev';
const DIST_DIR = path.join(ROOT_DIR, 'dist', OUTPUT_NAME);
const TEMP_DIR = path.join(ROOT_DIR, 'dist', 'temp');
const ZIP_FILE = path.join(ROOT_DIR, 'dist', `${OUTPUT_NAME}.zip`);
const WEB_ASSET_KEY_PLACEHOLDER = '__NEXTSONA_WEB_ASSET_KEY__';
const WEB_ASSET_MAGIC = Buffer.from('NSONAWB1', 'ascii');
const WEB_ASSET_HEADER_BYTES = 20;
const webAssetKey = crypto.randomBytes(32);
const webAssetKeyB64 = webAssetKey.toString('base64');

console.log('====================================================');
console.log(`NEXTSONA EXTENSION BUILD [${BUILD_PROFILE.toUpperCase()}]`);
console.log('====================================================');

// Internal builds keep deterministic hashed names. Store builds deliberately
// use readable names so reviewers can map manifest entries to their purpose.
function getMangledName(key, ext = '.js', storeName = key) {
  if (STORE_REVIEW_BUILD) return `${storeName}${ext}`;
  const hash = crypto.createHash('md5').update('nextsona_' + key).digest('hex').slice(0, 10);
  return `${hash}${ext}`;
}

const FILE_NAMES = {
  // Bundled JS entries
  popup: getMangledName('popup', '.js', 'popup'),
  background: getMangledName('background', '.js', 'background'),
  offscreen: getMangledName('offscreen', '.js', 'offscreen'),
  videoDelay: getMangledName('video-delay', '.js', 'video-delay'),
  videoZoom: getMangledName('video-zoom', '.js', 'video-zoom'),
  player: getMangledName('player', '.js', 'player'),
  remoteApp: getMangledName('remote-app', '.js', 'remote-app'),

  // Config & Workers & Standalone JS
  config: getMangledName('config', '.js', 'config'),
  vocalWorklet: getMangledName('vocal-worklet', '.js', 'vocal-worklet'),
  videoDelayWorker: getMangledName('video-delay-worker', '.js', 'video-delay-worker'),

  // Vendor JS & MJS libraries
  tailwind: getMangledName('tailwindcss', '.js', 'tailwindcss'),
  peerjs: getMangledName('peerjs', '.js', 'peerjs'),
  tf: getMangledName('tf', '.js', 'tensorflow'),
  tfWebgpu: getMangledName('tf-backend-webgpu', '.js', 'tf-backend-webgpu'),
  signalsmith: getMangledName('signalsmith', '.mjs', 'signalsmith-stretch'),

  // WebAssembly cores
  webSecurityWasm: getMangledName('security-core-protected', '.dat', 'security-core'),
  webStftSimd: getMangledName('stft_simd-protected', STORE_REVIEW_BUILD ? '.wasm' : '.dat', 'stft_simd'),
  webStftScalar: getMangledName('stft_scalar-protected', STORE_REVIEW_BUILD ? '.wasm' : '.dat', 'stft_scalar'),

  // AI Models
  webModel: STORE_REVIEW_BUILD ? 'model/model.json' : getMangledName('model-protected', '.dat'),
  webModelWeights: STORE_REVIEW_BUILD ? 'model/group1-shard1of1.bin' : null,

  // Styles, Fonts, Assets
  stylesCss: getMangledName('styles', '.css', 'styles'),
  phosphorCss: getMangledName('phosphor', '.css', 'phosphor'),
  phosphorFont: getMangledName('phosphor-font', '.woff2', 'phosphor-bold'),
  logo: getMangledName('logo', '.png', 'logo')
};

console.log('Profile-specific hashed file mapping table:');
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

// The native engine is an optional internal companion. Never build it as part
// of the Store release path, so a Store build cannot accidentally imply that
// the unfinished native feature is shipped or supported.
if (GO_ENGINE_ENABLED) {
  console.log('\n[0/9] Building native GO engine binaries...');
  run(
    'bash "' + path.join(ROOT_DIR, 'nextsona-engine-go', 'build.sh') + '"',
    'Building macOS + Windows GO engine binaries'
  );
} else {
  console.log('\n[0/9] Store profile: skipping native GO engine build');
}

// 1. Prepare Output Directories
console.log('\n[1/9] Cleaning and preparing output directories...');
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// Build from an isolated source snapshot. For the Store profile only the
// stable engine-client import point is replaced with a no-op adapter; the
// working tree is never modified and the Go development profile keeps the
// real adapter unchanged.
const PROFILE_SRC_DIR = path.join(TEMP_DIR, 'source');
fs.cpSync(ORIGINAL_SRC_DIR, PROFILE_SRC_DIR, { recursive: true });
SRC_DIR = PROFILE_SRC_DIR;
if (!GO_ENGINE_ENABLED) {
  fs.copyFileSync(
    path.join(ORIGINAL_SRC_DIR, 'modules', 'ai-vocal', 'engine-client-store-stub.js'),
    path.join(SRC_DIR, 'modules', 'ai-vocal', 'engine-client-runtime.js')
  );
  fs.writeFileSync(
    path.join(SRC_DIR, 'modules', 'ai-vocal', 'build-feature-flags.js'),
    'export const GO_ENGINE_ENABLED = false;\n',
    'utf8'
  );
  fs.copyFileSync(
    path.join(ORIGINAL_SRC_DIR, 'modules', 'ai-vocal', 'web-protected-assets-store.mjs'),
    path.join(SRC_DIR, 'modules', 'ai-vocal', 'web-protected-assets.mjs')
  );
} else {
  fs.writeFileSync(
    path.join(SRC_DIR, 'modules', 'ai-vocal', 'build-feature-flags.js'),
    'export const GO_ENGINE_ENABLED = true;\n',
    'utf8'
  );
}

// 2. Compile the anti-copy core only for internal builds. Store packages must
// not contain concealed executable logic or anti-review/anti-debug behavior.
console.log('\n[2/9] Preparing profile-specific security assets...');
const emccPath = fs.existsSync('/opt/homebrew/bin/emcc') ? '/opt/homebrew/bin/emcc' : 'emcc';
const wasmSrc = path.join(ROOT_DIR, 'scripts', 'security', 'security-core.c');
const wasmPlainOut = path.join(TEMP_DIR, 'security-core.wasm');

if (GO_ENGINE_ENABLED) {
  run(
    emccPath + ' "' + wasmSrc + '" -O3 -s STANDALONE_WASM=1 --no-entry -s EXPORTED_FUNCTIONS=_verify_extension_id,_validate_token,_compute_dsp_mask_seed -o "' + wasmPlainOut + '"',
    'Compiling security-core.c with emcc -O3 -> ' + FILE_NAMES.webSecurityWasm
  );
  console.log('    ✓ ' + FILE_NAMES.webSecurityWasm + ' compiled successfully');
} else {
  console.log('    ✓ Store profile: security guard and encrypted security WASM excluded');
}

// 3. Bundle JS Entry Points & Workers via esbuild
console.log('\n[3/9] Bundling JavaScript modules & workers via esbuild...');

const bundles = [
  { in: 'popup.js', out: FILE_NAMES.popup, temp: 'popup.tmp.js', format: 'esm', injectGuard: true },
  { in: 'background.js', out: FILE_NAMES.background, temp: 'background.tmp.js', format: 'esm', injectGuard: false },
  { in: 'offscreen.js', out: FILE_NAMES.offscreen, temp: 'offscreen.tmp.js', format: 'esm', injectGuard: true },
  { in: 'video-delay.js', out: FILE_NAMES.videoDelay, temp: 'video-delay.tmp.js', format: 'iife', injectGuard: false },
  { in: 'video-zoom.js', out: FILE_NAMES.videoZoom, temp: 'video-zoom.tmp.js', format: 'iife', injectGuard: false },
  { in: 'player.js', out: FILE_NAMES.player, temp: 'player.tmp.js', format: 'esm', injectGuard: false },
  ...(GO_ENGINE_ENABLED
    ? [{ in: 'remote/app.js', out: FILE_NAMES.remoteApp, temp: 'remote-app.tmp.js', format: 'iife', injectGuard: false }]
    : []),
  ...(GO_ENGINE_ENABLED
    ? [{ in: 'assets/js/config.js', out: FILE_NAMES.config, temp: 'config.tmp.js', format: 'iife', injectGuard: false }]
    : []),
  { in: 'video-delay-worker.js', out: FILE_NAMES.videoDelayWorker, temp: 'video-delay-worker.tmp.js', format: 'iife', injectGuard: false }
];

bundles.forEach((b) => {
  const srcFile = path.join(SRC_DIR, b.in);
  const tempFile = path.join(TEMP_DIR, b.temp);
  if (b.in === 'popup.js' || b.in === 'offscreen.js') {
    console.log('[+] Bundling ' + b.in + ' -> ' + b.temp + '...');
  }
  try {
    esbuild.buildSync({
      entryPoints: [srcFile],
      bundle: true,
      format: b.format,
      target: 'chrome110',
      outfile: tempFile,
      define: { __NEXTSONA_GO_ENGINE_ENABLED__: GO_ENGINE_ENABLED ? 'true' : 'false' },
      minifySyntax: true,
      treeShaking: true,
      logLevel: 'silent'
    });
  } catch (error) {
    console.error('[-] Error during: Bundling ' + b.in + ' -> ' + b.temp);
    console.error(error.message || error);
    process.exit(1);
  }
});

// 4. Cross-Reference Rewriting in JS Bundles
console.log('\n[4/9] Rewriting cross-references to hashed assets in JS bundles...');

function replaceInFile(filePath, search, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(search).join(replacement);
  fs.writeFileSync(filePath, content, 'utf8');
}

function removePackagingMetadata(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removePackagingMetadata(fullPath);
    } else if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') {
      fs.unlinkSync(fullPath);
    }
  }
}

// Rewrite in popup bundle
const popupTemp = path.join(TEMP_DIR, 'popup.tmp.js');
replaceInFile(popupTemp, 'assets/libs/mjs/SignalsmithStretch.mjs', FILE_NAMES.signalsmith);

// Rewrite dynamically injected video content scripts. The source build uses
// stable names for readability, while the production manifest uses hashed
// names, so runtime injection must receive the same hashed files.
const backgroundTemp = path.join(TEMP_DIR, 'background.tmp.js');
replaceInFile(backgroundTemp, 'video-delay.js', FILE_NAMES.videoDelay);
replaceInFile(backgroundTemp, 'video-zoom.js', FILE_NAMES.videoZoom);

// Rewrite in offscreen bundle
const offscreenTemp = path.join(TEMP_DIR, 'offscreen.tmp.js');
replaceInFile(offscreenTemp, 'modules/ai-vocal/vocal-worklet.js', FILE_NAMES.vocalWorklet);
replaceInFile(offscreenTemp, 'modules/ai-vocal/stft_simd.wasm', FILE_NAMES.webStftSimd);
replaceInFile(offscreenTemp, 'modules/ai-vocal/stft_scalar.wasm', FILE_NAMES.webStftScalar);
replaceInFile(offscreenTemp, 'model/model.json', FILE_NAMES.webModel);
replaceInFile(offscreenTemp, 'assets/libs/mjs/SignalsmithStretch.mjs', FILE_NAMES.signalsmith);
replaceInFile(offscreenTemp, 'assets/libs/js/tf-backend-webgpu.min.js', FILE_NAMES.tfWebgpu);
if (GO_ENGINE_ENABLED) {
  replaceInFile(offscreenTemp, WEB_ASSET_KEY_PLACEHOLDER, webAssetKeyB64);
}

// Rewrite in video-delay bundle
const videoDelayTemp = path.join(TEMP_DIR, 'video-delay.tmp.js');
replaceInFile(videoDelayTemp, 'video-delay-worker.js', FILE_NAMES.videoDelayWorker);

// Anti-copy/anti-debug guards are internal-only. They intentionally never
// enter the Store review package.
if (GO_ENGINE_ENABLED) {
  let guardCode = fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'security', 'security-guard.js'), 'utf8');
  guardCode = guardCode
    .split('security-core.wasm').join(FILE_NAMES.webSecurityWasm)
    .split(WEB_ASSET_KEY_PLACEHOLDER).join(webAssetKeyB64);

  [popupTemp, offscreenTemp].forEach((tempFile) => {
    const content = fs.readFileSync(tempFile, 'utf8');
    fs.writeFileSync(tempFile, guardCode + '\n' + content, 'utf8');
  });
}

// 5. Code Obfuscation
console.log('\n[5/9] Applying production JavaScript transforms...');

bundles.forEach((b) => {
  const tempFile = path.join(TEMP_DIR, b.temp);
  const destFile = path.join(DIST_DIR, b.out);

  if (STORE_REVIEW_BUILD) {
    const transformed = esbuild.transformSync(fs.readFileSync(tempFile, 'utf8'), {
      loader: 'js',
      target: 'chrome110',
      minify: true,
      legalComments: 'inline'
    });
    fs.writeFileSync(destFile, transformed.code, 'utf8');
    console.log('    ✓ Reviewable esbuild minification -> ' + b.out);
    return;
  }

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

// Resolve the worklet's profile-specific native engine token before protecting
// it. The Store worklet therefore contains only the browser token and cannot
// switch into the internal native protocol even if it receives stale state.
const vocalWorkletSource = path.join(SRC_DIR, 'modules', 'ai-vocal', 'vocal-worklet.js');
const vocalWorkletTemp = path.join(TEMP_DIR, 'vocal-worklet.tmp.js');
try {
  const vocalWorkletCode = esbuild.transformSync(
    fs.readFileSync(vocalWorkletSource, 'utf8'),
    {
      loader: 'js',
      target: 'chrome110',
      minifySyntax: true,
      define: {
        __NEXTSONA_GO_ENGINE_TYPE__: JSON.stringify(GO_ENGINE_ENABLED ? 'go_native' : 'webgl')
      }
    }
  ).code;
  fs.writeFileSync(vocalWorkletTemp, vocalWorkletCode, 'utf8');
} catch (error) {
  console.error('[-] Error during: Preparing profile-specific AudioWorklet');
  console.error(error.message || error);
  process.exit(1);
}

// Keep the Store AudioWorklet minified but readable. Internal builds may keep
// the legacy protection transform without affecting the review artifact.
if (STORE_REVIEW_BUILD) {
  const workletCode = esbuild.transformSync(fs.readFileSync(vocalWorkletTemp, 'utf8'), {
    loader: 'js',
    target: 'chrome110',
    minify: true,
    legalComments: 'inline'
  }).code;
  fs.writeFileSync(path.join(DIST_DIR, FILE_NAMES.vocalWorklet), workletCode, 'utf8');
  console.log('    ✓ Reviewable AudioWorklet minification -> ' + FILE_NAMES.vocalWorklet);
} else {
  run(
    'npx javascript-obfuscator "' + vocalWorkletTemp + '" ' +
      '--output "' + path.join(DIST_DIR, FILE_NAMES.vocalWorklet) + '" ' +
      '--target browser-no-eval ' +
      '--compact true ' +
      '--control-flow-flattening false ' +
      '--dead-code-injection false ' +
      '--string-array true ' +
      '--string-array-encoding rc4 ' +
      '--string-array-threshold 0.8',
    'Obfuscating AudioWorklet (internal build) -> ' + FILE_NAMES.vocalWorklet
  );
}

// 6. Packaging & Minifying Libraries, Models, WASM
console.log('\n[6/9] Packaging and minifying vendor libraries, WASM, and AI models...');

// The internal Go/dev package keeps the browser Tailwind compiler for rapid
// UI work. The Store package receives precompiled static CSS later instead,
// so no runtime CSS compiler is shipped to reviewers or users.
if (GO_ENGINE_ENABLED) {
  run(
    'npx esbuild "' + path.join(SRC_DIR, 'assets', 'js', 'tailwindcss.js') + '" --minify --outfile="' + path.join(DIST_DIR, FILE_NAMES.tailwind) + '"',
    'Minifying Tailwind CSS -> ' + FILE_NAMES.tailwind
  );
} else {
  console.log('    ✓ Store profile: runtime Tailwind compiler excluded');
}

run(
  'npx esbuild "' + path.join(SRC_DIR, 'assets', 'libs', 'mjs', 'SignalsmithStretch.mjs') + '" --minify --outfile="' + path.join(DIST_DIR, FILE_NAMES.signalsmith) + '"',
  'Minifying SignalsmithStretch -> ' + FILE_NAMES.signalsmith
);

// Copy pre-minified libraries
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'js', 'peerjs.min.js'), path.join(DIST_DIR, FILE_NAMES.peerjs));
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'libs', 'js', 'tf.min.js'), path.join(DIST_DIR, FILE_NAMES.tf));
fs.copyFileSync(path.join(SRC_DIR, 'assets', 'libs', 'js', 'tf-backend-webgpu.min.js'), path.join(DIST_DIR, FILE_NAMES.tfWebgpu));

// Store review builds package the exact tested WASM/model bytes in their
// standard local formats. Internal builds may retain encrypted packaging.
const stftSimd = fs.readFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_simd.wasm'));
const stftScalar = fs.readFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_scalar.wasm'));
if (STORE_REVIEW_BUILD) {
  fs.copyFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_simd.wasm'), path.join(DIST_DIR, FILE_NAMES.webStftSimd));
  fs.copyFileSync(path.join(SRC_DIR, 'modules', 'ai-vocal', 'stft_scalar.wasm'), path.join(DIST_DIR, FILE_NAMES.webStftScalar));
  fs.mkdirSync(path.join(DIST_DIR, 'model'), { recursive: true });
  fs.copyFileSync(path.join(SRC_DIR, 'model', 'model.json'), path.join(DIST_DIR, FILE_NAMES.webModel));
  fs.copyFileSync(path.join(SRC_DIR, 'model', 'group1-shard1of1.bin'), path.join(DIST_DIR, FILE_NAMES.webModelWeights));
} else {
  writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webStftSimd), stftSimd);
  writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webStftScalar), stftScalar);

  const modelJsonData = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'model', 'model.json'), 'utf8'));
  const modelWeights = fs.readFileSync(path.join(SRC_DIR, 'model', 'group1-shard1of1.bin'));
  const modelPayload = createProtectedModelPayload(modelJsonData, modelWeights);
  writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webModel), modelPayload);

  const securityWasm = fs.readFileSync(wasmPlainOut);
  writeVerifiedProtectedAsset(path.join(DIST_DIR, FILE_NAMES.webSecurityWasm), securityWasm);
}

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

// Minify styles.css. For Store builds, prepend Tailwind's generated static
// stylesheet so the popup has the same utility classes without executable
// runtime CSS generation.
let stylesCssContent = fs.readFileSync(path.join(SRC_DIR, 'styles.css'), 'utf8');
if (STORE_REVIEW_BUILD) {
  const compiledTailwindPath = path.join(TEMP_DIR, 'tailwind-store.css');
  const tailwindCliPath = require.resolve('tailwindcss/lib/cli.js');
  run(
    'node "' + tailwindCliPath + '" -c "' + path.join(ROOT_DIR, 'tailwind.config.cjs') + '" ' +
      '-i "' + path.join(SRC_DIR, 'assets', 'css', 'tailwind-store-input.css') + '" ' +
      '-o "' + compiledTailwindPath + '" --minify',
    'Compiling static Tailwind CSS for Store profile'
  );
  stylesCssContent = fs.readFileSync(compiledTailwindPath, 'utf8') + '\n' + stylesCssContent;
}
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

function stripProfileSections(html) {
  if (GO_ENGINE_ENABLED) return html;
  return html.replace(
    /\s*<!--\s*NEXTSONA_GO_ENGINE_BEGIN\s*-->[\s\S]*?<!--\s*NEXTSONA_GO_ENGINE_END\s*-->/gi,
    ''
  );
}

// 1. popup.html
let popupHtml = stripProfileSections(fs.readFileSync(path.join(SRC_DIR, 'popup.html'), 'utf8'));
if (STORE_REVIEW_BUILD) {
  popupHtml = popupHtml
    .replace(/\s*<script\s+src=["']\.\/assets\/js\/tailwindcss\.js["']><\/script>/i, '')
    .replace(/\s*<script\s+src=["']\.\/assets\/js\/config\.js["']><\/script>/i, '');
} else {
  popupHtml = popupHtml.replace('./assets/js/tailwindcss.js', './' + FILE_NAMES.tailwind);
  popupHtml = popupHtml.replace('./assets/js/config.js', './' + FILE_NAMES.config);
}
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
manifest.permissions = (manifest.permissions || []).filter((permission) => permission !== 'tabs');

if (STORE_REVIEW_BUILD) {
  delete manifest.host_permissions;
  delete manifest.content_scripts;
  manifest.web_accessible_resources = [
    {
      matches: ['<all_urls>'],
      resources: [FILE_NAMES.videoDelayWorker]
    }
  ];
} else {
  manifest.host_permissions = ['<all_urls>'];
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
}

if (manifest.content_security_policy?.extension_pages) {
  manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages
    .replace(/\s(?:ws|http):\/\/(?:127\.0\.0\.1|localhost):\*/g, '');
  if (GO_ENGINE_ENABLED) {
    manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(
      "connect-src 'self'",
      "connect-src 'self' ws://127.0.0.1:41919 http://127.0.0.1:41919"
    );
  }
}

if (GO_ENGINE_ENABLED) {
  manifest.description = `${manifest.description} (Internal Go development build)`;
}

fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest), 'utf8');

if (STORE_REVIEW_BUILD) {
  fs.copyFileSync(
    path.join(ORIGINAL_SRC_DIR, 'THIRD-PARTY-NOTICES.txt'),
    path.join(DIST_DIR, 'THIRD-PARTY-NOTICES.txt')
  );
  fs.copyFileSync(
    path.join(ORIGINAL_SRC_DIR, 'model', 'LICENSE'),
    path.join(DIST_DIR, 'MODEL-LICENSE.txt')
  );
  fs.copyFileSync(
    path.join(ORIGINAL_SRC_DIR, 'LICENSE-APACHE-2.0.txt'),
    path.join(DIST_DIR, 'LICENSE-APACHE-2.0.txt')
  );
}

if (GO_ENGINE_ENABLED) {
  fs.writeFileSync(
    path.join(DIST_DIR, 'INTERNAL-GO-DEV-BUILD.txt'),
    'Internal NextSona Go development build. Do not upload this artifact to the Chrome Web Store.\n',
    'utf8'
  );
}

// Cleanup Temp Dir
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
removePackagingMetadata(DIST_DIR);

// 8. Verify all generated JS files for syntax errors
console.log('\n[8/9] Validating syntax of all JS files in production build...');
const jsFiles = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
jsFiles.forEach((f) => {
  run('node -c "' + path.join(DIST_DIR, f) + '"', 'Syntax check: ' + f);
});

// 9. Generate profile-specific ZIP archive
console.log(`\n[9/9] Generating ${BUILD_PROFILE} extension ZIP archive...`);
if (fs.existsSync(ZIP_FILE)) fs.unlinkSync(ZIP_FILE);
run('cd "' + DIST_DIR + '" && zip -rq "' + ZIP_FILE + '" .', 'Compressing extension package');

run(
  'node "' + path.join(ROOT_DIR, 'scripts', 'verify-extension-artifact.js') + '" --profile=' + BUILD_PROFILE,
  `Verifying ${BUILD_PROFILE} artifact boundary`
);

console.log('\n====================================================');
console.log(`✅ NEXTSONA ${BUILD_PROFILE.toUpperCase()} BUILD SUCCESSFUL!`);
console.log(`📁 Distribution folder: dist/${OUTPUT_NAME}/`);
console.log(`📦 ZIP:                 dist/${OUTPUT_NAME}.zip`);
console.log('====================================================');

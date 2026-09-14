#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { transformSync } from "esbuild";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const store = path.join(root, "dist", "nextsona-extension-store");
const manifest = JSON.parse(fs.readFileSync(path.join(store, "manifest.json"), "utf8"));

function fail(message) {
  console.error(`[-] Review readiness failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

assert(JSON.stringify([...manifest.permissions].sort()) === JSON.stringify([
  "activeTab", "offscreen", "scripting", "storage", "tabCapture"
].sort()), "Store permissions are not the approved minimum set");
assert(!manifest.host_permissions, "Store manifest still has host_permissions");
assert(!manifest.content_scripts, "Store manifest still has static content scripts");
assert(manifest.web_accessible_resources?.[0]?.resources?.join() === "video-delay-worker.js", "Unexpected WAR resources");
const storeCsp = manifest.content_security_policy?.extension_pages || "";
assert(!storeCsp.includes("*.peerjs.com"), "Store CSP still grants wildcard PeerJS access");
assert(storeCsp.includes("https://0.peerjs.com") && storeCsp.includes("wss://0.peerjs.com"), "Store CSP is missing the exact PeerJS signaling host");

const publicProtocolContext = { window: {}, TextEncoder };
vm.runInNewContext(
  fs.readFileSync(path.join(root, "nextsona-public-site", "assets", "js", "remote-protocol.js"), "utf8"),
  publicProtocolContext
);
const publicProtocol = publicProtocolContext.window.NextSonaRemoteProtocol;
assert(publicProtocol?.VERSION === 1, "Public Remote protocol version is missing");

const extensionProtocolSource = fs.readFileSync(
  path.join(root, "nextsona-extension", "modules", "remote-protocol.js"),
  "utf8"
);
const extensionProtocolModule = { exports: {} };
const extensionProtocolCode = transformSync(extensionProtocolSource, {
  format: "cjs",
  platform: "node",
  target: "node18",
}).code;
new Function("module", "exports", extensionProtocolCode)(
  extensionProtocolModule,
  extensionProtocolModule.exports
);
const extensionProtocol = extensionProtocolModule.exports;
assert(extensionProtocol.REMOTE_PROTOCOL_VERSION === publicProtocol.VERSION, "Protocol versions differ");

function comparableSchema(schema) {
  return Object.fromEntries(
    Object.entries(schema || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rule]) => {
        if (rule?.type === "number") {
          return [key, { type: "number", min: rule.min, max: rule.max }];
        }
        if (rule?.type === "enum") {
          return [key, { type: "enum", values: [...rule.values] }];
        }
        return [key, { type: rule?.type }];
      })
  );
}

assert(publicProtocol.PARAM_SCHEMA, "Public protocol schema is not exported for parity checks");
assert(extensionProtocol.REMOTE_PARAM_SCHEMA, "Extension protocol schema is not exported for parity checks");
assert(
  JSON.stringify(comparableSchema(publicProtocol.PARAM_SCHEMA)) ===
    JSON.stringify(comparableSchema(extensionProtocol.REMOTE_PARAM_SCHEMA)),
  "Public and Extension protocol schemas differ"
);

function expectBoth(key, value, index, expected, label) {
  const publicResult = publicProtocol.validateParam(key, value, index);
  const extensionResult = extensionProtocol.validateRemoteParam(key, value, index);
  assert((publicResult !== null) === expected, `Public protocol boundary failed: ${label}`);
  assert((extensionResult !== null) === expected, `Extension protocol boundary failed: ${label}`);
}

const validCases = [
  ["volume", 0.5], ["pan", -1], ["pitch", 12], ["reverb", 2],
  ["videoDelay", 5], ["videoZoom", 3], ["videoRotate", 360],
  ["videoPosX", -50], ["videoPosY", 50], ["isAudioMasterOn", true],
  ["isVocalOn", false], ["isEqOn", true], ["normalize", false],
  ["isVideoMasterOn", true], ["vocalMode", "karaoke"],
  ["videoQuality", "max"], ["eqPreset", "custom"], ["eq", 12],
];
for (const [key, value] of validCases) {
  const index = key === "eq" ? 0 : null;
  assert(publicProtocol.validateParam(key, value, index) !== null, `Public protocol rejected valid ${key}`);
  assert(extensionProtocol.validateRemoteParam(key, value, index) !== null, `Extension protocol rejected valid ${key}`);
}
for (const [key, rule] of Object.entries(publicProtocol.PARAM_SCHEMA)) {
  const index = key === "eq" ? 0 : null;
  if (rule.type === "number") {
    expectBoth(key, rule.min, index, true, `${key} minimum`);
    expectBoth(key, rule.max, index, true, `${key} maximum`);
    expectBoth(key, rule.min - 1, index, false, `${key} below minimum`);
    expectBoth(key, rule.max + 1, index, false, `${key} above maximum`);
  } else if (rule.type === "boolean") {
    expectBoth(key, true, null, true, `${key} true`);
    expectBoth(key, false, null, true, `${key} false`);
    for (const invalid of [null, 0, 1, "true", {}]) {
      expectBoth(key, invalid, null, false, `${key} invalid type`);
    }
  } else if (rule.type === "enum") {
    for (const value of rule.values) expectBoth(key, value, null, true, `${key} enum ${value}`);
    expectBoth(key, "__unknown_enum_value__", null, false, `${key} unknown enum`);
  }
}
for (const index of [0, 9]) expectBoth("eq", 0, index, true, `eq index ${index}`);
for (const index of [-1, 10, 1.5, "1", null, {}, undefined]) {
  expectBoth("eq", 0, index, false, `eq invalid index ${String(index)}`);
}
assert(extensionProtocol.sanitizeRemoteCommand({ type: "SET_PARAM", key: "pitch", value: 99 }) === null, "Out-of-range pitch accepted");
assert(extensionProtocol.sanitizeRemoteCommand({ type: "SET_PARAM", key: "unknown", value: 1 }) === null, "Unknown parameter accepted");
assert(extensionProtocol.sanitizeRemoteCommand({ type: "SET_PARAM", key: "eq", value: 1, index: 10 }) === null, "Out-of-range EQ band accepted");
assert(extensionProtocol.sanitizeRemoteCommand({ type: "SET_PARAM", key: "eq", value: 1, index: "1" }) === null, "String EQ band accepted");
assert(!extensionProtocol.isAllowedRemoteMessage({ type: "PING", ts: "x".repeat(5000) }), "Oversized Remote message accepted");
assert(!extensionProtocol.isAllowedRemoteMessage([]), "Array Remote message accepted");
assert(extensionProtocol.sanitizeRemoteCommand({ type: "EXECUTE", command: "anything" }) === null, "Unknown Remote message type accepted");
assert(extensionProtocol.isValidRemoteHandshake({
  type: "HANDSHAKE",
  protocolVersion: 1,
  token: "abcdefghijklmnopqrstuvwxyz012345",
}), "Valid handshake rejected");
assert(!extensionProtocol.isValidRemoteHandshake({
  type: "HANDSHAKE",
  protocolVersion: 2,
  token: "abcdefghijklmnopqrstuvwxyz012345",
}), "Wrong protocol version accepted");
assert(!extensionProtocol.isValidRemoteHandshake({
  type: "HANDSHAKE",
  protocolVersion: 1,
  token: "short",
}), "Short handshake token accepted");

const require = createRequire(import.meta.url);
const qrcode = require("qrcode-generator");
const qr = qrcode(0, "M");
qr.addData("https://studio.nextfeeder.com/remote#host=peer&token=abcdefghijklmnopqrstuvwxyz012345", "Byte");
qr.make();
assert(qr.createDataURL(4, 8).startsWith("data:image/gif;base64,"), "Local QR generation failed");

const popupBundle = fs.readFileSync(path.join(store, "popup.js"), "utf8").toLowerCase();
assert(!popupBundle.includes("api.qrserver.com"), "External QR service remains in Store popup");
assert(!popupBundle.includes("fonts.googleapis.com"), "External font host remains in Store popup");
assert(!popupBundle.includes("mount_ui"), "Legacy executable Remote UI remains in Store popup");
assert(fs.existsSync(path.join(store, "model", "model.json")), "Store model JSON is missing");
assert(fs.existsSync(path.join(store, "model", "group1-shard1of1.bin")), "Store model weights are missing");
assert(fs.existsSync(path.join(store, "THIRD-PARTY-NOTICES.txt")), "Third-party notices are missing");
assert(fs.existsSync(path.join(store, "MODEL-LICENSE.txt")), "Model license is missing");
assert(fs.existsSync(path.join(store, "LICENSE-APACHE-2.0.txt")), "Apache license text is missing");
assert(/Apache License/i.test(fs.readFileSync(path.join(store, "LICENSE-APACHE-2.0.txt"), "utf8")), "Apache license text is incomplete");
assert(fs.existsSync(path.join(root, "package-lock.json")), "Reproducible npm lockfile is missing");
assert(!fs.existsSync(path.join(store, "tailwindcss.js")), "Runtime Tailwind compiler remains in Store output");
assert(!fs.existsSync(path.join(store, "config.js")), "Runtime Tailwind configuration remains in Store output");
assert(fs.statSync(path.join(store, "styles.css")).size > 10000, "Precompiled Store stylesheet appears incomplete");

const minimumChrome = Number.parseInt(manifest.minimum_chrome_version, 10);
assert(Number.isInteger(minimumChrome) && minimumChrome >= 116, "Store minimum_chrome_version must be at least 116");

const storePlayer = fs.readFileSync(path.join(store, "player.js"), "utf8");
assert(!/getUserMedia\s*\(/i.test(storePlayer), "Store player still requests microphone access");
const storePlayerHtml = fs.readFileSync(path.join(store, "player.html"), "utf8");
assert(!/\son[a-z]+\s*=/i.test(storePlayerHtml), "Inline HTML event handler remains in player.html");
for (const file of walkFiles(store)) {
  if (!/\.(html|js|mjs|css)$/i.test(file)) continue;
  const relative = path.relative(store, file);
  const contents = fs.readFileSync(file, "utf8");
  assert(!/<script[^>]+(?:src|href)\s*=\s*["']https?:/i.test(contents), `Remote script URL found in Store ${relative}`);
  assert(!/\b(?:import|fetch)\s*\(\s*["'`]https?:/i.test(contents), `Remote executable fetch found in Store ${relative}`);
  assert(!/@import\s+(?:url\()?\s*["']?https?:/i.test(contents), `Remote stylesheet URL found in Store ${relative}`);
}

for (const legacyPath of [
  "remote/dos-remote.html",
  "remote/generate-ittybitty.py",
  "remote/itty-bitty-url.txt",
  "remote/remote-ui-bundle.js",
]) {
  assert(!fs.existsSync(path.join(root, "nextsona-extension", legacyPath)), `Dead legacy source remains: ${legacyPath}`);
}

const privacyHtml = fs.readFileSync(path.join(root, "nextsona-public-site", "privacy", "index.html"), "utf8");
assert(/local usage counters/i.test(privacyHtml), "Privacy policy does not disclose local usage counters");
assert(/indexeddb/i.test(privacyHtml), "Privacy policy does not identify IndexedDB recordings");
assert(/vercel/i.test(privacyHtml), "Privacy policy does not identify the public-site host");
assert(/0\.peerjs\.com/i.test(privacyHtml), "Privacy policy does not identify the PeerJS signaling endpoint");
assert(/STUN|TURN/i.test(privacyHtml), "Privacy policy does not identify WebRTC connection services");
assert(!/short-lived/i.test(privacyHtml), "Privacy policy still describes the Remote token as short-lived");
assert(/closing the remote page alone does not end/i.test(privacyHtml), "Privacy policy Remote lifecycle is incomplete");
const termsHtml = fs.readFileSync(path.join(root, "nextsona-public-site", "terms", "index.html"), "utf8");
assert(/Terms of Use/i.test(termsHtml), "Terms of Use page is missing");
assert(/authorized|อนุญาต/i.test(termsHtml), "Terms of Use does not set the media-rights responsibility");

const listing = fs.readFileSync(path.join(root, "CHROME-WEB-STORE-DESCRIPTION.md"), "utf8");
assert(/AI vocal reduction/i.test(listing), "Store short description still overclaims AI vocal removal");
assert(!/^Real-time .*AI vocal removal/m.test(listing), "Store short description still says AI vocal removal");
assert(/amount of vocal reduction and separation quality can vary/i.test(listing), "Store listing is missing the compact AI quality limitation");
assert(/does not send the audio stream/i.test(listing), "Store listing does not explain the Remote data-only boundary");
assert(/donation links are optional, do not unlock features/i.test(listing), "Store listing is missing the optional donation disclosure");

const offscreenSource = fs.readFileSync(path.join(root, "nextsona-extension", "offscreen.js"), "utf8");
const startCaptureBlock = offscreenSource.match(
  /if \(msg\.type === "START_CAPTURE"\) \{([\s\S]*?)\n\s*\} else if \(msg\.type === "START_RECORDING"\)/
)?.[1] || "";
assert(!startCaptureBlock.includes("initHostPeer"), "START_CAPTURE eagerly initializes PeerJS");
assert(
  /msg\.type === "GET_REMOTE_TOKEN"[\s\S]*waitForHostPeerId/.test(offscreenSource),
  "GET_REMOTE_TOKEN no longer initializes PeerJS on demand"
);

const popupSource = fs.readFileSync(path.join(root, "nextsona-extension", "popup.js"), "utf8");
assert(!popupSource.includes("ITTY_BITTY_HASH"), "Legacy embedded itty.bitty Remote payload remains");
assert(/isAudioMasterOn\s*=\s*state\.isAudioMasterOn\s*!==\s*false/.test(popupSource), "Popup still forces an active session to Audio ON");
assert(/clearCachedRemoteLink\(tabId\)/.test(offscreenSource), "Remote cache cleanup is missing from session teardown");
assert(/const accepted = await checkFirstLaunchModal\(\);[\s\S]*?if \(accepted\) \{\s*initCapture/.test(popupSource), "Capture is not gated by first-use disclosure");

const disclosureSource = fs.readFileSync(
  path.join(root, "nextsona-extension", "modules", "audio-disclosure.js"),
  "utf8"
);
const disclosureModule = { exports: {} };
const disclosureCode = transformSync(disclosureSource, {
  format: "cjs",
  platform: "node",
  target: "node18",
}).code;
new Function("module", "exports", disclosureCode)(disclosureModule, disclosureModule.exports);
const requireAudioDisclosure = disclosureModule.exports.requireAudioDisclosure;
assert(typeof requireAudioDisclosure === "function", "Audio disclosure coordinator is missing");

const disclosureCalls = [];
const alreadyAccepted = await requireAudioDisclosure({
  readConsent: async () => { disclosureCalls.push("read"); return true; },
  saveConsent: async () => { disclosureCalls.push("save"); },
  waitForDecision: async () => { disclosureCalls.push("wait"); return true; },
});
assert(alreadyAccepted === true && disclosureCalls.join(",") === "read", "Existing consent started an unexpected flow");

disclosureCalls.length = 0;
const declined = await requireAudioDisclosure({
  readConsent: async () => { disclosureCalls.push("read"); return false; },
  saveConsent: async () => { disclosureCalls.push("save"); },
  waitForDecision: async () => { disclosureCalls.push("wait"); return false; },
});
assert(declined === false && disclosureCalls.join(",") === "read,wait", "Declined disclosure persisted or started capture");

disclosureCalls.length = 0;
const accepted = await requireAudioDisclosure({
  readConsent: async () => { disclosureCalls.push("read"); return false; },
  saveConsent: async () => { disclosureCalls.push("save"); },
  waitForDecision: async () => { disclosureCalls.push("wait"); return true; },
});
assert(accepted === true && disclosureCalls.join(",") === "read,wait,save", "Consent was not persisted before capture could continue");

const publicPeerJs = fs.readFileSync(
  path.join(root, "nextsona-public-site", "assets", "vendor", "peerjs.min.js"),
  "utf8"
);
assert(!/sourceMappingURL=/i.test(publicPeerJs), "Public PeerJS bundle references a missing source map");
const extensionPeerJs = fs.readFileSync(
  path.join(root, "nextsona-extension", "assets", "js", "peerjs.min.js"),
  "utf8"
);
assert(publicPeerJs === extensionPeerJs, "Public and Extension PeerJS vendor copies differ");

const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
assert(packageLock.lockfileVersion === 3, "package-lock.json is not lockfileVersion 3");
assert(packageLock.packages?.[""]?.devDependencies?.tailwindcss === "3.4.17", "Tailwind Store compiler is not exactly pinned");
const extensionNotices = fs.readFileSync(
  path.join(root, "nextsona-extension", "THIRD-PARTY-NOTICES.txt"),
  "utf8"
);
for (const notice of ["TensorFlow.js 4.22.0", "PeerJS 1.5.5", "Tailwind CSS 3.4.17", "qrcode-generator 1.4.4"]) {
  assert(extensionNotices.includes(notice), `Third-party version notice is missing: ${notice}`);
}

const publicVercelConfig = JSON.parse(
  fs.readFileSync(path.join(root, "nextsona-public-site", "vercel.json"), "utf8")
);
const publicCsp = publicVercelConfig.headers
  ?.flatMap((rule) => rule.headers || [])
  .find((header) => header.key.toLowerCase() === "content-security-policy")?.value || "";
assert(!publicCsp.includes("*.peerjs.com"), "Public CSP still grants wildcard PeerJS access");
assert(publicCsp.includes("https://0.peerjs.com") && publicCsp.includes("wss://0.peerjs.com"), "Public CSP is missing the exact PeerJS signaling host");

console.log("[+] Review readiness checks passed");

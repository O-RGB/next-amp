#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_REFERENCE_HASHES = new Map([
  ["ed97339a3c2cdcd30fe7903ecad11562b7b9bfcfde24e0e584346f54c9247148", "reference helper 4886ec22"],
  ["b378c02e6477b8bb5207b088718f92ef3645cd5778328181fa79d01ab1083686", "reference helper :imageUtil"],
  ["55a68284460bac82334f42afc25ffec46742f02f969050ecf5304b5b04058b11", "reference helper :setIcon"],
  ["e4b2ea9ea0f89edc259fd100ed7756c00c24aeec999db637d2fb18a6ab7a727a", "reference exception handler"],
  ["ece18113a954ad27f02961c1c4729695622ad3bc2f194815164ea3140422e405", "reference popup bundle"],
  ["12ebae0fe6850bab3dd29936c773a2f9a784d9d7eb3f8c0f094cc8565ff61753", "reference popup HTML"],
  ["66e391b52fb6a5c0c380c606b2287013ccf511b0cd17d8e98b1d0d8840495504", "reference service-worker bundle"],
  ["90e0e972dc82bab2b1ddbeb1e04c33ce1e6b1b4522662137b1164d6aed6a37e2", "reference STFT WASM"],
]);

const MODEL_HASHES = new Map([
  ["model.json", "8917532971a28410af9c01011c1c1cfbb6ce6e6bfbe667bb2c7d09e425fbaa07"],
  ["group1-shard1of1.bin", "13cafca89123ac168bf2d45adbd916b2d67bbbdc7cfeee56ed03947f7421f135"],
]);

const MODEL_DIRECTORIES = [
  "next-amp-extension/model",
];

const SCAN_ROOTS = [
  "next-amp-extension",
  "ai-vocal-engine/src",
  "ai-vocal-engine/demo",
  "nextstudio-engine-go",
  "assets",
  "nextstudio-public-site",
  "nextstudio-model-builder",
];

const OPTIONAL_RELEASE_ROOTS = [
  "dist/nextstudio-extension-store",
  "dist/nextstudio-web-prod",
];

const TEXT_EXTENSIONS = new Set([".c", ".h", ".html", ".js", ".mjs", ".ts"]);
const errors = [];

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function walk(directory, callback) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walk(file, callback);
    } else if (entry.isFile()) {
      callback(file);
    }
  }
}

function scanFile(file) {
  const hash = sha256(file);
  const forbiddenName = FORBIDDEN_REFERENCE_HASHES.get(hash);
  if (forbiddenName) {
    errors.push(`${relative(file)} is byte-identical to ${forbiddenName} (${hash})`);
  }

  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return;
  const source = fs.readFileSync(file, "utf8");
  if (/(?:\.\.\/)+ai remove\//i.test(source)) {
    errors.push(`${relative(file)} directly imports or reads the local reference project`);
  }
}

for (const directory of [...SCAN_ROOTS, ...OPTIONAL_RELEASE_ROOTS]) {
  walk(path.join(ROOT, directory), scanFile);
}

let trackedReferenceFiles = "";
try {
  trackedReferenceFiles = execFileSync(
    "git",
    ["ls-files", "--", "ai remove"],
    { cwd: ROOT, encoding: "utf8" },
  ).trim();
} catch (error) {
  errors.push(`could not inspect Git tracking state: ${error.message}`);
}
if (trackedReferenceFiles) {
  errors.push(`local reference files are tracked by Git:\n${trackedReferenceFiles}`);
}

try {
  execFileSync("git", ["check-ignore", "--quiet", "ai remove/stft.wasm"], {
    cwd: ROOT,
    stdio: "ignore",
  });
} catch {
  errors.push("ai remove/ is not protected by a Git ignore rule");
}

for (const directory of MODEL_DIRECTORIES) {
  for (const [name, expectedHash] of MODEL_HASHES) {
    const file = path.join(ROOT, directory, name);
    if (!fs.existsSync(file)) {
      errors.push(`missing model artifact: ${relative(file)}`);
      continue;
    }
    const actualHash = sha256(file);
    if (actualHash !== expectedHash) {
      errors.push(
        `${relative(file)} has an unreviewed hash ${actualHash}; expected ${expectedHash}`,
      );
    }
  }

  const licenseFile = path.join(ROOT, directory, "LICENSE");
  if (!fs.existsSync(licenseFile)) {
    errors.push(`missing model license: ${relative(licenseFile)}`);
    continue;
  }
  const notice = fs.readFileSync(licenseFile, "utf8");
  for (const requiredText of [
    "MGM_MAIN_v4",
    "Ultimate Vocal Remover",
    "github.com/Anjok07/ultimatevocalremovergui",
    "github.com/tsurumeso/vocal-remover",
    "MIT License",
    "Copyright (c) 2019 tsurumeso",
  ]) {
    if (!notice.includes(requiredText)) {
      errors.push(`${relative(licenseFile)} is missing required attribution: ${requiredText}`);
    }
  }
}

if (errors.length) {
  console.error("Copyright/provenance audit FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Copyright/provenance audit passed.");
console.log(`- ${FORBIDDEN_REFERENCE_HASHES.size} known reference-file hashes absent`);
console.log("- no source file directly reads the local ai remove/ project");
console.log("- local reference folder is ignored and not tracked");
console.log("- independently rebuilt MGM_MAIN_v4 fingerprints and MIT attribution are present");

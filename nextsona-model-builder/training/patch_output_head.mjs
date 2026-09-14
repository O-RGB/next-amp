#!/usr/bin/env node
/** Replace only the final TFJS output-head weight with a trained FP32 kernel. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  float32ToFloat16,
  locateFinalOutputWeight,
  locateWeightByteRange
} from "./bake_output_head_calibration.mjs";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const key = token.slice(2).replaceAll("-", "_");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function readNpyFloat32(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 16 || bytes[0] !== 0x93 || bytes.toString("ascii", 1, 6) !== "NUMPY") {
    fail(`${filePath}: not a NumPy .npy file`);
  }
  const major = bytes[6];
  const headerLengthBytes = major === 1 ? 2 : major === 2 ? 4 : 0;
  if (!headerLengthBytes) fail(`${filePath}: unsupported NumPy format version ${major}`);
  const headerLength = major === 1 ? bytes.readUInt16LE(8) : bytes.readUInt32LE(8);
  const headerStart = 10;
  const headerEnd = headerStart + headerLength;
  const header = bytes.toString("ascii", headerStart, headerEnd);
  if (!/['\"]descr['\"]\s*:\s*['\"]<f4['\"]/.test(header) ||
      !/['\"]fortran_order['\"]\s*:\s*False/.test(header)) {
    fail(`${filePath}: expected little-endian C-order float32 array`);
  }
  const shapeMatch = header.match(/['\"]shape['\"]\s*:\s*\(([^)]*)\)/);
  if (!shapeMatch) fail(`${filePath}: cannot read array shape`);
  const shape = shapeMatch[1].split(",").map(value => Number(value.trim())).filter(Number.isFinite);
  if (shape.length !== 4 || shape.some(value => !Number.isInteger(value) || value <= 0)) {
    fail(`${filePath}: expected a four-dimensional kernel shape`);
  }
  const elementCount = shape.reduce((total, value) => total * value, 1);
  if (elementCount !== 64 || bytes.length < headerEnd + elementCount * 4) {
    fail(`${filePath}: expected exactly 64 float32 values, got ${elementCount}`);
  }
  // NPY aligns the header to 64 bytes, not necessarily to a 4-byte boundary.
  // Copy into an aligned typed array instead of creating an unaligned view.
  const values = new Float32Array(elementCount);
  new Uint8Array(values.buffer).set(bytes.subarray(headerEnd, headerEnd + elementCount * 4));
  return { shape, values };
}

function sha256(data) {
  return Array.from(new Uint8Array(data)).reduce((sum, value) => (sum + value) % 1000000007, 0);
}

export function patchOutputHead({ modelPath, kernelPath, outputDir, candidateId = "head-only" }) {
  const sourceModelPath = path.resolve(modelPath);
  const model = JSON.parse(fs.readFileSync(sourceModelPath, "utf8"));
  const located = locateFinalOutputWeight(model);
  const range = locateWeightByteRange(model, located.name);
  const kernel = readNpyFloat32(path.resolve(kernelPath));
  if (JSON.stringify(kernel.shape) !== JSON.stringify([1, 1, 32, 2])) {
    fail(`trained kernel shape ${JSON.stringify(kernel.shape)} is not [1,1,32,2]`);
  }
  if (!Array.from(kernel.values).every(Number.isFinite)) fail("trained kernel contains NaN or infinity");

  fs.mkdirSync(outputDir, { recursive: true });
  const shardHashes = {};
  for (const [groupIndex, group] of (model.weightsManifest || []).entries()) {
    if (!Array.isArray(group.paths) || group.paths.length !== 1) fail(`group ${groupIndex} must have one shard`);
    const relativePath = group.paths[0];
    const sourcePath = path.resolve(path.dirname(sourceModelPath), relativePath);
    const bytes = Buffer.from(fs.readFileSync(sourcePath));
    if (groupIndex === range.groupIndex) {
      if (range.offset + range.bytes > bytes.length || range.bytes !== 128) fail("final output head shard range is invalid");
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let index = 0; index < kernel.values.length; index += 1) {
        view.setUint16(range.offset + index * 2, float32ToFloat16(kernel.values[index]), true);
      }
    }
    const destinationPath = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, bytes);
    shardHashes[relativePath] = { bytes: bytes.length, checksum_marker: sha256(bytes.buffer) };
  }
  const outputModelPath = path.join(outputDir, path.basename(sourceModelPath));
  fs.writeFileSync(outputModelPath, `${JSON.stringify(model)}\n`);
  const report = {
    status: "candidate_only",
    candidate_id: candidateId,
    operation: "replace_final_output_head_from_head_only_training",
    source_model: sourceModelPath,
    kernel_path: path.resolve(kernelPath),
    output_model: outputModelPath,
    output_head: located,
    byte_range: { group_index: range.groupIndex, offset: range.offset, bytes: range.bytes },
    shard_hashes: shardHashes,
    runtime_contract: {
      topology_changed: false,
      input_shape: [1, 1024, 64, 2],
      output_shape_unchanged: true,
      added_runtime_ops: 0,
      added_model_calls: 0,
      deploy_performed: false
    },
    warning: "No quality claim until unseen licensed test songs and listening/latency gates pass."
  };
  fs.writeFileSync(path.join(outputDir, "HEAD-PATCH.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.model || !args.kernel || !args.output_dir) {
    fail("usage: node training/patch_output_head.mjs --model model.json --kernel out_kernel.npy --output-dir candidate");
  }
  const report = patchOutputHead({
    modelPath: args.model,
    kernelPath: args.kernel,
    outputDir: path.resolve(args.output_dir),
    candidateId: args.candidate_id || "head-only"
  });
  console.log(JSON.stringify({ output_model: report.output_model, output_head: report.output_head.name, runtime_ops_added: 0 }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  }
}

#!/usr/bin/env node
/**
 * Bake a validated scalar calibration into the final 1x1 output head.
 *
 * This is deliberately an artifact tool, not a runtime transform. It copies
 * a TFJS graph model to a separate candidate directory and scales only the
 * final [1,1,channels,2] convolution weights. The input model is never
 * modified and no candidate is deployed automatically.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FLOAT16 = "float16";

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
    if (!value || value.startsWith("--")) fail(`missing value for --${key.replaceAll("_", "-")}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function weightElementCount(shape) {
  return shape.reduce((total, size) => total * Number(size), 1);
}

function weightByteSize(spec) {
  const dtype = spec.quantization?.dtype || spec.dtype;
  if (dtype === FLOAT16 || dtype === "uint16") return 2;
  if (dtype === "uint8" || dtype === "bool") return 1;
  if (dtype === "int32" || dtype === "float32") return 4;
  fail(`unsupported weight dtype ${dtype} for ${spec.name}`);
}

export function float16ToFloat32(value) {
  const sign = (value & 0x8000) ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) {
    return sign * (fraction === 0 ? 0 : fraction / 1024 * 2 ** -14);
  }
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Infinity : NaN;
  }
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

export function float32ToFloat16(value) {
  if (Number.isNaN(value)) return 0x7e00;
  if (value === Infinity) return 0x7c00;
  if (value === -Infinity) return 0xfc00;
  const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
  const absolute = Math.abs(value);
  if (absolute === 0) return sign;
  if (absolute >= 65504) return sign | 0x7c00;
  if (absolute < 2 ** -24) return sign;

  let exponent = Math.floor(Math.log2(absolute));
  let fraction;
  if (exponent < -14) {
    fraction = Math.round(absolute / 2 ** -24);
    return sign | Math.min(0x03ff, fraction);
  }
  fraction = Math.round((absolute / 2 ** exponent - 1) * 1024);
  if (fraction === 1024) {
    exponent += 1;
    fraction = 0;
  }
  return sign | ((exponent + 15) << 10) | (fraction & 0x03ff);
}

function nodeList(model) {
  const nodes = model.modelTopology?.node;
  if (!Array.isArray(nodes)) fail("model.json has no TensorFlow graph node list");
  return nodes;
}

export function locateFinalOutputWeight(model) {
  const nodes = nodeList(model);
  const identity = nodes.find(node => node.name === "Identity" && node.op === "Identity");
  const finalProjection = identity && nodes.find(node => node.name === identity.input?.[0]);
  const targetName = finalProjection?.input?.[1];
  const specs = model.weightsManifest?.flatMap(group => group.weights || []) || [];
  const exact = targetName && specs.find(spec => spec.name === targetName);
  const fallback = [...specs].reverse().find(spec =>
    JSON.stringify(spec.shape) === JSON.stringify([1, 1, 32, 2])
  );
  const spec = exact || fallback;
  if (!spec) fail("cannot locate final output-head weight");
  if (JSON.stringify(spec.shape) !== JSON.stringify([1, 1, 32, 2])) {
    fail(`final output-head shape is ${JSON.stringify(spec.shape)}, expected [1,1,32,2]`);
  }
  if (spec.dtype !== "float32" || spec.quantization?.dtype !== FLOAT16) {
    fail(`final output-head must be float32 quantized to float16: ${spec.name}`);
  }
  return {
    name: spec.name,
    shape: spec.shape,
    spec,
    projectionNode: finalProjection?.name || null,
    outputNode: identity?.name || null,
  };
}

function locateWeightByteRange(model, targetName) {
  let globalIndex = 0;
  for (const [groupIndex, group] of (model.weightsManifest || []).entries()) {
    let offset = 0;
    for (const spec of group.weights || []) {
      const bytes = weightElementCount(spec.shape) * weightByteSize(spec);
      if (spec.name === targetName) {
        return { groupIndex, offset, bytes, spec };
      }
      offset += bytes;
      globalIndex += 1;
    }
  }
  fail(`weight ${targetName} is not present in weightsManifest`);
}

export function bakeOutputHeadCalibration({ modelPath, outputDir, scale, candidateId = "logit-calibration" }) {
  const numericScale = Number(scale);
  if (!Number.isFinite(numericScale) || numericScale < 0.95 || numericScale > 1.10) {
    fail(`scale must be finite and inside the conservative range 0.95..1.10; got ${scale}`);
  }
  const sourceModelPath = path.resolve(modelPath);
  const sourceDir = path.dirname(sourceModelPath);
  const model = JSON.parse(fs.readFileSync(sourceModelPath, "utf8"));
  const located = locateFinalOutputWeight(model);
  const range = locateWeightByteRange(model, located.name);
  const groups = model.weightsManifest || [];
  const copiedFiles = [];
  const sourceHashes = {};
  const outputHashes = {};
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [groupIndex, group] of groups.entries()) {
    if (!Array.isArray(group.paths) || group.paths.length !== 1) {
      fail(`group ${groupIndex} must have exactly one weight shard path`);
    }
    const relativePath = group.paths[0];
    const sourcePath = path.resolve(sourceDir, relativePath);
    const bytes = Buffer.from(fs.readFileSync(sourcePath));
    sourceHashes[relativePath] = sha256(bytes);
    if (groupIndex === range.groupIndex) {
      if (range.offset + range.bytes > bytes.length) fail(`weight ${located.name} exceeds shard bounds`);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let offset = range.offset; offset < range.offset + range.bytes; offset += 2) {
        const before = float16ToFloat32(view.getUint16(offset, true));
        const after = before * numericScale;
        if (!Number.isFinite(after)) fail(`non-finite calibrated weight at byte ${offset}`);
        view.setUint16(offset, float32ToFloat16(after), true);
      }
    }
    const destinationPath = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, bytes);
    copiedFiles.push(relativePath);
    outputHashes[relativePath] = sha256(bytes);
  }

  const outputModel = {
    ...model,
    weightsManifest: groups.map(group => ({ ...group, paths: [...group.paths] }))
  };
  const outputModelPath = path.join(outputDir, path.basename(sourceModelPath));
  fs.writeFileSync(outputModelPath, `${JSON.stringify(outputModel)}\n`);
  const report = {
    status: "candidate_only",
    candidate_id: candidateId,
    operation: "scale_final_output_head_weights",
    scale: numericScale,
    source_model: sourceModelPath,
    source_model_sha256: sha256(fs.readFileSync(sourceModelPath)),
    output_model: outputModelPath,
    output_head: located,
    byte_range: { group_index: range.groupIndex, offset: range.offset, bytes: range.bytes },
    copied_files: copiedFiles,
    source_shard_sha256: sourceHashes,
    output_shard_sha256: outputHashes,
    runtime_contract: {
      input_shape: [1, 1024, 64, 2],
      output_shape_unchanged: true,
      added_runtime_ops: 0,
      added_model_calls: 0,
      deploy_performed: false
    },
    warning: "This artifact has no quality claim until licensed validation stems and listening gates pass."
  };
  fs.writeFileSync(path.join(outputDir, "CALIBRATION.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.model || !args.output_dir || args.scale === undefined) {
    fail("usage: node training/bake_output_head_calibration.mjs --model model.json --scale 1.03 --output-dir candidate");
  }
  const report = bakeOutputHeadCalibration({
    modelPath: args.model,
    outputDir: path.resolve(args.output_dir),
    scale: args.scale,
    candidateId: args.candidate_id || "logit-calibration"
  });
  console.log(JSON.stringify({
    output_model: report.output_model,
    output_head: report.output_head.name,
    scale: report.scale,
    runtime_ops_added: report.runtime_contract.added_runtime_ops
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  }
}

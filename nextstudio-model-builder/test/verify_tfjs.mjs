#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";
import { NEXTSTUDIO_OPTIMIZATION_METADATA } from "../src/optimize_tfjs_graph.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist", "mgm-main-v4", "tfjs");
const fixtureDir = path.join(root, "work", "fixtures");
const modelJson = JSON.parse(fs.readFileSync(path.join(distDir, "model.json"), "utf8"));
const shard = fs.readFileSync(path.join(distDir, "group1-shard1of1.bin"));
const weightSpecs = modelJson.weightsManifest.flatMap(group => group.weights);
const weightData = shard.buffer.slice(shard.byteOffset, shard.byteOffset + shard.byteLength);
const optimization = modelJson.userDefinedMetadata?.[NEXTSTUDIO_OPTIMIZATION_METADATA];

if (optimization?.version !== 1 || optimization.foldedCount !== 12 ||
    optimization.explicitPadCount !== 16 || !optimization.fallback?.modelTopology) {
  throw new Error("TFJS build-time optimization metadata/fallback is incomplete");
}
if (optimization.outputHead?.start !== 34 || optimization.outputHead?.frames !== 15 ||
    optimization.outputHead?.decoderLayerRoi !== null) {
  throw new Error("TFJS output head is not the safe ECO projection-only window");
}

const load = (modelTopology, signature) => tf.loadGraphModel({
  load: async () => ({
    modelTopology,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    signature,
    weightSpecs,
    weightData,
  }),
});

const optimizedModel = await load(modelJson.modelTopology, modelJson.signature);
const fallbackModel = await load(
  optimization.fallback.modelTopology,
  optimization.fallback.signature
);

const inputBytes = fs.readFileSync(path.join(fixtureDir, "input.f32"));
const expectedBytes = fs.readFileSync(path.join(fixtureDir, "expected-mask.f32"));
const inputValues = new Float32Array(inputBytes.buffer, inputBytes.byteOffset, inputBytes.byteLength / 4);
const expectedFull = new Float32Array(expectedBytes.buffer, expectedBytes.byteOffset, expectedBytes.byteLength / 4);
const expectedCompact = new Float32Array(2 * 15 * 1024);
for (let channel = 0; channel < 2; channel++) {
  for (let frame = 0; frame < 15; frame++) {
    for (let bin = 0; bin < 1024; bin++) {
      const fullIndex = ((bin * 64) + frame + 34) * 2 + channel;
      const compactIndex = (channel * 15 + frame) * 1024 + bin;
      expectedCompact[compactIndex] = expectedFull[fullIndex];
    }
  }
}

function parity(actual, expected, label) {
  if (actual.length !== expected.length) {
    throw new Error(`${label} size mismatch: ${actual.length} != ${expected.length}`);
  }
  let sum = 0;
  let max = 0;
  let dot = 0;
  let actualNorm = 0;
  let expectedNorm = 0;
  for (let i = 0; i < actual.length; i++) {
    if (!Number.isFinite(actual[i]) || actual[i] < 0 || actual[i] > 1) {
      throw new Error(`Invalid ${label} mask value at ${i}: ${actual[i]}`);
    }
    const diff = Math.abs(actual[i] - expected[i]);
    sum += diff;
    if (diff > max) max = diff;
    dot += actual[i] * expected[i];
    actualNorm += actual[i] * actual[i];
    expectedNorm += expected[i] * expected[i];
  }
  return {
    mae: sum / actual.length,
    max,
    cosine: dot / Math.sqrt(actualNorm * expectedNorm)
  };
}

const input = tf.tensor(inputValues, [1, 1024, 64, 2], "float32");
const optimizedOutput = optimizedModel.execute(input);
const fallbackLogits = fallbackModel.execute(input);
const fallbackMask = tf.sigmoid(fallbackLogits);
const optimizedActual = await optimizedOutput.data();
const fallbackActual = await fallbackMask.data();
const fallbackCompact = new Float32Array(2 * 15 * 1024);
for (let channel = 0; channel < 2; channel++) {
  for (let frame = 0; frame < 15; frame++) {
    for (let bin = 0; bin < 1024; bin++) {
      const fullIndex = ((bin * 64) + frame + 34) * 2 + channel;
      const compactIndex = (channel * 15 + frame) * 1024 + bin;
      fallbackCompact[compactIndex] = fallbackActual[fullIndex];
    }
  }
}
const optimizedParity = parity(optimizedActual, expectedCompact, "optimized");
const fallbackParity = parity(fallbackActual, expectedFull, "fallback");
const exactRuntimeParity = parity(optimizedActual, fallbackCompact, "optimized-vs-fallback");
const config = JSON.parse(fs.readFileSync(path.join(root, "config", "mgm-main-v4.json"), "utf8"));

console.log(`TFJS optimized parity: MAE=${optimizedParity.mae}, max=${optimizedParity.max}, cosine=${optimizedParity.cosine}`);
console.log(`TFJS fallback parity: MAE=${fallbackParity.mae}, max=${fallbackParity.max}, cosine=${fallbackParity.cosine}`);
console.log(`TFJS optimized vs fallback: MAE=${exactRuntimeParity.mae}, max=${exactRuntimeParity.max}`);
for (const result of [optimizedParity, fallbackParity]) {
  if (result.mae > config.parity_thresholds.tfjs_vs_tf_mae ||
      result.cosine < config.parity_thresholds.tfjs_vs_tf_cosine_sim) {
    process.exitCode = 1;
  }
}
if (exactRuntimeParity.mae > 1e-7 || exactRuntimeParity.max > 1e-6) {
  throw new Error("Build-time graph optimization changed the production mask");
}

tf.dispose([input, optimizedOutput, fallbackLogits, fallbackMask]);
optimizedModel.dispose();
fallbackModel.dispose();

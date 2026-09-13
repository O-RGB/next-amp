#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tf from "@tensorflow/tfjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist", "mgm-main-v4", "tfjs");
const fixtureDir = path.join(root, "work", "fixtures");
const modelJson = JSON.parse(fs.readFileSync(path.join(distDir, "model.json"), "utf8"));
const shard = fs.readFileSync(path.join(distDir, "group1-shard1of1.bin"));
const weightSpecs = modelJson.weightsManifest.flatMap(group => group.weights);
const weightData = shard.buffer.slice(shard.byteOffset, shard.byteOffset + shard.byteLength);

const model = await tf.loadGraphModel({
  load: async () => ({
    modelTopology: modelJson.modelTopology,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    signature: modelJson.signature,
    weightSpecs,
    weightData,
  }),
});

const inputBytes = fs.readFileSync(path.join(fixtureDir, "input.f32"));
const expectedBytes = fs.readFileSync(path.join(fixtureDir, "expected-mask.f32"));
const inputValues = new Float32Array(inputBytes.buffer, inputBytes.byteOffset, inputBytes.byteLength / 4);
const expected = new Float32Array(expectedBytes.buffer, expectedBytes.byteOffset, expectedBytes.byteLength / 4);
const input = tf.tensor(inputValues, [1, 1024, 64, 2], "float32");
const rawOutput = model.execute(input);
const logits = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;
const mask = tf.sigmoid(logits);
const actual = await mask.data();

let sum = 0;
let max = 0;
let dot = 0;
let actualNorm = 0;
let expectedNorm = 0;
for (let i = 0; i < actual.length; i++) {
  if (!Number.isFinite(actual[i]) || actual[i] < 0 || actual[i] > 1) {
    throw new Error(`Invalid TFJS mask value at ${i}: ${actual[i]}`);
  }
  const diff = Math.abs(actual[i] - expected[i]);
  sum += diff;
  if (diff > max) max = diff;
  dot += actual[i] * expected[i];
  actualNorm += actual[i] * actual[i];
  expectedNorm += expected[i] * expected[i];
}
const mae = sum / actual.length;
const cosine = dot / Math.sqrt(actualNorm * expectedNorm);
const config = JSON.parse(fs.readFileSync(path.join(root, "config", "mgm-main-v4.json"), "utf8"));
console.log(`TFJS parity: MAE=${mae}, max=${max}, cosine=${cosine}`);
if (mae > config.parity_thresholds.tfjs_vs_tf_mae || cosine < config.parity_thresholds.tfjs_vs_tf_cosine_sim) {
  process.exitCode = 1;
}

tf.dispose([input, logits, mask]);
model.dispose();

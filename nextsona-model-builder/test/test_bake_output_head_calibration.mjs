import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { bakeOutputHeadCalibration, float16ToFloat32, float32ToFloat16, locateFinalOutputWeight } from "../training/bake_output_head_calibration.mjs";

function makeFloat16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(float32ToFloat16(value), 0);
  return buffer;
}

function makeFixture(directory) {
  const specs = [
    { name: "unrelated", shape: [2], dtype: "float32", quantization: { dtype: "float16", original_dtype: "float32" } },
    { name: "final", shape: [1, 1, 32, 2], dtype: "float32", quantization: { dtype: "float16", original_dtype: "float32" } }
  ];
  const weightBytes = Buffer.concat([
    makeFloat16(2), makeFloat16(-1),
    ...Array.from({ length: 64 }, (_, index) => makeFloat16(index - 20))
  ]);
  fs.writeFileSync(path.join(directory, "group1.bin"), weightBytes);
  const model = {
    format: "graph-model",
    modelTopology: {
      node: [
        { name: "final_projection", op: "Conv2D", input: ["features", "final"] },
        { name: "Identity", op: "Identity", input: ["final_projection"] }
      ]
    },
    weightsManifest: [{ paths: ["group1.bin"], weights: specs }]
  };
  fs.writeFileSync(path.join(directory, "model.json"), JSON.stringify(model));
  return { model, weightBytes };
}

test("float16 helpers round-trip finite values", () => {
  for (const value of [-20, -1, -0.25, 0, 0.25, 1, 20]) {
    const decoded = float16ToFloat32(float32ToFloat16(value));
    assert.ok(Math.abs(decoded - value) < 0.02, `${value} -> ${decoded}`);
  }
});

test("locates the final output head and bakes only its 64 values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextsona-calibration-"));
  const fixture = makeFixture(root);
  const located = locateFinalOutputWeight(fixture.model);
  assert.equal(located.name, "final");
  const output = path.join(root, "candidate");
  const report = bakeOutputHeadCalibration({ modelPath: path.join(root, "model.json"), outputDir: output, scale: 1.05 });
  assert.equal(report.runtime_contract.added_runtime_ops, 0);
  assert.equal(report.byte_range.bytes, 128);
  const baked = fs.readFileSync(path.join(output, "group1.bin"));
  assert.deepEqual(baked.subarray(0, 4), fixture.weightBytes.subarray(0, 4));
  const original = float16ToFloat32(fixture.weightBytes.readUInt16LE(4));
  const calibrated = float16ToFloat32(baked.readUInt16LE(4));
  assert.ok(Math.abs(calibrated - original * 1.05) < 0.03);
  assert.equal(fs.existsSync(path.join(output, "CALIBRATION.json")), true);
  assert.notEqual(crypto.createHash("sha256").update(baked).digest("hex"), crypto.createHash("sha256").update(fixture.weightBytes).digest("hex"));
});

test("rejects an unsafe scale instead of guessing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextsona-calibration-reject-"));
  makeFixture(root);
  assert.throws(() => bakeOutputHeadCalibration({ modelPath: path.join(root, "model.json"), outputDir: path.join(root, "candidate"), scale: 1.5 }), /0.95..1.10/);
});

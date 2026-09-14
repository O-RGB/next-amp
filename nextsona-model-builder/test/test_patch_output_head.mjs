import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { patchOutputHead } from "../training/patch_output_head.mjs";
import { verifyCandidateContract } from "../training/verify_candidate_contract.mjs";

function npyFloat32(values) {
  const header = "{'descr': '<f4', 'fortran_order': False, 'shape': (1, 1, 32, 2), }";
  const padded = header + " ".repeat((16 + header.length + 1) % 64 ? 64 - ((16 + header.length + 1) % 64) : 0) + "\n";
  const prefix = Buffer.alloc(10);
  prefix.writeUInt8(0x93, 0); prefix.write("NUMPY", 1, "ascii"); prefix.writeUInt8(1, 6); prefix.writeUInt8(0, 7);
  const body = Buffer.from(padded, "ascii");
  prefix.writeUInt16LE(body.length, 8);
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => data.writeFloatLE(value, index * 4));
  return Buffer.concat([prefix, body, data]);
}

function fixture(root) {
  const weights = [Buffer.alloc(4), ...Array.from({ length: 64 }, (_, index) => { const b = Buffer.alloc(2); b.writeUInt16LE(0x3c00 + (index % 3), 0); return b; })];
  const model = {
    format: "graph-model",
    signature: { outputs: { output_0: { tensorShape: { dim: [{ size: "1" }, { size: "1024" }, { size: "64" }, { size: "2" }] } } } },
    modelTopology: { node: [
      { name: "final_projection", op: "Conv2D", input: ["features", "final"] },
      { name: "Identity", op: "Identity", input: ["final_projection"] }
    ] },
    weightsManifest: [{ paths: ["group1.bin"], weights: [
      { name: "prefix", shape: [2], dtype: "float32", quantization: { dtype: "float16" } },
      { name: "final", shape: [1, 1, 32, 2], dtype: "float32", quantization: { dtype: "float16" } }
    ] }]
  };
  fs.writeFileSync(path.join(root, "model.json"), JSON.stringify(model));
  fs.writeFileSync(path.join(root, "group1.bin"), Buffer.concat([Buffer.alloc(4), ...Array.from({ length: 64 }, () => { const b = Buffer.alloc(2); b.writeUInt16LE(0x3c00, 0); return b; })]));
  fs.writeFileSync(path.join(root, "kernel.npy"), npyFloat32(Array.from({ length: 64 }, (_, index) => index / 100)));
}

test("patches a trained kernel and preserves the graph contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextsona-head-patch-"));
  fixture(root);
  const candidate = path.join(root, "candidate");
  const report = patchOutputHead({ modelPath: path.join(root, "model.json"), kernelPath: path.join(root, "kernel.npy"), outputDir: candidate });
  assert.equal(report.runtime_contract.added_runtime_ops, 0);
  const verified = verifyCandidateContract({ baselinePath: path.join(root, "model.json"), candidatePath: path.join(candidate, "model.json"), reportPath: path.join(candidate, "HEAD-PATCH.json") });
  assert.equal(verified.status, "passed");
  assert.notDeepEqual(fs.readFileSync(path.join(root, "group1.bin")), fs.readFileSync(path.join(candidate, "group1.bin")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "model.json"))).modelTopology.node.length, 2);
});

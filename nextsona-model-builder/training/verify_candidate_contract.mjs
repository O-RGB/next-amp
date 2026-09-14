#!/usr/bin/env node
/** Static verifier for a TFJS candidate before any deployment decision. */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locateFinalOutputWeight } from "./bake_output_head_calibration.mjs";

function fail(message) { throw new Error(message); }

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

function loadModel(filePath) {
  const model = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const shape = model.signature?.outputs?.output_0?.tensorShape?.dim?.map(dim => Number(dim.size));
  if (!Array.isArray(shape) || shape.length !== 4 || shape.some(value => !Number.isInteger(value))) {
    fail(`${filePath}: missing output signature shape`);
  }
  const nodes = model.modelTopology?.node;
  if (!Array.isArray(nodes)) fail(`${filePath}: missing model topology`);
  const specs = model.weightsManifest?.flatMap(group => group.weights || []) || [];
  if (!specs.length) fail(`${filePath}: missing weight specs`);
  return { model, shape, nodes, specs };
}

function topologyWithoutWeights(nodes) {
  return nodes.map(node => ({ ...node, input: node.input?.map(String) }));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function verifyCandidateContract({ baselinePath, candidatePath, reportPath = null }) {
  const baseline = loadModel(path.resolve(baselinePath));
  const candidate = loadModel(path.resolve(candidatePath));
  if (JSON.stringify(baseline.shape) !== JSON.stringify(candidate.shape)) {
    fail(`output shape changed: baseline ${baseline.shape}, candidate ${candidate.shape}`);
  }
  if (JSON.stringify(topologyWithoutWeights(baseline.nodes)) !== JSON.stringify(topologyWithoutWeights(candidate.nodes))) {
    fail("model topology changed; head-only candidate must not add/remove/reorder runtime nodes");
  }
  if (baseline.specs.length !== candidate.specs.length) fail("weight spec count changed");
  const baselineHead = locateFinalOutputWeight(baseline.model);
  const candidateHead = locateFinalOutputWeight(candidate.model);
  if (baselineHead.name !== candidateHead.name || JSON.stringify(baselineHead.shape) !== JSON.stringify(candidateHead.shape)) {
    fail("final output head contract changed");
  }
  for (const [index, spec] of baseline.specs.entries()) {
    const other = candidate.specs[index];
    if (spec.name !== other.name || JSON.stringify(spec.shape) !== JSON.stringify(other.shape) || spec.dtype !== other.dtype) {
      fail(`weight spec ${index} changed: ${spec.name} -> ${other?.name}`);
    }
  }
  if (reportPath) {
    const report = JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf8"));
    if (report.runtime_contract?.topology_changed !== false || report.runtime_contract?.added_runtime_ops !== 0) {
      fail("candidate report does not declare an unchanged runtime contract");
    }
  }
  return {
    status: "passed",
    baseline: path.resolve(baselinePath),
    candidate: path.resolve(candidatePath),
    output_shape: candidate.shape,
    topology_nodes: candidate.nodes.length,
    weight_specs: candidate.specs.length,
    baseline_sha256: sha256File(path.resolve(baselinePath)),
    candidate_sha256: sha256File(path.resolve(candidatePath)),
    deploy_performed: false
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.baseline || !args.candidate) fail("usage: node training/verify_candidate_contract.mjs --baseline baseline/model.json --candidate candidate/model.json");
  const result = verifyCandidateContract({ baselinePath: args.baseline, candidatePath: args.candidate, reportPath: args.report });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 2; }
}

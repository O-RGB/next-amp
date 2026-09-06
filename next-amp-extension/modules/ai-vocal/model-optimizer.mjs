/**
 * Fold the exported atrous-depthwise decomposition into native dilation.
 * Weights, precision, receptive field and output names are preserved.
 * Unrecognized graphs are returned unchanged; never guess padding/cropping.
 */
export function optimizeVocalModelArtifacts(artifacts) {
  const nodes = artifacts.modelTopology?.node;
  const specs = artifacts.weightSpecs;
  const weightData = Array.isArray(artifacts.weightData) && artifacts.weightData.length === 1
    ? artifacts.weightData[0] : artifacts.weightData;
  if (!Array.isArray(nodes) || !Array.isArray(specs) ||
      !(weightData instanceof ArrayBuffer)) {
    return { artifacts, foldedCount: 0, explicitPadCount: 0 };
  }

  const weights = new Map();
  const data = new DataView(weightData);
  const byteSizes = { float32: 4, int32: 4, bool: 1, float16: 2, uint16: 2, uint8: 1 };
  let offset = 0;
  for (const spec of specs) {
    const count = spec.shape.reduce((a, b) => a * b, 1);
    const bytes = byteSizes[spec.quantization?.dtype || spec.dtype];
    if (!bytes || offset + count * bytes > data.byteLength) {
      return { artifacts, foldedCount: 0, explicitPadCount: 0 };
    }
    let values;
    if (spec.dtype === "int32" && !spec.quantization && count <= 16) {
      values = Array.from({ length: count }, (_, i) => data.getInt32(offset + i * 4, true));
    }
    weights.set(spec.name, { shape: spec.shape, values });
    offset += count * bytes;
  }

  const byName = new Map(nodes.map(node => [node.name, node]));
  const uses = new Map();
  // Conservative: only match plain output-0 edges in the known export.
  for (const node of nodes) {
    for (const input of node.input || []) {
      const name = input.replace(/^\^/, "").replace(/:\d+$/, "");
      uses.set(name, (uses.get(name) || 0) + 1);
    }
  }
  const same = (a, b) => a?.length === b?.length && a?.every((v, i) => Number(v) === Number(b[i]));
  const constants = name => byName.get(name)?.op === "Const" ? weights.get(name)?.values : undefined;
  const replacements = new Map();
  const removed = new Set();
  let explicitPadCount = 0;

  for (const output of nodes) {
    if (output.op !== "BatchToSpaceND" || output.input?.length !== 3) continue;
    const conv = byName.get(output.input[0]);
    const space = byName.get(conv?.input?.[0]);
    if (conv?.op !== "DepthwiseConv2dNative" || conv.input.length !== 2 ||
        space?.op !== "SpaceToBatchND" || space.input?.length !== 3 ||
        uses.get(conv.name) !== 1 || uses.get(space.name) !== 1) continue;
    if (conv.attr?.data_format?.s !== "TkhXQw==" || // NHWC
        conv.attr?.padding?.s !== "VkFMSUQ=" || // VALID
        !same(conv.attr?.strides?.list?.i, [1, 1, 1, 1]) ||
        !same(conv.attr?.dilations?.list?.i, [1, 1, 1, 1])) continue;

    const block = constants(space.input[1]);
    const padding = constants(space.input[2]);
    const crops = constants(output.input[2]);
    const filter = weights.get(conv.input[1])?.shape;
    if (block?.length !== 2 || !block.every(v => Number.isInteger(v) && v > 1) ||
        !same(block, constants(output.input[1])) ||
        padding?.length !== 4 || crops?.length !== 4 ||
        !padding.every(v => v >= 0) || !crops.every(v => v >= 0) ||
        filter?.length !== 4 || filter[0] !== 3 || filter[1] !== 3 ||
        filter[3] !== 1) continue;
    // A stride-1 3x3 SAME convolution needs exactly dilation samples on
    // either side. Extra export padding must be canceled by output crops.
    if (!same(padding.map((v, i) => v - crops[i]), [block[0], block[0], block[1], block[1]])) continue;

    replacements.set(output.name, {
      ...conv,
      name: output.name,
      input: [space.input[0], conv.input[1]],
      attr: {
        ...conv.attr,
        padding: { s: "U0FNRQ==" }, // SAME
        dilations: { list: { i: ["1", String(block[0]), String(block[1]), "1"] } }
      }
    });
    removed.add(space.name);
    removed.add(conv.name);
  }

  // Fold the model's explicit symmetric Pad into the following stride-2
  // convolution. This preserves the exact boundary samples while removing a
  // standalone padding kernel and its intermediate tensor. Do not rewrite
  // SAME convolutions or any non-NHWC/unknown padding shape.
  for (const pad of nodes) {
    if (pad.op !== "Pad" || pad.input?.length !== 2 || uses.get(pad.name) !== 1) continue;
    const padValues = constants(pad.input[1]);
    if (!Array.isArray(padValues) || padValues.length !== 8 ||
        !padValues.every(v => Number.isInteger(v) && v >= 0) ||
        padValues[0] !== 0 || padValues[1] !== 0 ||
        padValues[6] !== 0 || padValues[7] !== 0) continue;

    const consumers = nodes.filter(node => node.input?.[0] === pad.name);
    if (consumers.length !== 1) continue;
    const conv = consumers[0];
    if (conv.op !== "_FusedConv2D" && conv.op !== "Conv2D") continue;
    if (conv.attr?.data_format?.s !== "TkhXQw==" ||
        conv.attr?.padding?.s !== "VkFMSUQ=" ||
        !same(conv.attr?.strides?.list?.i, [1, 2, 2, 1]) ||
        !same(conv.attr?.dilations?.list?.i, [1, 1, 1, 1])) continue;
    const explicit = conv.attr?.explicit_paddings?.list?.i;
    if (Array.isArray(explicit) && explicit.length) continue;

    const current = replacements.get(conv.name) || conv;
    replacements.set(conv.name, {
      ...current,
      input: [pad.input[0], ...current.input.slice(1)],
      attr: {
        ...current.attr,
        padding: { s: "RVhQTElDSVQ=" }, // EXPLICIT
        explicit_paddings: { list: { i: padValues.map(String) } }
      }
    });
    removed.add(pad.name);
    explicitPadCount++;
  }

  if (!replacements.size) return { artifacts, foldedCount: 0, explicitPadCount: 0 };
  return {
    artifacts: {
      ...artifacts,
      modelTopology: {
        ...artifacts.modelTopology,
        node: nodes.filter(node => !removed.has(node.name)).map(node => replacements.get(node.name) || node)
      }
    },
    foldedCount: [...replacements.keys()].filter(name => {
      const node = byName.get(name);
      return node?.op === "BatchToSpaceND";
    }).length,
    explicitPadCount
  };
}

/** Keep the original IO source available for drivers without native dilation. */
export function createVocalModelLoader(tf, source) {
  let enabled = typeof source?.load === "function";
  let foldedCount = 0;
  let explicitPadCount = 0;
  return {
    get foldedCount() { return foldedCount; },
    get explicitPadCount() { return explicitPadCount; },
    disableOptimization() { enabled = false; foldedCount = 0; explicitPadCount = 0; },
    async load() {
      if (!enabled) return tf.loadGraphModel(source);
      try {
        return await tf.loadGraphModel({
          load: async () => {
            const result = optimizeVocalModelArtifacts(await source.load());
            foldedCount = result.foldedCount;
            explicitPadCount = result.explicitPadCount || 0;
            return result.artifacts;
          }
        });
      } catch (error) {
        enabled = false;
        foldedCount = 0;
        explicitPadCount = 0;
        console.warn("[NextAmp AI] Optimized model load failed; loading original graph", error);
        return tf.loadGraphModel(source);
      }
    }
  };
}

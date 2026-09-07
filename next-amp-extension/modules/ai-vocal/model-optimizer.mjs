/**
 * Fold the exported atrous-depthwise decomposition into native dilation.
 * Weights, precision, receptive field and output names are preserved.
 * Unrecognized graphs are returned unchanged; never guess padding/cropping.
 */
function appendInt32Weights(artifacts, extraSpecs, values) {
  const sourceData = artifacts.weightData;
  const sourceBuffer = sourceData instanceof ArrayBuffer ? sourceData : sourceData?.[0];
  if (!(sourceBuffer instanceof ArrayBuffer)) return null;

  const sourceBytes = new Uint8Array(sourceBuffer);
  const extraValueCount = values.reduce((total, valueSet) => total + valueSet.length, 0);
  const extraBytes = extraValueCount * Int32Array.BYTES_PER_ELEMENT;
  const combinedBuffer = new ArrayBuffer(sourceBytes.byteLength + extraBytes);
  const combinedBytes = new Uint8Array(combinedBuffer);
  combinedBytes.set(sourceBytes);
  const view = new DataView(combinedBuffer);
  let offset = sourceBytes.byteLength;
  for (const valueSet of values) {
    for (const value of valueSet) {
      view.setInt32(offset, value, true);
      offset += Int32Array.BYTES_PER_ELEMENT;
    }
  }

  return {
    weightSpecs: [...(artifacts.weightSpecs || []), ...extraSpecs],
    weightData: Array.isArray(sourceData) ? [combinedBuffer] : combinedBuffer
  };
}

function makeInt32ConstNode(name, values) {
  return {
    name,
    op: "Const",
    attr: {
      value: {
        tensor: {
          dtype: "DT_INT32",
          tensorShape: { dim: [{ size: String(values.length) }] }
        }
      },
      dtype: { type: "DT_INT32" }
    }
  };
}

function appendExactOutputHead(artifacts, nodes, options) {
  const start = Number(options?.start);
  const frames = Number(options?.frames);
  const bins = Number(options?.bins || 1024);
  const inputFrames = Number(options?.inputFrames || 64);
  const requestedHeadStart = Number(options?.headStart ?? start);
  if (!Number.isInteger(start) || !Number.isInteger(frames) ||
      !Number.isInteger(bins) || !Number.isInteger(inputFrames) ||
      start < 0 || frames <= 0 || bins <= 0 || inputFrames <= 0 ||
      start + frames > inputFrames) return null;

  const outputNode = nodes.find(node => node.name === "Identity" && node.op === "Identity");
  if (!outputNode || outputNode.input?.length !== 1) return null;

  // The final 1x1 projection is frame-independent. Crop its decoder input
  // before the projection so the backend does not run the last output layer
  // over frames that the audio timeline will immediately discard. This is a
  // deliberately narrow ROI candidate: if the final layer is not the known
  // frame-independent projection, keep the exact output-head optimization
  // but do not guess a crop that could change boundary semantics.
  const sourceCrop = options?.sourceCrop;
  const finalProjection = nodes.find(node => node.name === outputNode.input[0]);
  const finalWeights = finalProjection?.input?.[1];
  const finalWeightSpec = (artifacts.weightSpecs || []).find(spec => spec.name === finalWeights);
  const projectionIsFrameIndependent = finalProjection?.op === "Conv2D" &&
    finalProjection.input?.length === 2 &&
    finalWeightSpec?.shape?.length === 4 &&
    finalWeightSpec.shape[0] === 1 && finalWeightSpec.shape[1] === 1 &&
    finalWeightSpec.shape[3] === 2 &&
    finalProjection.attr?.data_format?.s === "TkhXQw==" && // NHWC
    finalProjection.attr?.padding?.s === "U0FNRQ==" && // SAME
    finalProjection.attr?.strides?.list?.i?.every(value => Number(value) === 1) &&
    finalProjection.attr?.dilations?.list?.i?.every(value => Number(value) === 1);
  const roiStart = Number(sourceCrop?.start);
  const roiFrames = Number(sourceCrop?.frames);
  const roiInputFrames = Number(sourceCrop?.inputFrames || inputFrames);
  const roiChannels = Number(sourceCrop?.channels || finalWeightSpec?.shape?.[2]);
  const canApplySourceCrop = !!sourceCrop && projectionIsFrameIndependent &&
    Number.isInteger(roiStart) && Number.isInteger(roiFrames) &&
    Number.isInteger(roiInputFrames) && Number.isInteger(roiChannels) &&
    roiStart >= 0 && roiFrames > 0 && roiInputFrames > 0 && roiChannels > 0 &&
    roiStart + roiFrames <= roiInputFrames &&
    Number.isInteger(requestedHeadStart) && requestedHeadStart >= 0 &&
    requestedHeadStart + frames <= roiFrames;

  const prefix = "NextAmp/optimized_output_head";
  const constants = [
    { suffix: "begin", values: [0, 0, canApplySourceCrop ? requestedHeadStart : start, 0] },
    { suffix: "end", values: [1, bins, (canApplySourceCrop ? requestedHeadStart : start) + frames, 2] },
    { suffix: "strides", values: [1, 1, 1, 1] },
    { suffix: "transpose_perm", values: [0, 3, 2, 1] },
    { suffix: "reshape_shape", values: [2, frames, bins] }
  ];
  const roiConstants = canApplySourceCrop ? [
    { suffix: "begin", values: [0, 0, roiStart, 0] },
    { suffix: "end", values: [1, bins, roiStart + roiFrames, roiChannels] },
    { suffix: "strides", values: [1, 1, 1, 1] }
  ] : [];
  const allConstants = [
    ...roiConstants.map(item => ({ ...item, prefix: "NextAmp/roi_decoder_input" })),
    ...constants.map(item => ({ ...item, prefix }))
  ];
  const extraSpecs = allConstants.map(({ prefix: constantPrefix, suffix, values }) => ({
    name: `${constantPrefix}/${suffix}`,
    shape: [values.length],
    dtype: "int32"
  }));
  const appended = appendInt32Weights(artifacts, extraSpecs, allConstants.map(item => item.values));
  if (!appended) return null;

  const roiSpecCount = roiConstants.length;
  const [roiBegin, roiEnd, roiStrides] = extraSpecs.slice(0, roiSpecCount).map(spec => spec.name);
  const [begin, end, strides, transposePerm, reshape] = extraSpecs.slice(roiSpecCount).map(spec => spec.name);
  const roiPrefix = "NextAmp/roi_decoder_input";
  const roiCropName = `${roiPrefix}/crop`;
  const cropName = `${prefix}/crop`;
  const transposeName = `${prefix}/transpose`;
  const reshapeName = `${prefix}/reshape`;
  const sigmoidName = `${prefix}/sigmoid`;
  const roiNodes = canApplySourceCrop ? [
    ...roiConstants.map(({ suffix, values }) => makeInt32ConstNode(`${roiPrefix}/${suffix}`, values)),
    {
      name: roiCropName,
      op: "StridedSlice",
      input: [finalProjection.input[0], roiBegin, roiEnd, roiStrides],
      attr: {
        shrink_axis_mask: { i: "0" },
        new_axis_mask: { i: "0" },
        Index: { type: "DT_INT32" },
        begin_mask: { i: "0" },
        end_mask: { i: "0" },
        T: { type: "DT_FLOAT" },
        ellipsis_mask: { i: "0" }
      }
    }
  ] : [];
  const headNodes = [
    ...constants.map(({ suffix, values }) => makeInt32ConstNode(`${prefix}/${suffix}`, values)),
    {
      name: cropName,
      op: "StridedSlice",
      input: [outputNode.input[0], begin, end, strides],
      attr: {
        shrink_axis_mask: { i: "0" },
        new_axis_mask: { i: "0" },
        Index: { type: "DT_INT32" },
        begin_mask: { i: "0" },
        end_mask: { i: "0" },
        T: { type: "DT_FLOAT" },
        ellipsis_mask: { i: "0" }
      }
    },
    {
      name: transposeName,
      op: "Transpose",
      input: [cropName, transposePerm],
      attr: { T: { type: "DT_FLOAT" }, Tperm: { type: "DT_INT32" } }
    },
    {
      name: reshapeName,
      op: "Reshape",
      input: [transposeName, reshape],
      attr: { T: { type: "DT_FLOAT" }, Tshape: { type: "DT_INT32" } }
    },
    {
      name: sigmoidName,
      op: "Sigmoid",
      input: [reshapeName],
      attr: { T: { type: "DT_FLOAT" } }
    },
    { ...outputNode, input: [sigmoidName] }
  ];
  const outputNodes = nodes.flatMap(node => {
    if (canApplySourceCrop && node.name === finalProjection.name) {
      return [...roiNodes, { ...node, input: [roiCropName, ...node.input.slice(1)] }];
    }
    return node.name === outputNode.name ? headNodes : [node];
  });
  const signature = artifacts.signature;
  const outputSignature = signature?.outputs?.output_0;
  if (!outputSignature) return null;

  return {
    artifacts: {
      ...artifacts,
      ...appended,
      modelTopology: { ...artifacts.modelTopology, node: outputNodes },
      signature: {
        ...signature,
        outputs: {
          ...signature.outputs,
          output_0: {
            ...outputSignature,
            tensorShape: {
              dim: [2, frames, bins].map(size => ({ size: String(size) }))
            }
          }
        }
      }
    },
    metadata: {
      start, frames, bins, inputFrames,
      activation: "sigmoid", layout: "[2,frames,bins]",
      decoderRoi: canApplySourceCrop
        ? { start: roiStart, frames: roiFrames, inputFrames: roiInputFrames, channels: roiChannels }
        : null
    }
  };
}

export function optimizeVocalModelArtifacts(artifacts, options = {}) {
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

  const foldedCount = [...replacements.keys()].filter(name => {
      const node = byName.get(name);
      return node?.op === "BatchToSpaceND";
    }).length;
  let optimizedArtifacts = artifacts;
  let optimizedNodes = nodes;
  if (replacements.size) {
    optimizedNodes = nodes
      .filter(node => !removed.has(node.name))
      .map(node => replacements.get(node.name) || node);
    optimizedArtifacts = {
      ...artifacts,
      modelTopology: { ...artifacts.modelTopology, node: optimizedNodes }
    };
  }

  const outputHeadResult = options.outputHead
    ? appendExactOutputHead(optimizedArtifacts, optimizedNodes, options.outputHead)
    : null;
  if (outputHeadResult) optimizedArtifacts = outputHeadResult.artifacts;
  if (!replacements.size && !outputHeadResult) {
    return { artifacts, foldedCount: 0, explicitPadCount: 0 };
  }
  return {
    artifacts: optimizedArtifacts,
    foldedCount,
    explicitPadCount,
    outputHead: outputHeadResult?.metadata || null
  };
}

/** Keep the original IO source available for drivers without native dilation. */
export function createVocalModelLoader(tf, source, options = {}) {
  let enabled = typeof source?.load === "function";
  let foldedCount = 0;
  let explicitPadCount = 0;
  let outputHead = null;
  return {
    get foldedCount() { return foldedCount; },
    get explicitPadCount() { return explicitPadCount; },
    get outputHead() { return outputHead; },
    disableOptimization() {
      enabled = false;
      foldedCount = 0;
      explicitPadCount = 0;
      outputHead = null;
    },
    async load() {
      if (!enabled) return tf.loadGraphModel(source);
      try {
        return await tf.loadGraphModel({
        load: async () => {
            const result = optimizeVocalModelArtifacts(await source.load(), options);
            foldedCount = result.foldedCount;
            explicitPadCount = result.explicitPadCount || 0;
            outputHead = result.outputHead || null;
            return result.artifacts;
          }
        });
      } catch (error) {
        enabled = false;
        foldedCount = 0;
        explicitPadCount = 0;
        outputHead = null;
        console.warn("[NextAmp AI] Optimized model load failed; loading original graph", error);
        return tf.loadGraphModel(source);
      }
    }
  };
}

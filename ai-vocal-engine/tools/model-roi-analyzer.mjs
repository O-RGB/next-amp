import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizeVocalModelArtifacts } from '../../next-amp-extension/modules/ai-vocal/model-optimizer.mjs';

const TIME_AXIS = 2; // NHWC model layout: [batch, frequency, time, channels]
const INPUT_SHAPE = [1, 1024, 64, 2];

const tensorName = value => String(value || '').replace(/^\^/, '').replace(/:\d+$/, '');

function ints(value) {
  return value?.list?.i?.map(Number) || null;
}

function attrInts(node, name) {
  return ints(node?.attr?.[name]);
}

function paddingMode(node) {
  const value = node?.attr?.padding?.s;
  if (value === 'U0FNRQ==') return 'SAME';
  if (value === 'VkFMSUQ=') return 'VALID';
  if (value === 'RVhQTElDSVQ=') return 'EXPLICIT';
  return null;
}

function shapeFromTensor(tensor) {
  const dims = tensor?.tensorShape?.dim;
  return Array.isArray(dims) ? dims.map(dim => Number(dim.size)) : [];
}

function interval(start, end, size) {
  const safeSize = Number.isInteger(size) && size >= 0 ? size : null;
  const lo = Math.max(0, Math.floor(start));
  const hi = safeSize === null ? Math.max(lo, Math.ceil(end)) : Math.min(safeSize, Math.max(lo, Math.ceil(end)));
  return { start: Math.min(lo, hi), end: Math.max(lo, hi) };
}

function mergeInterval(previous, next, size) {
  if (!previous) return interval(next.start, next.end, size);
  return interval(Math.min(previous.start, next.start), Math.max(previous.end, next.end), size);
}

function spanLength(value) {
  return Math.max(0, value.end - value.start);
}

function readInt32Constants(json, bytes) {
  const values = new Map();
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  for (const spec of json.weightsManifest?.[0]?.weights || []) {
    const count = (spec.shape || []).reduce((total, size) => total * Number(size), 1);
    const dtype = spec.quantization?.dtype || spec.dtype;
    const byteSize = dtype === 'float16' ? 2 : dtype === 'uint8' ? 1 : 4;
    if (spec.dtype === 'int32' && !spec.quantization && count <= 64 && offset + count * 4 <= data.byteLength) {
      values.set(spec.name, Array.from({ length: count }, (_, index) => data.getInt32(offset + index * 4, true)));
    }
    offset += count * byteSize;
  }
  return values;
}

function explicitTimePadding(node) {
  const values = attrInts(node, 'explicit_paddings');
  if (!values || values.length !== 8) return [0, 0];
  return [values[TIME_AXIS * 2], values[TIME_AXIS * 2 + 1]];
}

function outputLength(input, kernel, stride, mode, explicit) {
  if (!Number.isInteger(input) || !Number.isInteger(kernel) || !Number.isInteger(stride) || stride <= 0) return null;
  if (mode === 'SAME') return Math.ceil(input / stride);
  const [before, after] = mode === 'EXPLICIT' ? explicit : [0, 0];
  return Math.floor((input + before + after - kernel) / stride) + 1;
}

function mapWindowThroughKernel(outputSpan, inputSize, kernel, stride, dilation, mode, explicit) {
  const effectiveKernel = (kernel - 1) * dilation + 1;
  let before = 0;
  if (mode === 'SAME') {
    const outputSize = Math.ceil(inputSize / stride);
    const total = Math.max(0, (outputSize - 1) * stride + effectiveKernel - inputSize);
    before = Math.floor(total / 2);
  } else if (mode === 'EXPLICIT') {
    before = explicit[0];
  }
  if (outputSpan.end <= outputSpan.start) return interval(0, 0, inputSize);
  const first = outputSpan.start * stride - before;
  const last = (outputSpan.end - 1) * stride - before + effectiveKernel;
  return interval(first, last, inputSize);
}

function mapResize(outputSpan, inputSize, outputSize, alignCorners) {
  if (!inputSize || !outputSize || outputSpan.end <= outputSpan.start) return interval(0, 0, inputSize);
  if (outputSize === 1) return interval(0, inputSize, inputSize);
  const scale = alignCorners ? (inputSize - 1) / (outputSize - 1) : inputSize / outputSize;
  const first = outputSpan.start * scale;
  const last = (outputSpan.end - 1) * scale;
  return interval(Math.floor(first), Math.ceil(last) + 1, inputSize);
}

function normalizeSliceBound(value, size, isStart, stride, masked) {
  if (masked) return stride > 0 ? (isStart ? 0 : size) : (isStart ? size - 1 : -1);
  let result = Number(value);
  if (result < 0) result += size;
  return Math.max(-1, Math.min(size, result));
}

function sliceDimension(inputSize, begin, end, stride, beginMasked, endMasked, shrink) {
  if (shrink) return { size: 0, map: null };
  const first = normalizeSliceBound(begin, inputSize, true, stride, beginMasked);
  const last = normalizeSliceBound(end, inputSize, false, stride, endMasked);
  const size = stride > 0
    ? Math.max(0, Math.ceil((last - first) / stride))
    : Math.max(0, Math.ceil((first - last) / -stride));
  return { size, map: { first, stride } };
}

function modelArtifacts(optimized = true) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../next-amp-extension/model');
  const json = JSON.parse(fs.readFileSync(path.join(root, 'model.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(root, 'group1-shard1of1.bin'));
  const original = {
    ...json,
    weightSpecs: json.weightsManifest[0].weights,
    weightData: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
  const optimizedArtifacts = optimizeVocalModelArtifacts(original, { optimizeGraph: true });
  return { json: optimized ? optimizedArtifacts.artifacts : original, constants: readInt32Constants(json, bytes) };
}

export function analyzeVocalModelRoi({ start = 32, frames = 32, optimized = true } = {}) {
  const loaded = modelArtifacts(optimized);
  const topology = loaded.json.modelTopology.node;
  const nodes = new Map(topology.map(node => [node.name, node]));
  const specs = new Map((loaded.json.weightSpecs || []).map(spec => [spec.name, spec]));
  const shapes = new Map();
  const unsupported = new Set();
  const shapeStack = new Set();

  const constant = name => loaded.constants.get(tensorName(name));
  const shape = name => {
    const key = tensorName(name);
    if (shapes.has(key)) return shapes.get(key);
    if (shapeStack.has(key)) return null;
    const node = nodes.get(key);
    if (!node) return null;
    if (node.op === 'Const') {
      const spec = specs.get(key);
      const result = spec?.shape || shapeFromTensor(node.attr?.value?.tensor);
      shapes.set(key, result);
      return result;
    }
    if (node.op === 'Placeholder') {
      shapes.set(key, INPUT_SHAPE);
      return INPUT_SHAPE;
    }
    shapeStack.add(key);
    const dataInputs = (node.input || []).map(tensorName).filter(input => nodes.get(input)?.op !== 'Const');
    const first = shape(dataInputs[0]);
    let result = first;
    const kernelSpec = node.input?.[1] ? specs.get(tensorName(node.input[1])) : null;
    if (['Conv2D', '_FusedConv2D', 'DepthwiseConv2dNative'].includes(node.op)) {
      const strides = attrInts(node, 'strides') || [1, 1, 1, 1];
      const dilations = attrInts(node, 'dilations') || [1, 1, 1, 1];
      const mode = paddingMode(node);
      const explicit = explicitTimePadding(node);
      const kernel = kernelSpec?.shape || [];
      const time = outputLength(first?.[TIME_AXIS], kernel[1], strides[TIME_AXIS], mode, explicit);
      const channels = node.op === 'DepthwiseConv2dNative' ? first?.[3] * kernel[3] : kernel[3];
      result = first && time !== null ? [...first.slice(0, TIME_AXIS), time, channels] : null;
    } else if (node.op === 'AvgPool') {
      const ksize = attrInts(node, 'ksize') || [1, 1, 1, 1];
      const strides = attrInts(node, 'strides') || [1, 1, 1, 1];
      const time = outputLength(first?.[TIME_AXIS], ksize[TIME_AXIS], strides[TIME_AXIS], paddingMode(node), explicitTimePadding(node));
      result = first && time !== null ? [...first.slice(0, TIME_AXIS), time, first[3]] : null;
    } else if (node.op === 'ResizeBilinear') {
      const size = constant(node.input?.[1]);
      result = first && size?.length >= 2 ? [...first.slice(0, 1), size[0], size[1], first[3]] : null;
    } else if (node.op === 'ConcatV2') {
      const axis = constant(node.input?.at(-1))?.[0];
      const inputs = (node.input || []).slice(0, -1).map(shape).filter(Boolean);
      if (inputs.length && axis !== undefined) {
        result = [...inputs[0]];
        result[axis] = inputs.reduce((total, value) => total + value[axis], 0);
      }
    } else if (node.op === 'StridedSlice') {
      const source = shape(node.input?.[0]);
      const begin = constant(node.input?.[1]);
      const end = constant(node.input?.[2]);
      const strides = constant(node.input?.[3]);
      if (source && begin && end && strides) {
        const beginMask = Number(node.attr?.begin_mask?.i || 0);
        const endMask = Number(node.attr?.end_mask?.i || 0);
        const shrinkMask = Number(node.attr?.shrink_axis_mask?.i || 0);
        const dimensions = source.map((size, index) => sliceDimension(
          size, begin[index], end[index], strides[index],
          Boolean(beginMask & (1 << index)), Boolean(endMask & (1 << index)),
          Boolean(shrinkMask & (1 << index))
        ));
        result = dimensions.flatMap(dimension => dimension.size === 0 && dimension.map === null ? [] : [dimension.size]);
      }
    } else if (['Identity', 'Relu', 'LeakyRelu'].includes(node.op)) {
      result = first;
    } else {
      unsupported.add(node.op);
      result = first;
    }
    shapeStack.delete(key);
    if (result) shapes.set(key, result);
    return result;
  };

  const outputName = tensorName(loaded.json.signature.outputs.output_0.name);
  const outputShape = shape(outputName) || INPUT_SHAPE;
  const target = interval(start, start + frames, outputShape[TIME_AXIS]);
  const requirements = new Map([[outputName, target]]);
  const queue = [outputName];
  const relationNotes = [];
  const dataInputs = node => (node.input || []).map(tensorName).filter(input => {
    const child = nodes.get(input);
    return child && child.op !== 'Const';
  });

  const addRequirement = (name, next, owner) => {
    const size = shape(name)?.[TIME_AXIS];
    if (!next || !size) return;
    const merged = mergeInterval(requirements.get(name), next, size);
    const previous = requirements.get(name);
    if (!previous || previous.start !== merged.start || previous.end !== merged.end) {
      requirements.set(name, merged);
      queue.push(name);
    }
    if (owner) relationNotes.push({ node: owner.name, op: owner.op, input: name, required: merged });
  };

  while (queue.length) {
    const name = queue.shift();
    const node = nodes.get(name);
    const requested = requirements.get(name);
    if (!node || !requested) continue;
    const inputs = dataInputs(node);
    if (!inputs.length) continue;
    const outputSize = shape(name)?.[TIME_AXIS];
    if (!outputSize) continue;
    const propagate = (inputName, next) => addRequirement(inputName, next, node);

    if (['Conv2D', '_FusedConv2D', 'DepthwiseConv2dNative'].includes(node.op)) {
      const input = inputs[0];
      const inputShape = shape(input);
      const spec = specs.get(tensorName(node.input[1]));
      const strides = attrInts(node, 'strides') || [1, 1, 1, 1];
      const dilations = attrInts(node, 'dilations') || [1, 1, 1, 1];
      propagate(input, mapWindowThroughKernel(requested, inputShape?.[TIME_AXIS], spec?.shape?.[1], strides[TIME_AXIS], dilations[TIME_AXIS], paddingMode(node), explicitTimePadding(node)));
    } else if (node.op === 'AvgPool') {
      const input = inputs[0];
      const inputShape = shape(input);
      const ksize = attrInts(node, 'ksize') || [1, 1, 1, 1];
      const strides = attrInts(node, 'strides') || [1, 1, 1, 1];
      propagate(input, mapWindowThroughKernel(requested, inputShape?.[TIME_AXIS], ksize[TIME_AXIS], strides[TIME_AXIS], 1, paddingMode(node), explicitTimePadding(node)));
    } else if (node.op === 'ResizeBilinear') {
      const input = inputs[0];
      const inputShape = shape(input);
      const size = constant(node.input?.[1]);
      propagate(input, mapResize(requested, inputShape?.[TIME_AXIS], size?.[1], node.attr?.align_corners?.b === true));
    } else if (node.op === 'StridedSlice') {
      const input = inputs[0];
      const inputShape = shape(input);
      const begin = constant(node.input?.[1]);
      const end = constant(node.input?.[2]);
      const strides = constant(node.input?.[3]);
      const beginMask = Number(node.attr?.begin_mask?.i || 0);
      const endMask = Number(node.attr?.end_mask?.i || 0);
      const timeIndex = TIME_AXIS;
      if (inputShape && begin && end && strides && !(Number(node.attr?.shrink_axis_mask?.i || 0) & (1 << timeIndex))) {
        const time = sliceDimension(inputShape[timeIndex], begin[timeIndex], end[timeIndex], strides[timeIndex], Boolean(beginMask & (1 << timeIndex)), Boolean(endMask & (1 << timeIndex)), false);
        const first = time.map.first + requested.start * time.map.stride;
        const last = time.map.first + Math.max(requested.start, requested.end - 1) * time.map.stride;
        propagate(input, interval(Math.min(first, last), Math.max(first, last) + 1, inputShape[timeIndex]));
      } else {
        propagate(input, interval(0, inputShape?.[TIME_AXIS] || 64, inputShape?.[TIME_AXIS]));
      }
    } else if (node.op === 'ConcatV2') {
      for (const input of inputs) propagate(input, requested);
    } else {
      // Activations and Identity are frame-local. Unknown ops are conservative:
      // they receive the full temporal input rather than enabling an unsafe crop.
      for (const input of inputs) propagate(input, unsupported.has(node.op) ? interval(0, shape(input)?.[TIME_AXIS] || 64, shape(input)?.[TIME_AXIS]) : requested);
    }
  }

  // Forward temporal receptive-field summary. This is intentionally a
  // report-only pass: it describes the exact graph geometry without changing
  // any runtime tensor or attempting stateful activation reuse.
  const temporalFields = new Map();
  const temporalFieldStack = new Set();
  const temporalField = name => {
    const key = tensorName(name);
    if (temporalFields.has(key)) return temporalFields.get(key);
    if (temporalFieldStack.has(key)) return null;
    const node = nodes.get(key);
    if (!node || node.op === 'Const') return null;
    if (node.op === 'Placeholder') {
      const result = { jump: 1, receptiveField: 1 };
      temporalFields.set(key, result);
      return result;
    }

    temporalFieldStack.add(key);
    const inputs = dataInputs(node);
    const first = temporalField(inputs[0]);
    let result = first;
    if (first && ['Conv2D', '_FusedConv2D', 'DepthwiseConv2dNative'].includes(node.op)) {
      const filter = specs.get(tensorName(node.input?.[1]))?.shape;
      const strides = attrInts(node, 'strides') || [1, 1, 1, 1];
      const dilations = attrInts(node, 'dilations') || [1, 1, 1, 1];
      const kernel = Number(filter?.[1] || 1);
      const stride = Math.max(1, Number(strides[TIME_AXIS] || 1));
      const dilation = Math.max(1, Number(dilations[TIME_AXIS] || 1));
      result = {
        jump: first.jump * stride,
        receptiveField: first.receptiveField + ((kernel - 1) * dilation) * first.jump
      };
    } else if (first && node.op === 'AvgPool') {
      const ksize = attrInts(node, 'ksize') || [1, 1, 1, 1];
      const strides = attrInts(node, 'strides') || [1, 1, 1, 1];
      const kernel = Math.max(1, Number(ksize[TIME_AXIS] || 1));
      const stride = Math.max(1, Number(strides[TIME_AXIS] || 1));
      result = {
        jump: first.jump * stride,
        receptiveField: first.receptiveField + (kernel - 1) * first.jump
      };
    } else if (first && node.op === 'ResizeBilinear') {
      const inputSize = shape(inputs[0])?.[TIME_AXIS];
      const outputSize = shape(key)?.[TIME_AXIS];
      const alignCorners = node.attr?.align_corners?.b === true;
      const scale = inputSize > 1 && outputSize > 1
        ? (alignCorners ? (inputSize - 1) / (outputSize - 1) : inputSize / outputSize)
        : 1;
      // Linear interpolation touches at most two adjacent source frames.
      result = {
        jump: first.jump * scale,
        receptiveField: first.receptiveField + (inputSize > 1 && outputSize > 1 ? first.jump : 0)
      };
    } else if (first && node.op === 'StridedSlice') {
      const strides = constant(node.input?.[3]);
      result = {
        jump: first.jump * Math.max(1, Math.abs(Number(strides?.[TIME_AXIS] || 1))),
        receptiveField: first.receptiveField
      };
    } else if (inputs.length > 1 && node.op === 'ConcatV2') {
      const fields = inputs.map(temporalField).filter(Boolean);
      if (fields.length) {
        result = {
          jump: Math.max(...fields.map(field => field.jump)),
          receptiveField: Math.max(...fields.map(field => field.receptiveField))
        };
      }
    }
    temporalFieldStack.delete(key);
    if (result) temporalFields.set(key, result);
    return result;
  };

  const temporalFieldRows = [];
  for (const [name, node] of nodes) {
    if (!['Conv2D', '_FusedConv2D', 'DepthwiseConv2dNative', 'AvgPool', 'ResizeBilinear'].includes(node.op)) continue;
    const field = temporalField(name);
    const output = shape(name);
    if (!field || !output) continue;
    temporalFieldRows.push({
      name,
      op: node.op,
      outputFrames: output[TIME_AXIS],
      jumpFrames: Number(field.jump.toFixed(6)),
      receptiveFieldFrames: Number(field.receptiveField.toFixed(6))
    });
  }

  const convRows = [];
  let fullMacs = 0;
  let roiMacs = 0;
  for (const [name, node] of nodes) {
    if (!['Conv2D', '_FusedConv2D', 'DepthwiseConv2dNative'].includes(node.op)) continue;
    const output = shape(name);
    const filter = specs.get(tensorName(node.input?.[1]))?.shape;
    const required = requirements.get(name) || interval(0, output?.[TIME_AXIS] || 0, output?.[TIME_AXIS]);
    if (!output || !filter) continue;
    const inputChannels = filter[2];
    const multiplier = node.op === 'DepthwiseConv2dNative' ? filter[3] : 1;
    const kernelMacs = filter[0] * filter[1] * inputChannels * multiplier;
    const full = output[0] * output[1] * output[2] * output[3] * kernelMacs;
    const roi = output[0] * output[1] * spanLength(required) * output[3] * kernelMacs;
    fullMacs += full;
    roiMacs += roi;
    convRows.push({ name, op: node.op, outputFrames: output[TIME_AXIS], requiredFrames: spanLength(required), fullMacs: full, roiMacs: roi });
  }

  const inputRequirement = requirements.get('input') || interval(0, INPUT_SHAPE[TIME_AXIS], INPUT_SHAPE[TIME_AXIS]);
  const resizeGeometryBarrierMap = new Map();
  for (const note of relationNotes) {
    if (note.op !== 'ResizeBilinear') continue;
    const key = `${note.node}|${note.input}`;
    const inputSize = shape(note.input)?.[TIME_AXIS] || null;
    const previous = resizeGeometryBarrierMap.get(key);
    resizeGeometryBarrierMap.set(key, {
      node: note.node,
      input: note.input,
      requiredInput: mergeInterval(previous?.requiredInput, note.required, inputSize),
      inputSize,
      outputSize: shape(note.node)?.[TIME_AXIS] || null
    });
  }
  const resizeGeometryBarriers = [...resizeGeometryBarrierMap.values()];
  const statefulFeasibility = {
    overlapFrames: INPUT_SHAPE[TIME_AXIS] - frames,
    inputContextIsFull: inputRequirement.start === 0 && inputRequirement.end === INPUT_SHAPE[TIME_AXIS],
    resizeGeometryBarriers,
    exactActivationReuse: false,
    verdict: inputRequirement.start === 0 && inputRequirement.end === INPUT_SHAPE[TIME_AXIS]
      ? 'Do not reuse decoder activations across windows: the active ROI still depends on the full 64-frame input and align-corners resize geometry.'
      : 'Activation reuse requires a layer-wise numerical equivalence pass before it can be enabled.'
  };
  return {
    optimized,
    nodes: topology.length,
    outputShape,
    target,
    inputRequirement,
    inputUsesFullWindow: inputRequirement.start === 0 && inputRequirement.end === INPUT_SHAPE[TIME_AXIS],
    unsupportedOps: [...unsupported],
    visitedNodes: requirements.size,
    relationNotes,
    temporalFieldRows,
    temporalFieldSummary: {
      layers: temporalFieldRows.length,
      maxJumpFrames: temporalFieldRows.reduce((max, row) => Math.max(max, row.jumpFrames), 0),
      maxReceptiveFieldFrames: temporalFieldRows.reduce((max, row) => Math.max(max, row.receptiveFieldFrames), 0)
    },
    convolutionCount: convRows.length,
    convolutionRows: convRows,
    fullMacs,
    roiMacs,
    theoreticalMacReduction: fullMacs ? 1 - roiMacs / fullMacs : 0,
    statefulFeasibility,
    verdict: inputRequirement.start === 0 && inputRequirement.end === INPUT_SHAPE[TIME_AXIS]
      ? 'Full 64-frame input context is required; keep only the existing final-output crop.'
      : 'A narrower exact temporal ROI may be possible, but it must pass graph-output equivalence before production.'
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const start = Number(process.argv[2] ?? 32);
  const frames = Number(process.argv[3] ?? 32);
  console.log(JSON.stringify(analyzeVocalModelRoi({ start, frames }), null, 2));
}

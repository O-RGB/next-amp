import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../next-amp-extension/modules/ai-vocal/vocal-worklet.js', import.meta.url), 'utf8');
let Processor;

class MockAudioWorkletProcessor {
  constructor() {
    this.port = {
      messages: [],
      onmessage: null,
      postMessage: message => this.port.messages.push(message)
    };
  }
}

vm.runInNewContext(source, {
  AudioWorkletProcessor: MockAudioWorkletProcessor,
  Float32Array,
  Math,
  Number,
  sampleRate: 44100,
  registerProcessor: (_name, ctor) => { Processor = ctor; }
});
assert.ok(Processor, 'AudioWorklet processor was not registered');

const inputL = Float32Array.from({ length: 128 }, (_, i) => 0.2 * Math.sin(i * 0.07));
const inputR = Float32Array.from({ length: 128 }, (_, i) => 0.18 * Math.cos(i * 0.05));
const silenceL = new Float32Array(128);
const silenceR = new Float32Array(128);
const outputL = new Float32Array(128);
const outputR = new Float32Array(128);
const output = [[outputL, outputR]];

function processBlock(processor, silent = false, missing = false) {
  outputL.fill(0);
  outputR.fill(0);
  processor.process(
    missing ? [[]] : [[silent ? silenceL : inputL, silent ? silenceR : inputR]],
    output
  );
  return Math.max(...outputL, ...outputR, 0, ...outputL.map(Math.abs), ...outputR.map(Math.abs));
}

function processedChunk(length, value, generation, chunkIndex) {
  return {
    type: 'CHUNK_PROCESSED',
    chunkIndex,
    generation,
    outL: new Float32Array(length).fill(value),
    outR: new Float32Array(length).fill(value)
  };
}

const processor = new Processor();
processor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl', generation: 1
} });

let cursor = 0;
let totalChunks = 0;
let maxObservedQueue = 0;
let maxOutputPeak = 0;
let processedResponses = 0;
let staleGenerationResponses = 0;

function drainMessages() {
  while (cursor < processor.port.messages.length) {
    const message = processor.port.messages[cursor++];
    if (message.type === 'PROCESS_CHUNK') {
      totalChunks++;
      processor.port.onmessage({ data: processedChunk(
        message.rawL.length,
        0.05,
        message.generation,
        message.chunkIndex
      ) });
      processedResponses++;
      maxObservedQueue = Math.max(maxObservedQueue, processor.outQueueSize);

      // Simulate an old result arriving just after a resync/mode boundary.
      if (totalChunks === 44 || totalChunks === 133) {
        processor.port.onmessage({ data: processedChunk(
          message.rawL.length,
          0.9,
          message.generation - 1,
          message.chunkIndex
        ) });
        staleGenerationResponses++;
      }
    }
  }
}

function runBlocks(count, { silent = false, missing = false } = {}) {
  for (let i = 0; i < count; i++) {
    maxOutputPeak = Math.max(maxOutputPeak, processBlock(processor, silent, missing));
    drainMessages();
    maxObservedQueue = Math.max(maxObservedQueue, processor.outQueueSize);
  }
}

// 30 simulated minutes at 44.1kHz / 128-sample render quanta. Events are
// deterministic so regressions remain reproducible and the test runs faster
// than real time.
const TOTAL_BLOCKS = Math.floor(30 * 60 * 44100 / 128);
const BLOCKS_PER_CHUNK = 60;
for (let block = 0; block < TOTAL_BLOCKS; block++) {
  if (block === 2400) {
    const generation = processor.streamGeneration + 1;
    processor.port.onmessage({ data: { type: 'RESYNC', nextChunkIndex: processor.chunkSeq } });
    processor.port.onmessage({ data: processedChunk(7680, 0.9, generation - 1, 0) });
  }
  if (block === 4800) {
    const generation = processor.streamGeneration + 1;
    processor.port.onmessage({ data: { type: 'SET_ENGINE', engineType: 'go_native', generation } });
  }
  if (block === 7200) {
    const generation = processor.streamGeneration + 1;
    processor.port.onmessage({ data: { type: 'SET_ENGINE', engineType: 'webgl', generation } });
  }
  if (block === 9600) {
    const generation = processor.streamGeneration + 1;
    processor.port.onmessage({ data: { type: 'SET_MODE', mode: 'bypass', generation } });
  }
  if (block === 9660) {
    const generation = processor.streamGeneration + 1;
    processor.port.onmessage({ data: { type: 'SET_MODE', mode: 'karaoke', generation } });
  }

  const missing = block >= 12000 && block < 12000 + 128;
  // Start mid-chunk intentionally; keep three chunks so two complete silent
  // boundaries are still observed after the partial mixed chunk.
  const silent = block >= 18000 && block < 18000 + BLOCKS_PER_CHUNK * 3;
  maxOutputPeak = Math.max(maxOutputPeak, processBlock(processor, silent, missing));
  drainMessages();
  maxObservedQueue = Math.max(maxObservedQueue, processor.outQueueSize);
}

assert.ok(processedResponses > 1000, 'stress run must exercise sustained chunk processing');
assert.ok(processor.diagnostics.staleDrops >= staleGenerationResponses,
  'old generation responses must be rejected');
assert.ok(processor.diagnostics.streamResets >= 2,
  'missing input and sustained silence must reset the stream');
assert.ok(maxObservedQueue <= processor.maxQueueThreshold,
  `queue grew past ceiling: ${maxObservedQueue}`);
assert.ok(Number.isFinite(maxOutputPeak) && maxOutputPeak <= 1,
  `non-finite or excessive output peak: ${maxOutputPeak}`);
assert.equal(processor.outQueueL.length, processor.outQueueR.length);
assert.equal(processor.outQueueL.length, processor.outQueueIndex.length);
assert.ok(processor.outQueueSize >= 0 && processor.outQueueSize <= processor.outQueueL.length,
  `invalid ring queue size: ${processor.outQueueSize}`);

console.log(JSON.stringify({
  simulatedMinutes: 30,
  simulatedBlocks: TOTAL_BLOCKS,
  processedResponses,
  maxObservedQueue,
  maxQueueThreshold: processor.maxQueueThreshold,
  staleDrops: processor.diagnostics.staleDrops,
  streamResets: processor.diagnostics.streamResets,
  maxOutputPeak
}));
console.log('30-minute simulated AudioWorklet stress passed.');

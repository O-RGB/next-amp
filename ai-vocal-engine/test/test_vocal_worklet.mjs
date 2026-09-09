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

const block = (value = 0.25) => [
  Float32Array.from({ length: 128 }, () => value),
  Float32Array.from({ length: 128 }, () => value)
];
const output = () => [new Float32Array(128), new Float32Array(128)];
const processBlocks = (processor, count, value = 0.25) => {
  const outputs = [];
  for (let i = 0; i < count; i++) {
    const out = output();
    processor.process([block(value)], [out]);
    outputs.push(out);
  }
  return outputs;
};
const messagesOfType = (processor, type) => processor.port.messages.filter(m => m.type === type);

const processor = new Processor();
processor.port.onmessage({ data: { type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl' } });
processBlocks(processor, 64);
let chunks = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(chunks.length, 1);
assert.equal(chunks[0].rawL.length, 8192, 'default browser cadence must be 16 hops');
assert.equal(chunks[0].rawR.length, 8192);
assert.equal(processor.inputBufferPools[8192].rawL.length, 2,
  'one input pair should be leased from the bounded Worklet pool');
assert.equal(processor.inputBufferPools[8192].rawR.length, 2);
processor.port.onmessage({ data: {
  type: 'RETURN_INPUT_BUFFERS', rawL: chunks[0].rawL, rawR: chunks[0].rawR
} });
assert.equal(processor.inputBufferPools[8192].rawL.length, 3,
  'manager-returned input pair should re-enter the bounded Worklet pool');
assert.equal(processor.inputBufferPools[8192].rawR.length, 3);

const processed = (chunkIndex, value, generation, size = 8192) => ({
  type: 'CHUNK_PROCESSED',
  chunkIndex,
  outL: new Float32Array(size).fill(value),
  outR: new Float32Array(size).fill(value),
  ...(Number.isInteger(generation) ? { generation } : {})
});

const profileProcessor = new Processor();
profileProcessor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl', generation: 40
} });
processBlocks(profileProcessor, 64);
assert.equal(messagesOfType(profileProcessor, 'PROCESS_CHUNK').at(-1).rawL.length, 8192);
profileProcessor.port.onmessage({ data: {
  type: 'SET_PROFILE', profile: 'ai_remove', browserChunkSize: 8192, generation: 41
} });
assert.equal(profileProcessor.vocalProfile, 'ai_remove');
processBlocks(profileProcessor, 64);
assert.equal(messagesOfType(profileProcessor, 'PROCESS_CHUNK').at(-1).rawL.length, 8192,
  'high-detail profile must use the 16-hop app cadence');
assert.equal(profileProcessor.isAiReady, false, 'profile switch must flush readiness');
profileProcessor.port.onmessage({ data: {
  type: 'SET_PROFILE', profile: 'balanced', browserChunkSize: 7680, generation: 42
} });
assert.equal(profileProcessor.vocalProfile, 'balanced');
processBlocks(profileProcessor, 60);
assert.equal(messagesOfType(profileProcessor, 'PROCESS_CHUNK').at(-1).rawL.length, 7680,
  'switching back must restore the low-power cadence');

// Detailed Worklet counters are debug-only. Normal status messages should
// avoid cloning the diagnostics object; the debug switch must opt back in.
const diagnosticProcessor = new Processor();
diagnosticProcessor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl'
} });
processBlocks(diagnosticProcessor, 32);
const normalStatus = messagesOfType(diagnosticProcessor, 'WORKLET_STATUS').at(-1);
assert.equal(normalStatus.diagnostics, undefined,
  'normal Worklet status must omit detailed diagnostics');
diagnosticProcessor.port.onmessage({ data: { type: 'SET_DIAGNOSTICS', enabled: true } });
processBlocks(diagnosticProcessor, 32);
const debugStatus = messagesOfType(diagnosticProcessor, 'WORKLET_STATUS').at(-1);
assert.ok(debugStatus.diagnostics, 'debug Worklet status must include diagnostics');

// The fixed ring must retain only the newest five results and preserve FIFO
// order after wrapping its storage slots.
const ringProcessor = new Processor();
ringProcessor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl'
} });
for (let i = 0; i < 8; i++) ringProcessor.port.onmessage({ data: processed(i, 0.05) });
const ringIndexes = Array.from({ length: ringProcessor.outQueueSize }, (_, i) => {
  const slot = (ringProcessor.outQueueHead + i) % ringProcessor.outQueueL.length;
  return ringProcessor.outQueueIndex[slot];
});
assert.deepEqual(ringIndexes, [3, 4, 5, 6, 7],
  'ring queue must keep newest results in FIFO order after wrapping');

processor.port.onmessage({ data: processed(0, 0.05) });
processBlocks(processor, 64);
chunks = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(chunks.length, 2);
processor.port.onmessage({ data: processed(1, 0.05) });
processBlocks(processor, 128);

// Once the two processed chunks are consumed, the next block must conceal
// the missing result instead of copying the vocal-bearing raw input.
const readyThresholdBeforeUnderrun = processor.readyThreshold;
const underrunOutputs = processBlocks(processor, 8, 0.9);
const underrunPeak = Math.max(...underrunOutputs.flatMap(ch => Array.from(ch[0])));
assert.ok(underrunPeak < 1e-4, `underrun leaked raw audio: peak ${underrunPeak}`);
assert.ok(processor.diagnostics.underrunBlocks > 0);
assert.equal(processor.readyThreshold, readyThresholdBeforeUnderrun,
  'a transient underrun must not permanently lower the adaptive queue target');

// Switching to GO changes only the wire cadence and clears a partial browser packet.
processor.port.onmessage({ data: { type: 'SET_ENGINE', engineType: 'go_native' } });
processor.port.onmessage({ data: {
  type: 'SET_QUEUE_TARGET', engineType: 'go_native', readyThreshold: 2, maxQueueThreshold: 4
} });
assert.equal(processor.readyThreshold, 2, 'GO adaptive target must lower the ready cushion');
assert.equal(processor.maxQueueThreshold, 4, 'GO adaptive target must keep the safety ceiling');
processor.port.onmessage({ data: {
  type: 'SET_QUEUE_TARGET', engineType: 'go_native', readyThreshold: 4, maxQueueThreshold: 9
} });
assert.equal(processor.readyThreshold, 4, 'GO adaptive target must retain a larger cushion on slow providers');
assert.equal(processor.maxQueueThreshold, 5, 'GO adaptive target must clamp the latency ceiling');
processor.port.onmessage({ data: { type: 'RESYNC', nextChunkIndex: 0 } });
assert.equal(processor.readyThreshold, 4, 'GO resync must preserve the adaptive cushion');
processBlocks(processor, 64);
const goChunks = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(goChunks.at(-1).rawL.length, 8192, 'GO cadence must remain 16 hops');

processor.port.onmessage({ data: { type: 'SET_ENGINE', engineType: 'webgl' } });
processBlocks(processor, 63);
const beforeBrowserBoundary = messagesOfType(processor, 'PROCESS_CHUNK').length;
processBlocks(processor, 1);
const afterBrowserBoundary = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(afterBrowserBoundary.length, beforeBrowserBoundary + 1);
assert.equal(afterBrowserBoundary.at(-1).rawL.length, 8192);

// A response from an older stream generation must never enter the new queue,
// even if its chunk index is numerically valid again after a mode switch.
const generationProcessor = new Processor();
generationProcessor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl', generation: 7
} });
generationProcessor.port.onmessage({ data: processed(0, 0.05, 6) });
assert.equal(generationProcessor.outQueueSize, 0);
assert.equal(generationProcessor.diagnostics.staleDrops, 1);
generationProcessor.port.onmessage({ data: processed(0, 0.05, 7) });
assert.equal(generationProcessor.outQueueSize, 1);

// Sustained digital silence marks a stream boundary and invalidates the
// previous generation before a new song starts.
const silentProcessor = new Processor();
silentProcessor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl', generation: 20
} });
processBlocks(silentProcessor, 128, 0);
const reset = messagesOfType(silentProcessor, 'STREAM_RESET').at(-1);
assert.ok(reset, 'sustained silence must emit STREAM_RESET');
assert.equal(reset.generation, 21);
assert.equal(silentProcessor.streamGeneration, 21);
assert.equal(silentProcessor.outQueueSize, 0);
silentProcessor.port.onmessage({ data: processed(0, 0.05, 20) });
assert.equal(silentProcessor.outQueueSize, 0, 'old stream response must stay dropped');

// Missing input buffers (e.g. a paused/tearing-down source) also reset the
// stream instead of retaining old playback state.
const missingProcessor = new Processor();
missingProcessor.port.onmessage({ data: {
  type: 'SET_MODE', mode: 'karaoke', engineType: 'webgl', generation: 30
} });
for (let i = 0; i < 128; i++) missingProcessor.process([[]], [output()]);
assert.equal(missingProcessor.diagnostics.streamResets, 1);
assert.ok(messagesOfType(missingProcessor, 'STREAM_RESET').at(-1));

console.log(JSON.stringify({
  browserChunkSamples: chunks[0].rawL.length,
  goChunkSamples: goChunks.at(-1).rawL.length,
  underrunBlocks: processor.diagnostics.underrunBlocks,
  generationDrops: generationProcessor.diagnostics.staleDrops,
  silenceResets: silentProcessor.diagnostics.streamResets,
  missingInputResets: missingProcessor.diagnostics.streamResets
}));
console.log('AudioWorklet cadence, underrun concealment, and stream lifecycle passed.');

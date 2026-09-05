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
processBlocks(processor, 60);
let chunks = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(chunks.length, 1);
assert.equal(chunks[0].rawL.length, 7680, 'browser cadence must be 15 hops');
assert.equal(chunks[0].rawR.length, 7680);

const processed = (chunkIndex, value) => ({
  type: 'CHUNK_PROCESSED',
  chunkIndex,
  outL: new Float32Array(7680).fill(value),
  outR: new Float32Array(7680).fill(value)
});
processor.port.onmessage({ data: processed(0, 0.05) });
processBlocks(processor, 60);
chunks = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(chunks.length, 2);
processor.port.onmessage({ data: processed(1, 0.05) });
processBlocks(processor, 120);

// Once the two processed chunks are consumed, the next block must conceal
// the missing result instead of copying the vocal-bearing raw input.
const underrunOutputs = processBlocks(processor, 8, 0.9);
const underrunPeak = Math.max(...underrunOutputs.flatMap(ch => Array.from(ch[0])));
assert.ok(underrunPeak < 1e-4, `underrun leaked raw audio: peak ${underrunPeak}`);
assert.ok(processor.diagnostics.underrunBlocks > 0);

// Switching to GO changes only the wire cadence and clears a partial browser packet.
processor.port.onmessage({ data: { type: 'SET_ENGINE', engineType: 'go_native' } });
processBlocks(processor, 64);
const goChunks = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(goChunks.at(-1).rawL.length, 8192, 'GO cadence must remain 16 hops');

processor.port.onmessage({ data: { type: 'SET_ENGINE', engineType: 'webgl' } });
processBlocks(processor, 59);
const beforeBrowserBoundary = messagesOfType(processor, 'PROCESS_CHUNK').length;
processBlocks(processor, 1);
const afterBrowserBoundary = messagesOfType(processor, 'PROCESS_CHUNK');
assert.equal(afterBrowserBoundary.length, beforeBrowserBoundary + 1);
assert.equal(afterBrowserBoundary.at(-1).rawL.length, 7680);

console.log(JSON.stringify({
  browserChunkSamples: chunks[0].rawL.length,
  goChunkSamples: goChunks.at(-1).rawL.length,
  underrunBlocks: processor.diagnostics.underrunBlocks
}));
console.log('AudioWorklet cadence and underrun concealment passed.');

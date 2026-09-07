import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../../next-amp-extension/modules/ai-vocal/go-engine-client.js', import.meta.url),
  'utf8'
).replace('export class GoEngineClient', 'class GoEngineClient') +
  '\nthis.GoEngineClient = GoEngineClient;';

const context = {
  ArrayBuffer,
  DataView,
  Float32Array,
  Map,
  Blob,
  WebSocket: { OPEN: 1 },
  performance: { now: () => 1000 },
  console
};
vm.runInNewContext(source, context);

const client = new context.GoEngineClient();
const sent = [];
client.isConnected = true;
client.ws = { readyState: 1, send: packet => sent.push(packet) };
const outputs = [];
client.onChunkProcessed = (...args) => outputs.push(args);

const inputL = new Float32Array(8192).fill(0.1);
const inputR = new Float32Array(8192).fill(-0.1);
assert.equal(client.sendChunk(0, inputL, inputR, 'karaoke'), true);
const oldResponse = sent.at(-1).slice(0);
assert.equal(new DataView(oldResponse).getUint16(6, true), 0);

client.resetStream();
assert.equal(client.streamToken, 1);
client.handleBinaryBuffer(oldResponse);
assert.equal(outputs.length, 0, 'old stream response must be rejected');

assert.equal(client.sendChunk(0, inputL, inputR, 'karaoke'), true);
const currentResponse = sent.at(-1).slice(0);
assert.equal(new DataView(currentResponse).getUint16(6, true), 1);
client.handleBinaryBuffer(currentResponse);
assert.equal(outputs.length, 1, 'current stream response must be delivered');

console.log(JSON.stringify({
  oldToken: 0,
  currentToken: client.streamToken,
  deliveredCurrentResponse: outputs.length
}));
console.log('GO stream-token stale-response guard passed.');

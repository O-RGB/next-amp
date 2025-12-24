importScripts("../js/lame.min.js");

self.onmessage = function (e) {
  const { channelData, sampleRate, channels } = e.data;
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 320);
  const mp3Data = [];

  function floatToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  const left = floatToInt16(channelData[0]);
  const right = channels === 2 ? floatToInt16(channelData[1]) : undefined;
  const sampleBlockSize = 1152;

  for (let i = 0; i < left.length; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize);
    let mp3buf;
    if (channels === 2) {
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) mp3Data.push(mp3buf);

    if (i % (sampleBlockSize * 100) === 0) {
      self.postMessage({ type: "progress", value: i / left.length });
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) mp3Data.push(mp3buf);

  self.postMessage({
    type: "done",
    blob: new Blob(mp3Data, { type: "audio/mp3" }),
  });
};

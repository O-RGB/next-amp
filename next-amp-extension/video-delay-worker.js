// video-delay-worker.js — WebGL rendering off the main thread via OffscreenCanvas
// Protocol:
//   PING  → READY       : handshake (confirms worker is alive before canvas is transferred)
//   ATTACH canvas       : receive OffscreenCanvas and initialise WebGL
//   FRAME frame         : VideoFrame or ImageBitmap transferred from main thread
//   SET_DELAY value     : update delay
//   RESIZE w h          : resize OffscreenCanvas + GL viewport
//   DESTROY             : drain queue, release GL, close worker

let gl = null;
let offscreen = null;
let renderTexture = null;
let currentDelay = 0;
let isActive = true;
const frameQueue = [];
// Dedup: only postMessage DRAW_SUBTITLES when subtitle content actually changed.
// Avoids serializing + sending subtitle data 60x/sec when nothing is on screen.
let lastSubtitleHash = "";

function _close(frame) {
  if (frame && typeof frame.close === "function") {
    try { frame.close(); } catch {}
  }
}

// ── WebGL setup ───────────────────────────────────────────────────────────────

function setupWebGL(canvas) {
  offscreen = canvas;
  const opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
  gl = canvas.getContext("webgl2", opts) || canvas.getContext("webgl", opts);
  if (!gl) { self.postMessage({ type: "WEBGL_ERROR" }); return; }

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s;
  };
  const vs = `attribute vec2 p;attribute vec2 t;varying vec2 v;void main(){gl_Position=vec4(p,0,1);v=t;}`;
  const fs = `precision mediump float;uniform sampler2D u;varying vec2 v;void main(){gl_FragColor=texture2D(u,v);}`;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const pL = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(pL); gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1,1,1,0,0,1,0]), gl.STATIC_DRAW);
  const tL = gl.getAttribLocation(prog, "t"); gl.enableVertexAttribArray(tL); gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 0, 0);

  renderTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, renderTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

// ── Render scheduling ─────────────────────────────────────────────────────────
// setTimeout-based precise timing: fires at exactly the right moment,
// independent of main thread load — this eliminates stutter.

function renderIfReady() {
  if (!isActive || !gl || frameQueue.length === 0) return;
  const now = performance.now();
  const slot = frameQueue[0];
  const elapsed = now - slot.timestamp;

  if (elapsed >= currentDelay) {
    const toRender = frameQueue.shift();
    gl.bindTexture(gl.TEXTURE_2D, renderTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, toRender.frame);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    _close(toRender.frame);

    // Only signal main thread when subtitle content actually changed.
    // Most frames have the same subtitle (or no subtitle) — skip the IPC.
    const subtitleStr = JSON.stringify(toRender.subtitles);
    if (subtitleStr !== lastSubtitleHash) {
      lastSubtitleHash = subtitleStr;
      self.postMessage({ type: "DRAW_SUBTITLES", subtitles: toRender.subtitles });
    }

    // Drop frames that fell too far behind
    const nowAfter = performance.now();
    while (frameQueue.length > 0 && nowAfter - frameQueue[0].timestamp > currentDelay + 100) {
      _close(frameQueue.shift().frame);
    }
  } else {
    // Reschedule for the remaining time (handles delay changes mid-flight)
    setTimeout(renderIfReady, currentDelay - elapsed);
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = ({ data }) => {
  switch (data.type) {

    case "PING":
      // Handshake: confirm worker is alive BEFORE main thread transfers canvas
      self.postMessage({ type: "READY" });
      break;

    case "ATTACH":
      // Canvas is transferred only after PING/READY handshake succeeded
      currentDelay = data.delay;
      setupWebGL(data.canvas);
      break;

    case "FRAME": {
      if (!isActive || !gl) { _close(data.frame); return; }
      frameQueue.push({ frame: data.frame, timestamp: data.timestamp, subtitles: data.subtitles });
      // Schedule render at EXACTLY the right time
      const timeUntilDue = Math.max(0, currentDelay - (performance.now() - data.timestamp));
      setTimeout(renderIfReady, timeUntilDue);
      // Smart cap: delay(ms)/16ms_per_frame + 60 buffer
      const maxFrames = Math.ceil(currentDelay / 16) + 60;
      while (frameQueue.length > maxFrames) _close(frameQueue.shift().frame);
      break;
    }

    case "SET_DELAY":
      currentDelay = data.value;
      break;

    case "RESIZE":
      if (offscreen) { offscreen.width = data.width; offscreen.height = data.height; }
      if (gl) gl.viewport(0, 0, data.width, data.height);
      break;

    case "DESTROY":
      isActive = false;
      while (frameQueue.length) _close(frameQueue.shift().frame);
      if (gl) {
        const ext = gl.getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
      }
      self.close();
      break;
  }
};

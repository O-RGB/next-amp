import { AIVocalManager } from "./modules/ai-vocal/ai-vocal-manager.js";
import { createVocalModelLoader } from "./modules/ai-vocal/model-optimizer.mjs";

const out = document.getElementById("output");

function log(msg, cls = "") {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = msg;
  out.appendChild(div);
}

export async function runDiagnostics() {
  out.innerHTML = "";
  log("[1/5] Testing WebAssembly STFT...");
  try {
    const wasmRes = await fetch(chrome.runtime.getURL("modules/ai-vocal/stft_simd.wasm"));
    const wasmBuf = await wasmRes.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(wasmBuf, { env: {} });
    instance.exports.stft_init();
    log("✓ WASM Loaded & Initialized! Memory bytes: " + instance.exports.memory.buffer.byteLength, "log-ok");
  } catch (e) {
    log("✗ WASM Failed: " + e.message, "log-err");
    return;
  }

  log("\n[2/5] Testing TensorFlow.js Backend...");
  try {
    let be = "webgl";
    try {
      if (navigator.gpu) {
        await tf.setBackend("webgpu");
        be = "webgpu";
      }
    } catch (_) {}
    if (be === "webgl") {
      await tf.setBackend("webgl");
      tf.env().set("WEBGL_PACK", true);
      tf.env().set("WEBGL_PACK_BINARY_OPERATIONS", true);
      tf.env().set("WEBGL_CPU_FORWARD", false);
      tf.env().set("PROD", true);
    }
    await tf.ready();
    const gl = tf.backend()?.gpgpu?.gl;
    let unmasked = "Unknown";
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) unmasked = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "Unknown";
    }
    const isGoodGpu = unmasked.includes("NVIDIA") || unmasked.includes("Apple") || unmasked.includes("Radeon");
    log("✓ TFJS Backend Ready: " + tf.getBackend().toUpperCase(), "log-ok");
    log("  Hardware Device: " + unmasked, isGoodGpu ? "log-ok" : "log-warn");
  } catch (e) {
    log("✗ TFJS Backend Failed: " + e.message, "log-err");
    return;
  }

  log("\n[3/5] Testing U-Net Model Loading (15MB shard)...");
  let model;
  try {
    if (tf.io && tf.io.registerLoadRouter) {
      tf.io.registerLoadRouter((url) => {
        if (typeof url === "string" && (url.startsWith("chrome-extension://") || url.startsWith("./") || url.startsWith("../"))) {
          return tf.io.browserHTTPRequest(url);
        }
        return null;
      });
    }
    const modelUrl = chrome.runtime.getURL("model/model.json");
    const handler = tf.io.browserHTTPRequest(modelUrl);
    const loader = createVocalModelLoader(tf, handler);
    model = await loader.load();
    const optimizationLabel = loader.foldedCount
      ? ` Optimized graph: removed ${loader.foldedCount * 2} data-reordering nodes.`
      : " Original graph fallback is active.";
    log("✓ U-Net Model Loaded Successfully! Input shape: [1, 1024, 64, 2]." + optimizationLabel, "log-ok");
  } catch (e) {
    log("✗ Model Load Failed: " + e.message, "log-err");
    return;
  }

  log("\n[4/5] Testing U-Net Inference Execution...");
  try {
    const dummyInput = tf.zeros([1, 1024, 64, 2]);

    // Pass 1: Warmup & GLSL Shader Compilation (JIT)
    log("  [Warmup] Pre-compiling GPU shaders on device...");
    const tWarmup0 = performance.now();
    const warmupResult = model.execute(dummyInput);
    await warmupResult.data();
    const warmupDuration = (performance.now() - tWarmup0).toFixed(1);
    warmupResult.dispose();
    log(`  ✓ Shader JIT Compilation Done: ${warmupDuration}ms (One-time GPU compile)`);

    // Pass 2: Steady-State Inference (3 iterations)
    log("  [Benchmark] Measuring steady-state inference latency (3 runs)...");
    let totalTime = 0;
    const RUNS = 3;
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      const res = model.execute(dummyInput);
      await res.data();
      totalTime += (performance.now() - t0);
      res.dispose();
    }
    dummyInput.dispose();

    const avgDuration = (totalTime / RUNS).toFixed(1);
    const isRealTime = parseFloat(avgDuration) < 185;
    log(`✓ Steady-State Inference: ${avgDuration}ms / chunk (Quota: 185ms) - ${isRealTime ? "Real-time OK! ✓" : "TOO SLOW! ✗"}`, isRealTime ? "log-ok" : "log-err");
    if (!isRealTime) {
      log("\n⚠ DIAGNOSIS: Steady-state inference took " + avgDuration + "ms which is slower than audio playback (185ms).", "log-err");
      log("👉 If on Windows with dual GPU (Intel + NVIDIA): Chrome is using Intel iGPU instead of NVIDIA GTX 1050 Ti.", "log-warn");
      log("👉 Open Windows 'Graphics Settings' -> Add Google Chrome -> Select 'High Performance (NVIDIA)' -> Restart Chrome.", "log-warn");
    }
  } catch (e) {
    log("✗ Inference Failed: " + e.message, "log-err");
    return;
  }

  log("\n[5/5] Testing AIVocalManager Pipeline...");
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const mgr = new AIVocalManager(actx);
    const node = await mgr.init();
    if (node) {
      log("✓ AIVocalManager Initialized successfully! Status: " + mgr.getStatus(), "log-ok");
    } else {
      log("✗ AIVocalManager returned null node. Error: " + (mgr.lastError || "Unknown error"), "log-err");
    }
    try { await actx.close(); } catch (_) {}
  } catch (e) {
    log("✗ AIVocalManager Failed: " + e.message, "log-err");
  }
}

document.getElementById("btn-run")?.addEventListener("click", runDiagnostics);
runDiagnostics();

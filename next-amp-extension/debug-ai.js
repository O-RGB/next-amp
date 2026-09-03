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
      tf.env().set("WEBGL_PACK_NORMALIZATION", true);
      tf.env().set("WEBGL_CPU_FORWARD", false);
      tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);
      tf.env().set("PROD", true);
    }
    await tf.ready();
    log("✓ TFJS Backend Ready: " + tf.getBackend().toUpperCase(), "log-ok");
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
    model = await tf.loadGraphModel(handler);
    log("✓ U-Net Model Loaded Successfully! Input shape: [1, 1024, 64, 2]", "log-ok");
  } catch (e) {
    log("✗ Model Load Failed: " + e.message, "log-err");
    return;
  }

  log("\n[4/5] Testing U-Net Inference Execution...");
  try {
    const dummyInput = tf.zeros([1, 1024, 64, 2]);
    const t0 = performance.now();
    const result = model.execute(dummyInput);
    const data = await result.data();
    const duration = (performance.now() - t0).toFixed(1);
    dummyInput.dispose();
    result.dispose();
    log("✓ Inference Success! Output length: " + data.length + " | Time: " + duration + "ms", "log-ok");
  } catch (e) {
    log("✗ Inference Failed: " + e.message, "log-err");
    return;
  }

  log("\n[5/5] Testing AIVocalManager Pipeline...");
  try {
    const { AIVocalManager } = await import("./modules/ai-vocal/ai-vocal-manager.js");
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const mgr = new AIVocalManager(actx);
    const node = await mgr.init();
    if (node) {
      log("✓ AIVocalManager Initialized successfully! Status: " + mgr.getStatus(), "log-ok");
    } else {
      log("✗ AIVocalManager returned null node. Error: " + mgr.lastError, "log-err");
    }
  } catch (e) {
    log("✗ AIVocalManager Failed: " + e.message, "log-err");
  }
}

document.getElementById("btn-run")?.addEventListener("click", runDiagnostics);
runDiagnostics();

// [AUTO-INJECTED PRODUCTION SECURITY GUARD]
(function () {
  const _g = typeof globalThis !== "undefined" ? globalThis : self;

  // 1. Prototype Integrity Checks
  try {
    if (_g.AudioContext) {
      const s = Function.prototype.toString.call(_g.AudioContext);
      if (!s.includes("[native code]")) throw 0;
    }
    if (_g.WebAssembly && _g.WebAssembly.instantiate) {
      const s = Function.prototype.toString.call(_g.WebAssembly.instantiate);
      if (!s.includes("[native code]")) throw 0;
    }
  } catch (_) {
    return;
  }

  // 2. Anti-Debugging Watchdog
  setInterval(function () {
    try {
      (function () {
        debugger;
      })();
    } catch (_) {}
  }, 3500);

  // 3. WebAssembly Core Security Validation
  async function _verifyRuntime() {
    try {
      const wasmUrl = chrome.runtime.getURL("security-core.wasm");
      const res = await fetch(wasmUrl);
      const buf = await res.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(buf);

      const id = chrome.runtime.id || "";
      const enc = new TextEncoder();
      const bytes = enc.encode(id);
      const mem = new Uint8Array(instance.exports.memory.buffer, 1024, bytes.length);
      mem.set(bytes);

      // Verify extension ID inside WASM bytecode
      const isDev = (!chrome.runtime.getManifest || !chrome.runtime.getManifest()?.update_url) ? 1 : 0;
      const token = instance.exports.verify_extension_id(1024, bytes.length, isDev);
      if (!token) {
        if (_g.document && _g.document.body) {
          _g.document.body.innerHTML =
            "<div style='background:#111;color:#ff3333;font-family:sans-serif;font-size:12px;padding:24px;text-align:center;'>UNAUTHORIZED EXTENSION COPY<br/><small style='color:#888'>License signature mismatch.</small></div>";
        }
        throw new Error();
      }
    } catch (_) {}
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
    _verifyRuntime();
  }
})();

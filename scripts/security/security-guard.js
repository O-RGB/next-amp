// [AUTO-INJECTED PRODUCTION SECURITY GUARD]
(function () {
  const _g = typeof globalThis !== "undefined" ? globalThis : self;
  const _assetKeyB64 = "__NEXTAMP_WEB_ASSET_KEY__";
  const _assetMagic = "NAMPWEB1";
  const _assetHeaderBytes = 20;
  let _assetCryptoKeyPromise = null;

  async function _loadProtectedAsset(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Protected security asset request failed");
    const payload = new Uint8Array(await response.arrayBuffer());
    if (_assetKeyB64.startsWith("__NEXTAMP_")) return payload.buffer;
    if (payload.byteLength < _assetHeaderBytes) throw new Error("Protected security asset is truncated");
    const magic = new TextDecoder().decode(payload.subarray(0, _assetMagic.length));
    if (magic !== _assetMagic) throw new Error("Protected security asset header is invalid");

    if (!_assetCryptoKeyPromise) {
      const binary = atob(_assetKeyB64);
      const keyBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);
      _assetCryptoKeyPromise = crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );
    }

    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: payload.slice(8, 20), tagLength: 128 },
      await _assetCryptoKeyPromise,
      payload.slice(_assetHeaderBytes)
    );
  }

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
      const buf = await _loadProtectedAsset(wasmUrl);
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

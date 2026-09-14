/*
 * Standalone Web adapter for the Extension AI manager.
 *
 * The signal processing, queueing, model, and worklet code deliberately stay
 * in ai-vocal-manager.js. This file only supplies the small chrome.* asset and
 * storage surface that the extension receives from MV3. The extension source
 * therefore remains unchanged while Web uses the same AI implementation.
 */

import { AIVocalManager as ExtensionAIVocalManager } from "./ai-vocal-manager.js";

const WEB_ASSET_MAP = Object.freeze({
  "modules/ai-vocal/vocal-worklet.js": "worklet",
  "modules/ai-vocal/stft_simd.wasm": "stftSimd",
  "modules/ai-vocal/stft_scalar.wasm": "stftScalar",
  "model/model.json": "model",
  "assets/libs/js/tf-backend-webgpu.min.js": "webgpuBackend"
});

function installWebChromeShim(options = {}) {
  const assetUrls = options.assetUrls || {};
  const assetBase = new URL(options.assetBase || "./", document.baseURI);

  const getURL = (extensionPath) => {
    const assetKey = WEB_ASSET_MAP[extensionPath];
    if (assetKey && assetUrls[assetKey]) {
      return new URL(assetUrls[assetKey], document.baseURI).href;
    }
    return new URL(extensionPath, assetBase).href;
  };

  // Keep the exact manager code shared with the Extension. These methods are
  // intentionally no-ops because a standalone Web page has no MV3 storage
  // or runtime messaging channel.
  const chromeShim = {
    runtime: {
      getURL,
      sendMessage: () => Promise.resolve()
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {}
      }
    }
  };

  // Chrome exposes a partial window.chrome object even on normal pages. Add
  // the MV3-compatible surface instead of assuming that the global is absent.
  try {
    const browserChrome = globalThis.chrome || {};
    browserChrome.runtime = chromeShim.runtime;
    browserChrome.storage = chromeShim.storage;
    globalThis.chrome = browserChrome;
  } catch (_) {
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: chromeShim
    });
  }
}

export class AIVocalManager extends ExtensionAIVocalManager {
  constructor(audioCtx, options = {}) {
    installWebChromeShim(options);
    super(audioCtx);
  }
}

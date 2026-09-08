const WEB_ASSET_MAGIC = "NAMPWEB1";
const WEB_ASSET_KEY_B64 = "__NEXTAMP_WEB_ASSET_KEY__";
const WEB_ASSET_HEADER_BYTES = 20;
let webAssetCryptoKeyPromise = null;

function hasEmbeddedWebAssetKey() {
  return WEB_ASSET_KEY_B64 && !WEB_ASSET_KEY_B64.startsWith("__NEXTAMP_");
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getWebAssetCryptoKey() {
  if (!hasEmbeddedWebAssetKey()) return null;
  if (!webAssetCryptoKeyPromise) {
    const keyBytes = decodeBase64(WEB_ASSET_KEY_B64);
    webAssetCryptoKeyPromise = crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
  }
  return webAssetCryptoKeyPromise;
}

function hasProtectedHeader(bytes) {
  if (bytes.byteLength < WEB_ASSET_HEADER_BYTES) return false;
  return new TextDecoder().decode(bytes.subarray(0, WEB_ASSET_MAGIC.length)) === WEB_ASSET_MAGIC;
}

/**
 * Load a build-protected asset. Development/unpacked source builds keep using
 * the original plaintext asset paths; production builds decrypt the packed
 * bytes only in memory before handing them to WebAssembly or TensorFlow.js.
 */
export async function loadProtectedAsset(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Protected asset request failed: ${response.status}`);
  const payload = new Uint8Array(await response.arrayBuffer());
  const key = await getWebAssetCryptoKey();
  if (!key) return payload.buffer;
  if (!hasProtectedHeader(payload)) {
    throw new Error("Protected asset header is invalid");
  }

  const nonce = payload.slice(8, 20);
  const encrypted = payload.slice(WEB_ASSET_HEADER_BYTES);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    key,
    encrypted
  );
}

/**
 * TensorFlow.js IO handler for the encrypted model container. The production
 * model JSON and weight shard are joined, encrypted, and never written back
 * to disk as plaintext.
 */
export function createProtectedModelSource(tf, url) {
  return {
    async load() {
      if (!hasEmbeddedWebAssetKey()) {
        return tf.io.browserHTTPRequest(url).load();
      }

      const bytes = new Uint8Array(await loadProtectedAsset(url));
      if (bytes.byteLength < 8) throw new Error("Protected model payload is truncated");
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const jsonBytes = view.getUint32(0, true);
      const weightsBytes = view.getUint32(4, true);
      const jsonStart = 8;
      const weightsStart = jsonStart + jsonBytes;
      const weightsEnd = weightsStart + weightsBytes;
      if (weightsEnd > bytes.byteLength) throw new Error("Protected model payload size is invalid");

      const modelJson = JSON.parse(
        new TextDecoder().decode(bytes.subarray(jsonStart, weightsStart))
      );
      const weightSpecs = (modelJson.weightsManifest || [])
        .flatMap((manifest) => manifest.weights || []);
      const weightData = bytes.slice(weightsStart, weightsEnd).buffer;

      return {
        modelTopology: modelJson.modelTopology,
        weightSpecs,
        weightData
      };
    }
  };
}

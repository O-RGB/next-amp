// Chrome Web Store adapter: all executable and model assets are packaged as
// ordinary local files so reviewers can inspect the exact shipped bytes.
export async function loadProtectedAsset(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Local asset request failed: ${response.status}`);
  return response.arrayBuffer();
}

export function createProtectedModelSource(tf, url) {
  return tf.io.browserHTTPRequest(url);
}

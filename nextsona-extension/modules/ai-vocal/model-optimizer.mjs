const METADATA_KEY = "nextsonaModelOptimization";

function getOptimizationMetadata(artifacts) {
  const metadata = artifacts?.userDefinedMetadata?.[METADATA_KEY];
  return metadata?.version === 1 ? metadata : null;
}

function makeFallbackArtifacts(artifacts, metadata) {
  if (!metadata?.fallback?.modelTopology || !metadata?.fallback?.signature) return null;
  return {
    ...artifacts,
    modelTopology: metadata.fallback.modelTopology,
    signature: metadata.fallback.signature
  };
}

/**
 * Load a graph that was optimized and verified by nextsona-model-builder.
 * The runtime only selects the prebuilt topology; it never reparses or
 * rewrites the 15 MB model on the user's device.
 */
export function createVocalModelLoader(tf, source) {
  let preferOptimized = true;
  let foldedCount = 0;
  let explicitPadCount = 0;
  let outputHead = null;

  const resetState = () => {
    foldedCount = 0;
    explicitPadCount = 0;
    outputHead = null;
  };

  const loadArtifacts = artifacts => tf.loadGraphModel({ load: async () => artifacts });

  return {
    get foldedCount() { return foldedCount; },
    get explicitPadCount() { return explicitPadCount; },
    get outputHead() { return outputHead; },
    disableOptimization() {
      preferOptimized = false;
      resetState();
    },
    async load() {
      if (typeof source?.load !== "function") {
        resetState();
        return tf.loadGraphModel(source);
      }

      const artifacts = await source.load();
      const metadata = getOptimizationMetadata(artifacts);
      const fallback = makeFallbackArtifacts(artifacts, metadata);
      if (!preferOptimized || !metadata) {
        resetState();
        return loadArtifacts(!preferOptimized && fallback ? fallback : artifacts);
      }

      try {
        const model = await loadArtifacts(artifacts);
        foldedCount = Number(metadata.foldedCount) || 0;
        explicitPadCount = Number(metadata.explicitPadCount) || 0;
        outputHead = metadata.outputHead || null;
        return model;
      } catch (error) {
        if (!fallback) throw error;
        console.warn("[NextSona AI] Prebuilt optimized graph failed; loading embedded compatibility graph", error);
        preferOptimized = false;
        resetState();
        return loadArtifacts(fallback);
      }
    }
  };
}

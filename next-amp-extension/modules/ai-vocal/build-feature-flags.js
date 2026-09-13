// Build-time feature switches.
//
// Source/unbundled development defaults to the complete internal feature set.
// The Store build injects `__NEXTSTUDIO_GO_ENGINE_ENABLED__ = false` with
// esbuild, so the Go-only provider is not reachable from the submitted
// artifact. This is a build boundary, not a runtime secret or access control.
const injectedGoFlag =
  typeof __NEXTSTUDIO_GO_ENGINE_ENABLED__ === "undefined"
    ? true
    : __NEXTSTUDIO_GO_ENGINE_ENABLED__;

export const GO_ENGINE_ENABLED = injectedGoFlag === true;

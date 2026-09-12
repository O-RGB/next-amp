// Store-profile replacement for the optional native engine client.
// It keeps the shared manager safe when it receives an old persisted engine
// setting, but it contains no process/network endpoint.
export const ENGINE_TYPE = "webgl";
export const ENGINE_DISPLAY_NAME = "Browser WebGL";
export const ENGINE_API = "WEBGL";
export const ENGINE_HEALTH_URL = "";
export const ENGINE_SWITCH_TO_BROWSER_LABEL = "BROWSER WEBGL";
export const ENGINE_ACTIVATE_LABEL = "BROWSER ENGINE";

export class EngineClient {
  constructor() {
    this.isConnected = false;
    this.isConnecting = false;
    this.enabled = false;
    this.lastRtt = 0;
    this.deviceInfo = "";
    this.maxInFlightChunks = 0;
    this.backpressureDrops = 0;
  }

  enable() { return false; }
  disable() {}
  connect() {}
  resetStream() {}
  canSendChunk() { return false; }
  getPendingCount() { return 0; }
  sendChunk() { return false; }
}

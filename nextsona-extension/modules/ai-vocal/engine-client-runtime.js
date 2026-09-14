// Stable import point for the AI manager.
// The production build aliases this module to a no-op client for the Store
// profile, while the Go development profile resolves to the native client.
export {
  GoEngineClient as EngineClient,
  ENGINE_TYPE,
  ENGINE_DISPLAY_NAME,
  ENGINE_API,
  ENGINE_HEALTH_URL,
  ENGINE_SWITCH_TO_BROWSER_LABEL,
  ENGINE_ACTIVATE_LABEL,
} from "./go-engine-client.js";

(function () {
  "use strict";

  const number = (min, max) => ({ type: "number", min, max });
  const boolean = { type: "boolean" };
  const enumeration = (values) => ({ type: "enum", values });

  const PARAM_SCHEMA = Object.freeze({
    volume: number(0, 1), pan: number(-1, 1), pitch: number(-12, 12), reverb: number(0, 2),
    videoDelay: number(0, 5), videoZoom: number(1, 3), videoRotate: number(0, 360),
    videoPosX: number(-50, 50), videoPosY: number(-50, 50),
    isVocalOn: boolean, isEqOn: boolean, normalize: boolean, isVideoMasterOn: boolean,
    vocalMode: enumeration(["bypass", "karaoke", "acapella"]),
    videoQuality: enumeration(["max", "high", "medium", "low"]),
    eqPreset: enumeration(["flat", "pop", "rock", "jazz", "vocal", "custom"]),
    eq: number(-12, 12)
  });

  function readFragment() {
    const raw = window.location.hash.slice(1);
    const params = new URLSearchParams(raw);
    return { host: params.get("host") || "", token: params.get("token") || "" };
  }

  function validateParam(key, value, index) {
    const rule = PARAM_SCHEMA[key];
    if (!rule) return null;
    if (key === "eq" && (!Number.isInteger(Number(index)) || Number(index) < 0 || Number(index) > 9)) return null;
    if (rule.type === "boolean") return typeof value === "boolean" ? value : null;
    if (rule.type === "enum") return typeof value === "string" && rule.values.includes(value) ? value : null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= rule.min && numeric <= rule.max ? numeric : null;
  }

  window.NextStudioRemoteProtocol = Object.freeze({
    VERSION: 1,
    MAX_MESSAGE_BYTES: 4096,
    ALLOWED_KEYS: Object.freeze(Object.keys(PARAM_SCHEMA)),
    readFragment,
    validateParam,
    isMessage(value) { return value && typeof value === "object" && typeof value.type === "string"; },
    isStateMessage(value) { return this.isMessage(value) && (value.type === "SYNC_STATE" || value.type === "UPDATE_PARAM"); }
  });
})();

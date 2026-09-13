export const REMOTE_PROTOCOL_VERSION = 1;
export const REMOTE_MAX_MESSAGE_BYTES = 4096;

const number = (min, max) => ({ type: "number", min, max });
const boolean = Object.freeze({ type: "boolean" });
const enumeration = (values) => ({ type: "enum", values: Object.freeze(values) });

const PARAM_SCHEMA = Object.freeze({
  volume: number(0, 1),
  pan: number(-1, 1),
  pitch: number(-12, 12),
  reverb: number(0, 2),
  videoDelay: number(0, 5),
  videoZoom: number(1, 3),
  videoRotate: number(0, 360),
  videoPosX: number(-50, 50),
  videoPosY: number(-50, 50),
  isAudioMasterOn: boolean,
  isVocalOn: boolean,
  isEqOn: boolean,
  normalize: boolean,
  isVideoMasterOn: boolean,
  vocalMode: enumeration(["bypass", "karaoke", "acapella"]),
  videoQuality: enumeration(["max", "high", "mid", "low"]),
  eqPreset: enumeration(["flat", "bass", "rock", "pop", "voice", "custom"]),
  eq: number(-12, 12),
});

// Exported for the review-readiness test. The public Remote page keeps an
// equivalent schema, and the test compares both copies so a new control
// cannot silently receive different validation on the two sides.
export { PARAM_SCHEMA as REMOTE_PARAM_SCHEMA };

function serializedByteLength(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch (_) {
    return Infinity;
  }
}

export function isAllowedRemoteMessage(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.type === "string" &&
    serializedByteLength(value) <= REMOTE_MAX_MESSAGE_BYTES
  );
}

export function isValidRemoteHandshake(value) {
  return Boolean(
    isAllowedRemoteMessage(value) &&
    value.type === "HANDSHAKE" &&
    value.protocolVersion === REMOTE_PROTOCOL_VERSION &&
    typeof value.token === "string" &&
    /^[A-Za-z0-9_-]{22,128}$/.test(value.token)
  );
}

export function validateRemoteParam(key, value, index) {
  const rule = PARAM_SCHEMA[key];
  if (!rule) return null;
  if (key === "eq" && (!Number.isInteger(index) || index < 0 || index > 9)) return null;
  if (rule.type === "boolean") return typeof value === "boolean" ? value : null;
  if (rule.type === "enum") {
    return typeof value === "string" && rule.values.includes(value) ? value : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= rule.min && numeric <= rule.max
    ? numeric
    : null;
}

export function sanitizeRemoteCommand(value) {
  if (!isAllowedRemoteMessage(value)) return null;
  if (value.type === "GET_STATE") return { type: "GET_STATE" };
  if (value.type === "PING") {
    const ts = Number(value.ts);
    return Number.isFinite(ts) ? { type: "PING", ts } : null;
  }
  if (value.type !== "SET_PARAM" || typeof value.key !== "string") return null;
  const index = value.key === "eq" ? value.index : null;
  const validated = validateRemoteParam(value.key, value.value, index);
  if (validated === null) return null;
  const command = { type: "SET_PARAM", key: value.key, value: validated };
  if (value.key === "eq") command.index = index;
  return command;
}

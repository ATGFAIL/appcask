import { isBridgeErrorCode, type BridgeErrorCode } from './errors.js';
import { isEventName, isMethodName, type EventName, type MethodName } from './methods.js';

/** Channel tag on every message. Distinguishes appcask traffic from other `postMessage` users. */
export const BRIDGE_CHANNEL = 'appcask' as const;

/** Wire-protocol version. Bumped only on an incompatible envelope change. */
export const BRIDGE_VERSION = 1 as const;

/** Request ids are opaque but bounded, so a hostile page can't send huge keys. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Params = Record<string, unknown>;

export interface RequestMessage {
  channel: typeof BRIDGE_CHANNEL;
  version: typeof BRIDGE_VERSION;
  kind: 'request';
  id: string;
  method: MethodName;
  params: Params;
}

export interface ResponseMessage {
  channel: typeof BRIDGE_CHANNEL;
  version: typeof BRIDGE_VERSION;
  kind: 'response';
  id: string;
  ok: boolean;
  result?: Params;
  error?: { code: BridgeErrorCode; message: string };
}

export interface EventMessage {
  channel: typeof BRIDGE_CHANNEL;
  version: typeof BRIDGE_VERSION;
  kind: 'event';
  name: EventName;
  detail: Params;
}

export type BridgeMessage = RequestMessage | ResponseMessage | EventMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasEnvelope(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.channel === BRIDGE_CHANNEL &&
    value.version === BRIDGE_VERSION &&
    typeof value.kind === 'string'
  );
}

/** Parse a raw `postMessage` string into a typed request, or `null` if it isn't one. */
export function decodeRequest(raw: string): RequestMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!hasEnvelope(value) || value.kind !== 'request') return null;
  if (typeof value.id !== 'string' || !REQUEST_ID_PATTERN.test(value.id)) return null;
  if (!isMethodName(value.method)) return null;
  const params = value.params ?? {};
  if (!isRecord(params)) return null;
  return {
    channel: BRIDGE_CHANNEL,
    version: BRIDGE_VERSION,
    kind: 'request',
    id: value.id,
    method: value.method,
    params,
  };
}

/** Parse a raw string into a typed response, or `null`. */
export function decodeResponse(raw: string): ResponseMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!hasEnvelope(value) || value.kind !== 'response') return null;
  if (typeof value.id !== 'string' || !REQUEST_ID_PATTERN.test(value.id)) return null;
  if (typeof value.ok !== 'boolean') return null;
  if (value.ok) {
    const result = value.result ?? {};
    if (!isRecord(result)) return null;
    return { channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, kind: 'response', id: value.id, ok: true, result };
  }
  if (
    !isRecord(value.error) ||
    !isBridgeErrorCode(value.error.code) ||
    typeof value.error.message !== 'string'
  ) {
    return null;
  }
  return {
    channel: BRIDGE_CHANNEL,
    version: BRIDGE_VERSION,
    kind: 'response',
    id: value.id,
    ok: false,
    error: { code: value.error.code, message: value.error.message },
  };
}

/** Parse a raw string into a typed native event, or `null`. */
export function decodeEvent(raw: string): EventMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!hasEnvelope(value) || value.kind !== 'event') return null;
  if (!isEventName(value.name)) return null;
  const detail = value.detail ?? {};
  if (!isRecord(detail)) return null;
  return { channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, kind: 'event', name: value.name, detail };
}

export function encodeRequest(id: string, method: MethodName, params: Params): string {
  return safeStringify({ channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, kind: 'request', id, method, params });
}

export function encodeOk(id: string, result: Params): string {
  return safeStringify({ channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, kind: 'response', id, ok: true, result });
}

export function encodeError(id: string, code: BridgeErrorCode, message: string): string {
  return safeStringify({
    channel: BRIDGE_CHANNEL,
    version: BRIDGE_VERSION,
    kind: 'response',
    id,
    ok: false,
    error: { code, message },
  });
}

export function encodeEvent(name: EventName, detail: Params): string {
  return safeStringify({ channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, kind: 'event', name, detail });
}

// U+2028 / U+2029: valid in JSON strings but parsed as line terminators inside a
// <script>, so they must be escaped when a payload is injected into the page.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const SCRIPT_UNSAFE = new RegExp(`[<${LINE_SEP}${PARA_SEP}]`, 'g');

/**
 * `JSON.stringify` with the escapes that make a string safe to drop straight
 * into an injected `<script>` on the native side.
 */
export function safeStringify(value: unknown): string {
  return JSON.stringify(value).replace(SCRIPT_UNSAFE, (ch) => {
    if (ch === '<') return '\\u003c';
    if (ch === LINE_SEP) return '\\u2028';
    return '\\u2029';
  });
}

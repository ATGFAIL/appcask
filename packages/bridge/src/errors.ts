/** Stable error codes carried on a bridge `response` with `ok: false`. */
export const BRIDGE_ERROR_CODES = [
  /** A parameter was missing, the wrong type, or out of range. */
  'INVALID_ARGUMENT',
  /** The native module backing this method is not attached (e.g. running in a plain browser). */
  'NATIVE_UNAVAILABLE',
  /** The native side did not answer within the caller's timeout. */
  'TIMEOUT',
  /** The method is known but not implemented on this platform / OS version. */
  'NOT_SUPPORTED',
  /** The user or OS denied a required permission. */
  'PERMISSION_DENIED',
  /** The origin calling the bridge is not in `bridge.allowedOrigins`. */
  'ORIGIN_NOT_ALLOWED',
  /** An unexpected failure on the native side. */
  'INTERNAL',
] as const;

export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[number];

export function isBridgeErrorCode(value: unknown): value is BridgeErrorCode {
  return typeof value === 'string' && (BRIDGE_ERROR_CODES as readonly string[]).includes(value);
}

/** Error thrown on the native side and rejected from `window.appcask.*` on the web side. */
export class BridgeError extends Error {
  readonly code: BridgeErrorCode;
  constructor(code: BridgeErrorCode, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

import { BridgeError } from './errors.js';
import type { Params } from './protocol.js';

/**
 * Param readers for the native dispatcher. Each throws `BridgeError`
 * (`INVALID_ARGUMENT`) on a bad value, so a handler body can read params
 * straight-line and let the dispatcher turn a throw into an error response.
 *
 * Ported from the hand-rolled validators in the ATG Play shell.
 */

function fail(message: string): never {
  throw new BridgeError('INVALID_ARGUMENT', message);
}

/** Reject any param key not in `allowed`. Call first in every handler. */
export function onlyParams(params: Params, allowed: readonly string[]): void {
  for (const key of Object.keys(params)) {
    if (!allowed.includes(key)) fail(`unexpected parameter "${key}"`);
  }
}

export function stringParam(
  params: Params,
  key: string,
  opts: { max?: number; optional?: boolean; allowEmpty?: boolean } = {},
): string | null {
  const value = params[key];
  if ((value === undefined || value === null) && opts.optional) return null;
  if (typeof value !== 'string') fail(`"${key}" must be a string`);
  const trimmed = opts.allowEmpty ? value : value.trim();
  if (!opts.allowEmpty && !trimmed) fail(`"${key}" must not be empty`);
  if (opts.max !== undefined && trimmed.length > opts.max) {
    fail(`"${key}" must be at most ${opts.max} characters`);
  }
  return trimmed;
}

export function numberParam(
  params: Params,
  key: string,
  opts: { min?: number; max?: number; optional?: boolean } = {},
): number | null {
  const value = params[key];
  if ((value === undefined || value === null) && opts.optional) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`"${key}" must be a finite number`);
  if (opts.min !== undefined && value < opts.min) fail(`"${key}" must be >= ${opts.min}`);
  if (opts.max !== undefined && value > opts.max) fail(`"${key}" must be <= ${opts.max}`);
  return value;
}

/** A number clamped to the closed unit interval [0, 1]. */
export function unitParam(params: Params, key: string, optional = false): number | null {
  return numberParam(params, key, { min: 0, max: 1, optional });
}

export function boolParam(params: Params, key: string, optional = false): boolean | null {
  const value = params[key];
  if ((value === undefined || value === null) && optional) return null;
  if (typeof value !== 'boolean') fail(`"${key}" must be a boolean`);
  return value;
}

export function enumParam<T extends string>(
  params: Params,
  key: string,
  allowed: readonly T[],
  opts: { optional?: boolean } = {},
): T | null {
  const value = params[key];
  if ((value === undefined || value === null) && opts.optional) return null;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(`"${key}" must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

/**
 * An `https:` (or `http:` when `allowInsecure`) URL. Bridge navigation is the
 * one place a hostile page could try to point the shell somewhere odd, so this
 * is deliberately strict.
 */
export function urlParam(
  params: Params,
  key: string,
  opts: { optional?: boolean; allowInsecure?: boolean } = {},
): string | null {
  const raw = stringParam(params, key, { max: 4096, optional: opts.optional });
  if (raw === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail(`"${key}" is not a valid URL`);
  }
  const ok = parsed.protocol === 'https:' || (opts.allowInsecure === true && parsed.protocol === 'http:');
  if (!ok) fail(`"${key}" must be an https URL`);
  return parsed.toString();
}

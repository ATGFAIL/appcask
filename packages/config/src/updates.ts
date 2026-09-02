import type { UpdateManifest } from './types.js';

/** Parse the JSON hosted at `updates.manifestUrl`. Returns `null` if unusable. */
export function parseManifest(text: string): UpdateManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: UpdateManifest = {};
  if (typeof r.startUrl === 'string' && /^https:\/\//.test(r.startUrl)) out.startUrl = r.startUrl;
  if (typeof r.blocked === 'boolean') out.blocked = r.blocked;
  if (typeof r.message === 'string') out.message = r.message.slice(0, 500);
  if (typeof r.minShellVersion === 'string' && /^\d+\.\d+\.\d+$/.test(r.minShellVersion)) {
    out.minShellVersion = r.minShellVersion;
  }
  return out;
}

export interface ManifestGate {
  /** Show a full-screen stop instead of loading the site. */
  stop: boolean;
  reason?: 'blocked' | 'shell-outdated';
  message?: string;
}

/** Does the manifest say we can't proceed with this shell version? */
export function manifestGate(manifest: UpdateManifest | null, shellVersion: string): ManifestGate {
  if (!manifest) return { stop: false };
  if (manifest.blocked) {
    return { stop: true, reason: 'blocked', message: manifest.message };
  }
  if (manifest.minShellVersion && compareVersions(shellVersion, manifest.minShellVersion) < 0) {
    return {
      stop: true,
      reason: 'shell-outdated',
      message: manifest.message ?? `This app needs an update (v${manifest.minShellVersion}+).`,
    };
  }
  return { stop: false };
}

export interface HealthState {
  /** Consecutive failed loads. */
  failures: number;
  /** The last URL that passed the health check. */
  lastGoodUrl: string | null;
}

export type HealthAction =
  | { type: 'none' }
  | { type: 'retry' }
  | { type: 'load'; url: string }
  | { type: 'offline-screen' };

export interface HealthPolicy {
  maxFailures: number;
  onUnhealthy: 'offline-screen' | 'retry' | 'previous';
}

export const INITIAL_HEALTH: HealthState = { failures: 0, lastGoodUrl: null };

/**
 * Fold a load outcome into the health state and decide what the shell should do.
 * Pure — the shell persists `state` and performs `action`.
 */
export function reduceHealth(
  state: HealthState,
  event: { healthy: boolean; url: string },
  policy: HealthPolicy,
): { state: HealthState; action: HealthAction } {
  if (event.healthy) {
    return { state: { failures: 0, lastGoodUrl: event.url }, action: { type: 'none' } };
  }

  const failures = state.failures + 1;
  if (failures < policy.maxFailures) {
    return { state: { ...state, failures }, action: { type: 'retry' } };
  }

  // threshold reached
  if (policy.onUnhealthy === 'previous' && state.lastGoodUrl && state.lastGoodUrl !== event.url) {
    return { state: { failures: 0, lastGoodUrl: state.lastGoodUrl }, action: { type: 'load', url: state.lastGoodUrl } };
  }
  if (policy.onUnhealthy === 'retry') {
    return { state: { ...state, failures: 0 }, action: { type: 'retry' } };
  }
  return { state: { ...state, failures: 0 }, action: { type: 'offline-screen' } };
}

/** -1 / 0 / 1 for `a` vs `b`, both `x.y.z`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

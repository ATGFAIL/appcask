import { parseManifest, type HealthState, INITIAL_HEALTH } from '@appcask/config/updates';
import type { UpdateManifest } from '@appcask/config';
import { native } from './native';
import { config } from '../config';

const MANIFEST_KEY = 'appcask.update.manifest';
const HEALTH_KEY = 'appcask.update.health';

const updates = config.features.updates;

/** Whether `features.updates` is configured at all. */
export const updatesEnabled = updates != null;

/**
 * Fetch the remote manifest (short timeout), falling back to the last one we
 * cached. Returns `null` when there is no `manifestUrl` or nothing usable.
 */
export async function loadManifest(): Promise<UpdateManifest | null> {
  if (!updates?.manifestUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(updates.manifestUrl, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    }).finally(() => clearTimeout(timer));
    if (res.ok) {
      const text = await res.text();
      const manifest = parseManifest(text);
      if (manifest) {
        void secureSet(MANIFEST_KEY, text);
        return manifest;
      }
    }
  } catch {
    // network down / aborted — fall through to the cache
  }
  const cached = await secureGet(MANIFEST_KEY);
  return cached ? parseManifest(cached) : null;
}

export async function loadHealthState(): Promise<HealthState> {
  const raw = await secureGet(HEALTH_KEY);
  if (!raw) return INITIAL_HEALTH;
  try {
    const parsed = JSON.parse(raw) as Partial<HealthState>;
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lastGoodUrl: typeof parsed.lastGoodUrl === 'string' ? parsed.lastGoodUrl : null,
    };
  } catch {
    return INITIAL_HEALTH;
  }
}

export function saveHealthState(state: HealthState): void {
  void secureSet(HEALTH_KEY, JSON.stringify(state));
}

/**
 * A script that reports whether the page came up healthy — either a required
 * selector appeared, or (with no selector) the document finished loading with
 * visible text — within the timeout.
 */
export function healthCheckScript(): string {
  const selector = updates?.healthCheck.selector ?? null;
  const timeoutMs = updates?.healthCheck.timeoutMs ?? 12000;
  return `(function () {
  try {
    var sel = ${selector ? JSON.stringify(selector) : 'null'};
    var deadline = Date.now() + ${timeoutMs};
    function report(ok) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ channel: 'appcask', kind: 'health', healthy: !!ok }));
      }
    }
    function check() {
      try {
        if (sel) {
          if (document.querySelector(sel)) return report(true);
        } else if (document.readyState === 'complete' && document.body &&
                   (document.body.innerText || '').trim().length > 0) {
          return report(true);
        }
      } catch (e) {}
      if (Date.now() > deadline) return report(false);
      setTimeout(check, 250);
    }
    check();
  } catch (e) {}
})();
true;`;
}

/** Recognise the message the health script posts (not a bridge request). */
export function parseHealthMessage(raw: string): { healthy: boolean } | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (v.channel === 'appcask' && v.kind === 'health' && typeof v.healthy === 'boolean') {
      return { healthy: v.healthy };
    }
  } catch {
    /* not ours */
  }
  return null;
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await native.secureGet(key);
  } catch {
    return null;
  }
}
async function secureSet(key: string, value: string): Promise<void> {
  try {
    await native.secureSet(key, value);
  } catch {
    /* no secure store on this build — history just won't persist */
  }
}

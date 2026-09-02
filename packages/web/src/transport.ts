import {
  BridgeError,
  decodeResponse,
  decodeEvent,
  encodeRequest,
  type EventName,
  type MethodName,
  type MethodParams,
  type MethodResult,
  type Params,
} from '@appcask/bridge';

/** Shape the native shell sets on `window` before the page's first paint. */
export interface AppcaskEnv {
  present: true;
  platform: 'android' | 'ios';
  shellVersion: string;
  appVersion: string;
  bridgeVersion: number;
}

interface AppcaskGlobal {
  __APPCASK__?: AppcaskEnv;
  __appcaskReceive?: (raw: string) => void;
  __appcaskEmit?: (raw: string) => void;
  ReactNativeWebView?: { postMessage: (data: string) => void };
}

function global(): AppcaskGlobal {
  return globalThis as unknown as AppcaskGlobal;
}

/** Whether the page is running inside the appcask native shell. */
export function getEnv(): AppcaskEnv | null {
  const env = global().__APPCASK__;
  return env && env.present === true ? env : null;
}

export interface TransportOptions {
  /** Per-call timeout in ms. A stuck native handler must never hang the caller. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

interface Pending {
  resolve: (result: Params) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, Pending>();
let counter = 0;
let installed = false;

/**
 * Wire `window.__appcaskReceive` / `window.__appcaskEmit` so the native shell
 * has somewhere to deliver replies and events. Runs once, on import — importing
 * this package is what "connects" the page to the shell.
 */
function ensureInstalled(): void {
  if (installed) return;
  installed = true;
  const g = global();

  g.__appcaskReceive = (raw: string) => {
    const response = decodeResponse(raw);
    if (!response) return;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    clearTimeout(entry.timer);
    if (response.ok) {
      entry.resolve(response.result ?? {});
    } else {
      const err = response.error ?? { code: 'INTERNAL' as const, message: 'unknown bridge error' };
      entry.reject(new BridgeError(err.code, err.message));
    }
  };

  g.__appcaskEmit = (raw: string) => {
    const event = decodeEvent(raw);
    if (!event) return;
    dispatchBridgeEvent(event.name, event.detail);
  };
}

function dispatchBridgeEvent(name: EventName, detail: Params): void {
  lastEventDetail.set(name, detail);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(`appcask:${name}`, { detail }));
  }
  for (const listener of listeners.get(name) ?? []) {
    try {
      listener(detail);
    } catch {
      /* a listener throwing must not break the others */
    }
  }
}

const listeners = new Map<EventName, Set<(detail: Params) => void>>();
const lastEventDetail = new Map<EventName, Params>();

/** Subscribe to a native event. Returns an unsubscribe function. */
export function onBridgeEvent(name: EventName, listener: (detail: Params) => void): () => void {
  ensureInstalled();
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
}

/** The most recent detail seen for an event, or `undefined`. */
export function lastEvent(name: EventName): Params | undefined {
  return lastEventDetail.get(name);
}

/**
 * Send one request to the native shell and await its typed result.
 * Rejects with `BridgeError('NATIVE_UNAVAILABLE')` outside the shell and
 * `BridgeError('TIMEOUT')` if native does not answer in time.
 */
export function call<M extends MethodName>(
  method: M,
  params: MethodParams<M>,
  options: TransportOptions = {},
): Promise<MethodResult<M>> {
  ensureInstalled();
  const g = global();
  const post = g.ReactNativeWebView?.postMessage;
  if (!getEnv() || typeof post !== 'function') {
    return Promise.reject(
      new BridgeError('NATIVE_UNAVAILABLE', `appcask.${method}: not running inside the appcask shell`),
    );
  }

  counter += 1;
  const id = `w${Date.now().toString(36)}-${counter.toString(36)}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<MethodResult<M>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new BridgeError('TIMEOUT', `appcask.${method}: no response in ${timeoutMs}ms`));
    }, timeoutMs);

    pending.set(id, {
      resolve: resolve as (result: Params) => void,
      reject,
      timer,
    });

    try {
      post(encodeRequest(id, method, params as Params));
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      reject(
        new BridgeError('INTERNAL', `appcask.${method}: ${err instanceof Error ? err.message : String(err)}`),
      );
    }
  });
}

ensureInstalled();

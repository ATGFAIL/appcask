import type {
  DeviceInfo,
  EventMap,
  HapticType,
  Insets,
  SharePayload,
  StatusBarPayload,
} from '@appcask/bridge';
import { call, getEnv, lastEvent, onBridgeEvent, type TransportOptions } from './transport.js';

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** `true` when the page is running inside the appcask native shell. */
export function isAppcask(): boolean {
  return getEnv() !== null;
}

export interface AppcaskClient {
  /** `true` inside the native shell. */
  readonly isNative: boolean;
  /** `'android'`, `'ios'`, or `'web'` when not in the shell. */
  readonly platform: 'android' | 'ios' | 'web';

  /** Full device / shell info. Rejects outside the shell. */
  getInfo(options?: TransportOptions): Promise<DeviceInfo>;

  /** Trigger haptic feedback. No-op in a normal browser. */
  haptic(type?: HapticType, options?: TransportOptions): Promise<void>;

  /** Native share sheet, falling back to `navigator.share` then a copy. */
  share(payload: SharePayload, options?: TransportOptions): Promise<{ shared: boolean }>;

  /**
   * Navigate the shell's WebView natively (avoids the `location.*` bounce).
   * Falls back to `location.assign` in a browser.
   */
  navigate(url: string, options?: TransportOptions): Promise<void>;

  /** Open a URL in a Custom Tab / new tab, never replacing the app view. */
  openExternal(url: string, options?: TransportOptions): Promise<void>;

  /** Recolour the native status bar. No-op in a browser. */
  setStatusBar(payload: StatusBarPayload, options?: TransportOptions): Promise<void>;

  /** Encrypted key/value store (Keychain / Keystore). Falls back to `localStorage`. */
  readonly secureStore: {
    get(key: string, options?: TransportOptions): Promise<string | null>;
    set(key: string, value: string, options?: TransportOptions): Promise<void>;
    remove(key: string, options?: TransportOptions): Promise<void>;
  };

  readonly clipboard: {
    read(options?: TransportOptions): Promise<string>;
    write(text: string, options?: TransportOptions): Promise<void>;
  };

  /** Push notifications. No-ops outside the shell / when push isn't configured. */
  readonly push: {
    /** Prompt for permission. Resolves `false` outside the shell. */
    requestPermission(options?: TransportOptions): Promise<boolean>;
    /** The device push token, or `null`. */
    getToken(options?: TransportOptions): Promise<string | null>;
  };

  /** Latest safe-area insets pushed by native (zeros in a browser). */
  insets(): Insets;

  /** Subscribe to a native event. Returns an unsubscribe function. */
  on<K extends keyof EventMap>(name: K, listener: (detail: EventMap[K]) => void): () => void;
}

async function browserFallbackShare(payload: SharePayload): Promise<{ shared: boolean }> {
  const nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: payload.title, text: payload.text, url: payload.url });
      return { shared: true };
    } catch {
      return { shared: false };
    }
  }
  const text = [payload.text, payload.url].filter(Boolean).join(' ');
  if (text && nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }
  return { shared: false };
}

export const appcask: AppcaskClient = {
  get isNative() {
    return isAppcask();
  },
  get platform() {
    return getEnv()?.platform ?? 'web';
  },

  getInfo(options) {
    return call('getInfo', {}, options);
  },

  haptic(type = 'selection', options) {
    if (!isAppcask()) return Promise.resolve();
    return call('haptic', { type }, options).then(() => undefined);
  },

  share(payload, options) {
    if (!isAppcask()) return browserFallbackShare(payload);
    return call('share', payload, options);
  },

  navigate(url, options) {
    if (!isAppcask()) {
      try {
        if (typeof location !== 'undefined') location.assign(url);
      } catch {
        /* jsdom / sandboxed frames disallow navigation */
      }
      return Promise.resolve();
    }
    return call('navigate', { url }, options).then(() => undefined);
  },

  openExternal(url, options) {
    if (!isAppcask()) {
      try {
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
      } catch {
        /* ignore popup blockers */
      }
      return Promise.resolve();
    }
    return call('openExternal', { url }, options).then(() => undefined);
  },

  setStatusBar(payload, options) {
    if (!isAppcask()) return Promise.resolve();
    return call('setStatusBar', payload, options).then(() => undefined);
  },

  secureStore: {
    get(key, options) {
      if (!isAppcask()) {
        return Promise.resolve(readLocal(`appcask:${key}`));
      }
      return call('secureStore.get', { key }, options).then((r) => r.value);
    },
    set(key, value, options) {
      if (!isAppcask()) {
        writeLocal(`appcask:${key}`, value);
        return Promise.resolve();
      }
      return call('secureStore.set', { key, value }, options).then(() => undefined);
    },
    remove(key, options) {
      if (!isAppcask()) {
        writeLocal(`appcask:${key}`, null);
        return Promise.resolve();
      }
      return call('secureStore.remove', { key }, options).then(() => undefined);
    },
  },

  clipboard: {
    read(options) {
      if (!isAppcask()) {
        return typeof navigator !== 'undefined' && navigator.clipboard
          ? navigator.clipboard.readText()
          : Promise.resolve('');
      }
      return call('clipboard.read', {}, options).then((r) => r.text);
    },
    write(text, options) {
      if (!isAppcask()) {
        return typeof navigator !== 'undefined' && navigator.clipboard
          ? navigator.clipboard.writeText(text)
          : Promise.resolve();
      }
      return call('clipboard.write', { text }, options).then(() => undefined);
    },
  },

  push: {
    requestPermission(options) {
      if (!isAppcask()) return Promise.resolve(false);
      return call('push.requestPermission', {}, options).then((r) => r.granted);
    },
    getToken(options) {
      if (!isAppcask()) return Promise.resolve(null);
      return call('push.getToken', {}, options).then((r) => r.token);
    },
  },

  insets() {
    const detail = lastEvent('context') as { insets?: Insets } | undefined;
    return detail?.insets ?? ZERO_INSETS;
  },

  on(name, listener) {
    return onBridgeEvent(name, listener as (detail: Record<string, unknown>) => void);
  },
};

function readLocal(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode / disabled storage */
  }
}

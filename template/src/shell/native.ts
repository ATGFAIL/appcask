import { NativeModules, Platform } from 'react-native';
import { BridgeError } from '@appcask/bridge';

/** The Kotlin / Swift module. Every method is also guarded by a JS-side timeout below. */
interface AppcaskNativeModule {
  haptic(type: string): Promise<void>;
  share(payload: { title?: string; text?: string; url?: string }): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  setStatusBar(style: string | null, color: string | null): Promise<void>;
  secureGet(key: string): Promise<string | null>;
  secureSet(key: string, value: string): Promise<void>;
  secureRemove(key: string): Promise<void>;
  clipboardRead(): Promise<string>;
  clipboardWrite(text: string): Promise<void>;
  /** Open `url` in a Custom Tab / ASWebAuthenticationSession, resolve with the captured redirect. */
  startAuthSession(url: string, callbackHosts: string[]): Promise<{ redirectUrl: string }>;
  osVersion(): Promise<string>;
}

const RawNative = NativeModules.AppcaskNative as AppcaskNativeModule | undefined;

/**
 * A native call that never resolves would hang the caller forever — a real bug
 * seen with stuck Keychain / bridge calls. Every method gets its own timeout and
 * rejects with `BridgeError('TIMEOUT')` instead.
 */
function withTimeout<T>(label: string, work: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new BridgeError('TIMEOUT', `native ${label} did not respond in ${ms}ms`)), ms),
    ),
  ]);
}

function requireNative(): AppcaskNativeModule {
  if (!RawNative) {
    throw new BridgeError('NATIVE_UNAVAILABLE', 'the AppcaskNative module is not linked');
  }
  return RawNative;
}

export const native = {
  get available(): boolean {
    return RawNative != null;
  },

  haptic: (type: string) => withTimeout('haptic', requireNative().haptic(type), 2000),

  share: (payload: { title?: string; text?: string; url?: string }) =>
    withTimeout('share', requireNative().share(payload), 60_000),

  openExternal: (url: string) => withTimeout('openExternal', requireNative().openExternal(url), 5000),

  setStatusBar: (style: string | null, color: string | null) =>
    withTimeout('setStatusBar', requireNative().setStatusBar(style, color), 2000),

  secureGet: (key: string) => withTimeout('secureGet', requireNative().secureGet(key), 5000),
  secureSet: (key: string, value: string) =>
    withTimeout('secureSet', requireNative().secureSet(key, value), 5000),
  secureRemove: (key: string) => withTimeout('secureRemove', requireNative().secureRemove(key), 5000),

  clipboardRead: () => withTimeout('clipboardRead', requireNative().clipboardRead(), 3000),
  clipboardWrite: (text: string) =>
    withTimeout('clipboardWrite', requireNative().clipboardWrite(text), 3000),

  startAuthSession: (url: string, callbackHosts: string[]) =>
    withTimeout('startAuthSession', requireNative().startAuthSession(url, callbackHosts), 300_000),

  osVersion: (): Promise<string> =>
    RawNative
      ? withTimeout('osVersion', RawNative.osVersion(), 2000).catch(() => String(Platform.Version))
      : Promise.resolve(String(Platform.Version)),
};

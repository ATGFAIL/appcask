/**
 * The v1 method surface of `window.appcask`.
 *
 * Every entry maps a method name to its params and result. The web client, the
 * native dispatcher, and the docs all read from this one map.
 */

export type Platform = 'android' | 'ios';

export interface DeviceInfo {
  platform: Platform;
  /** OS version string, e.g. "14" or "17.5". */
  osVersion: string;
  /** The host app's marketing version (from the config `identity.version`). */
  appVersion: string;
  /** The appcask shell version that built the app. */
  shellVersion: string;
  /** Bridge protocol version — always `BRIDGE_VERSION` for this build. */
  bridgeVersion: number;
  /** Safe-area insets in CSS pixels. */
  insets: Insets;
  /** Whether the device reports a network connection right now. */
  online: boolean;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export interface StatusBarPayload {
  style?: 'light' | 'dark';
  /** Hex colour for the Android status-bar background. */
  color?: string;
}

/** name -> { params, result } */
export interface MethodMap {
  getInfo: { params: Record<never, never>; result: DeviceInfo };
  haptic: { params: { type: HapticType }; result: Record<never, never> };
  share: { params: SharePayload; result: { shared: boolean } };
  /** Load `url` via the native WebView, bypassing JS navigation (avoids the `location.*` bounce). */
  navigate: { params: { url: string }; result: Record<never, never> };
  /** Open `url` in a Custom Tab / `SFSafariViewController` (or the system browser). */
  openExternal: { params: { url: string }; result: Record<never, never> };
  setStatusBar: { params: StatusBarPayload; result: Record<never, never> };
  'secureStore.get': { params: { key: string }; result: { value: string | null } };
  'secureStore.set': { params: { key: string; value: string }; result: Record<never, never> };
  'secureStore.remove': { params: { key: string }; result: Record<never, never> };
  'clipboard.read': { params: Record<never, never>; result: { text: string } };
  'clipboard.write': { params: { text: string }; result: Record<never, never> };
}

export type MethodName = keyof MethodMap;

export type MethodParams<M extends MethodName> = MethodMap[M]['params'];
export type MethodResult<M extends MethodName> = MethodMap[M]['result'];

export const METHOD_NAMES = [
  'getInfo',
  'haptic',
  'share',
  'navigate',
  'openExternal',
  'setStatusBar',
  'secureStore.get',
  'secureStore.set',
  'secureStore.remove',
  'clipboard.read',
  'clipboard.write',
] as const satisfies readonly MethodName[];

export function isMethodName(value: unknown): value is MethodName {
  return typeof value === 'string' && (METHOD_NAMES as readonly string[]).includes(value);
}

/**
 * Events pushed from native to the page (no reply). Delivered to
 * `window.addEventListener('appcask:<name>', e => e.detail)`.
 */
export interface EventMap {
  /** Fires on first load and whenever insets / connectivity change. */
  context: { insets: Insets; platform: Platform; online: boolean };
  /** A deep link arrived while the app was already running. */
  deeplink: { url: string };
  /** App moved between foreground and background. */
  appstate: { state: 'active' | 'background' };
  /** Network connectivity changed. */
  network: { online: boolean };
}

export type EventName = keyof EventMap;

export const EVENT_NAMES = ['context', 'deeplink', 'appstate', 'network'] as const satisfies readonly EventName[];

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value);
}

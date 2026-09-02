/**
 * Push stub. When `features.push` is set AND a `google-services.json` is present,
 * `appcask android` replaces this file with the @react-native-firebase
 * implementation and wires the Gradle plugin + deps.
 *
 * Without that, push is a no-op — `window.appcask.push.*` resolves with
 * `{ granted: false }` / `{ token: null }`.
 */
export const pushEnabled = false;

export async function requestPermission(): Promise<boolean> {
  return false;
}

export async function getToken(): Promise<string | null> {
  return null;
}

export function onNotificationTapUrl(_cb: (url: string) => void): () => void {
  return () => {};
}

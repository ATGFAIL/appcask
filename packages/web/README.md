# @appcask/web

The typed `window.appcask` client for your website. Talks to the appcask native
shell when running inside it, and falls back to Web APIs in a normal browser so
**one site works everywhere**.

```ts
import { appcask, isAppcask } from '@appcask/web';

if (isAppcask()) {
  await appcask.haptic('success');
}

await appcask.share({ text: 'Look at this', url: location.href }); // navigator.share in a browser
appcask.navigate('/next');            // native loadUrl in the shell, location.assign in a browser
await appcask.secureStore.set('token', jwt); // Keychain / Keystore, else localStorage

const stop = appcask.on('context', ({ insets }) => applyInsets(insets));
```

- Every call has its own timeout — a stuck native handler rejects with
  `BridgeError('TIMEOUT')` instead of hanging.
- `appcask.insets()` returns the latest safe-area insets (also published as the
  `--appcask-{top,right,bottom,left}-inset` CSS variables by the shell).
- Outside the shell: `haptic`/`setStatusBar` no-op, `getInfo` rejects with
  `NATIVE_UNAVAILABLE`, everything else uses a sensible Web fallback.

Protocol: [`BRIDGE_PROTOCOL.md`](../../BRIDGE_PROTOCOL.md).

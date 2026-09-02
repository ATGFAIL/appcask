# template/ — the appcask React Native shell

The app the CLI materializes and builds. **Not** part of the pnpm workspace — it
has its own React Native toolchain and depends on the `@appcask/*` packages via
`file:` links.

```bash
# from the repo root, once, so the linked packages have a dist/
pnpm -r --filter "./packages/*" build

cd template
npm install
npm run typecheck   # tsc
npm test            # jest — the bridge dispatcher
npm run android     # needs an emulator / device + Android SDK
```

## Layout

| path | what it is |
|---|---|
| `appcask.config.json` | the app config — the CLI rewrites this per project |
| `src/config.ts` | resolves the config once at startup (`applyDefaults`, no ajv) |
| `src/shell/WebShell.tsx` | the WebView host — theme, router, offline, back handler |
| `src/shell/injection.ts` | pre-content script (`window.__APPCASK__`) + safe-area CSS vars + bridge delivery |
| `src/shell/bridgeDispatch.ts` | handles one `window.appcask` request → native → response |
| `src/shell/native.ts` | typed `NativeModules.AppcaskNative` wrapper — **every call has its own timeout** |
| `android/.../AppcaskNativeModule.kt` | Kotlin: haptics, share, Custom Tabs, status bar, EncryptedSharedPreferences, clipboard, Custom Tabs auth handoff |
| `android/.../AuthRedirectBus.kt` + `MainActivity.kt` | catch the App Link redirect back from a Custom Tab auth flow |

## Routing

Every navigation goes through [`@appcask/router`](../packages/router):

- internal host → stays in the WebView
- a `separateDocumentPatterns` path → native `loadUrl` (avoids the `location.*` bounce)
- an `externalBrowserAuth` host → `startAuthSession` → Custom Tab → App Link redirect → resume
- anything else web → Custom Tab; non-web scheme → the OS; `about:blank` / `javascript:` → blocked

## Status

- Android shell: **working** (config, routing, bridge, OAuth handoff, offline, back handler).
  APK build verified on a normal dev machine — not in every CI sandbox (RN pulls a
  large native toolchain).
- iOS shell: scaffolded only. `ASWebAuthenticationSession` + the Swift bridge are
  the next milestone.
- Icon / splash generation, deep-link manifest patching, and the `assets` /
  `android` / `build` CLI commands are still to come.

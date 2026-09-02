# template/ — the appcask React Native shell

This is the app the CLI materializes and builds. It is **not** part of the pnpm
workspace (it has its own React Native toolchain).

Status: **in progress.** The shared logic it builds on is already done and tested:

- [`@appcask/config`](../packages/config) — loads and resolves `appcask.config.json`
- [`@appcask/router`](../packages/router) — decides internal / separate-document / auth / external / system for every navigation
- [`@appcask/bridge`](../packages/bridge) — the `window.appcask` wire protocol
- [`@appcask/web`](../packages/web) — the client the wrapped site calls

## What lands here

| area | notes |
|---|---|
| `src/App.tsx` | the WebView host — reads the bundled config, applies theme, wires the router |
| `src/bridge/` | native dispatch for the `@appcask/bridge` protocol, every handler wrapped in its own timeout |
| `android/` | Kotlin: `AppcaskWebViewModule`, Custom Tabs auth handoff, `DownloadManager`, file chooser, App Links |
| `ios/` | Swift: `ASWebAuthenticationSession` handoff — later milestone |

The shell is a generalization of a hand-built WebView wrapper that shipped to
production three times; the hard-won fixes (OAuth handoff, the `location.*`
navigation bounce, native calls that hang forever, Keychain writes that silently
fail on some ROMs) are the reason appcask exists.

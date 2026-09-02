<div align="center">

# appcask

**Turn any website into a real Android & iOS app — from one config file.**

The native integration [Median](https://median.co) (formerly GoNative) puts behind a paywall,
open-source and MIT-licensed.

[![CI](https://github.com/ATGFAIL/appcask/actions/workflows/ci.yml/badge.svg)](https://github.com/ATGFAIL/appcask/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[Quick start](#quick-start-local) · [Why appcask](#why-appcask) · [Docs](./docs) · [Config reference](./docs/config.md) · [Bridge protocol](./BRIDGE_PROTOCOL.md)

</div>

---

> **Status:** early development. The Android shell, config schema, and CLI work.
> iOS, push notifications, and native navigation are on the [roadmap](#roadmap).

## No terminal? Build it in the cloud

Fork this repo, edit [`my-app/appcask.config.json`](./my-app) in the browser,
run the **Build my app** action, download the APK. Full walkthrough:
[docs/getting-started.md](./docs/getting-started.md#the-no-terminal-way) ·
prompts for doing it with an AI assistant: [docs/with-ai.md](./docs/with-ai.md).

## Quick start (local)

```bash
npx appcask init            # scaffold appcask.config.json + assets/
# drop assets/icon.png (1024×1024) and edit the config
npx appcask doctor          # validate config, check assetlinks / icon sizes
npx appcask build android   # materialize + Gradle -> APK  (needs Android SDK + JDK 17)
```

The `build` step runs `appcask android` first — copies the React Native shell,
rewrites the package name / app name / version / theme, generates every icon
size, and vendors the `@appcask/*` packages — then `npm install` + Gradle.
Or run `appcask android` yourself and build the resulting RN project by hand.

A minimal `appcask.config.json`:

```jsonc
{
  "identity": { "appName": "Acme", "packageName": "com.acme.app", "version": "1.0.0" },
  "startUrl": "https://acme.example",
  "internalHosts": ["acme.example"],
  "theme": {
    "statusBar": { "style": "light", "color": "#0b0b10" },
    "splash": { "background": "#0b0b10", "logo": "assets/logo.png" }
  },
  "features": {
    "pullToRefresh": true,
    "offlinePage": true,
    "externalBrowserAuth": ["accounts.google.com", "appleid.apple.com"]
  }
}
```

## Why appcask

Wrapping a website in a `WebView` is easy. Shipping one that behaves like an app is not —
and that gap is exactly where the hard, under-documented problems live:

| Problem | What actually happens | How appcask handles it |
|---|---|---|
| **Google / Apple / Microsoft sign-in** | Embedded WebViews are blocked — the flow dies with `disallowed_useragent` before the password field | Auth domains are handed to **Custom Tabs / `ASWebAuthenticationSession`** (the real browser + cookie jar), the callback is intercepted, and the session is returned to the WebView |
| **SPA navigation "bounce"** | `location.href` / `assign` inside a WebView skips `shouldOverrideUrlLoading`, leaving the app on a route the SPA can't render | `separateDocumentPatterns` routes real page loads through native `loadUrl` via the bridge — never JS navigation |
| **Native calls that hang forever** | A stuck Keychain / native-bridge call resolves *never*, with no error | Every `window.appcask.*` call is wrapped in its own timeout and rejects cleanly |
| **`<input type="file">` does nothing** | Android WebView has no default file chooser; downloads are swallowed | Native file picker + camera capture + `DownloadManager` wired in |
| **Session lost on restart** | Some vendor ROMs expose Keychain but fail the final encrypted write | Verify-after-write + app-private fallback so a login is never silently discarded |
| **Deep links / App Links** | `assetlinks.json` / `apple-app-site-association` misconfigured = links open the browser, not the app | `appcask doctor` checks reachability and format; the CLI writes the intent filters |
| **The web header hides under the status bar** | a full-screen WebView has no chrome to push the page down, and Android 15+ forces edge-to-edge | `theme.safeArea: "inset"` (default) pads the WebView to the safe area — any site looks right unchanged |
| **The bridge is an open API to whatever's in the WebView** | third-party pages and injected scripts can call `window.appcask` too | `bridge.grants` scopes each capability to a host / path — session storage only under `/account`, etc. |

See [docs/gotchas.md](./docs/gotchas.md) for the full write-up on each.

### appcask vs the alternatives

| | appcask | Median.co | Capacitor (`server.url`) | bare `react-native-webview` |
|---|:--:|:--:|:--:|:--:|
| Open source | ✅ MIT | ❌ | ✅ | ✅ |
| Push / biometric / deep links included | ✅ | 💰 Business/Enterprise tier | build it yourself | build it yourself |
| App-store-safe remote URL | ✅ | ✅ | ⚠️ "not for production" | ✅ |
| Config-file driven | ✅ | ✅ (hosted studio) | ❌ | ❌ |
| OAuth handoff to real browser | ✅ built in | ✅ | ❌ | ❌ |
| Self-hosted build | ✅ | ❌ | ✅ | ✅ |

## Packages

| Package | What it is |
|---|---|
| [`appcask`](./packages/cli) | the CLI — `init`, `doctor`, `assets`, `android`, `build`, `run` |
| [`@appcask/config`](./packages/config) | the config JSON Schema, validator, and generated types |
| [`@appcask/web`](./packages/web) | typed `window.appcask` client for your website (no-ops in a normal browser) |
| [`template/`](./template) | the React Native shell the CLI materializes and builds |

## Roadmap

- [x] Config schema + validator (`@appcask/config`)
- [x] Bridge wire protocol + codec (`@appcask/bridge`)
- [x] URL router — internal / separate-doc / auth / external / system (`@appcask/router`)
- [x] `@appcask/web` client with per-call timeouts and browser fallbacks
- [x] Android shell: WebView, router, `window.appcask` bridge, OAuth handoff, offline, back handler
- [x] Safe-area handling by default (`theme.safeArea: "inset"`)
- [x] Per-host/path capability scoping for the bridge (`bridge.grants`)
- [x] CLI: `init`, `doctor`, `assets`, `android` (materialize + rename + icons), `build android`
- [ ] `appcask doctor --production` — real OAuth / deep-link / signing / store-risk checks
- [ ] Safe remote updates: version pinning, health check, auto-rollback
- [ ] Docs site + demo APK in Releases
- [ ] iOS shell (`ASWebAuthenticationSession`)
- [ ] Downloads + `<input type=file>` camera capture
- [ ] Push (FCM + APNs) → tap opens a URL
- [ ] Native bottom-tab / drawer navigation
- [ ] Biometric app-lock, in-app review prompt

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](./LICENSE) © appcask contributors

<div align="center">

# appcask

**Turn any website into a real Android & iOS app — from one config file.**

The native integration [Median](https://median.co) (formerly GoNative) puts behind a paywall,
open-source and MIT-licensed.

[![CI](https://github.com/ATGFAIL/appcask/actions/workflows/ci.yml/badge.svg)](https://github.com/ATGFAIL/appcask/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[Quick start](#quick-start) · [Why appcask](#why-appcask) · [Config reference](./docs) · [Bridge protocol](./BRIDGE_PROTOCOL.md)

</div>

---

> **Status:** early development. The Android shell, config schema, and CLI are landing first.
> iOS, push notifications, and native navigation are on the [roadmap](#roadmap).

## Quick start

```bash
npx appcask init          # scaffold appcask.config.json + assets/
npx appcask doctor        # validate config, check assetlinks / icon sizes
npx appcask assets        # generate every icon + splash size from one source
npx appcask build android # -> signed APK / AAB
```

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

See [`docs/gotchas`](./docs) for the full write-up on each.

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

- [x] Config schema + validator
- [ ] CLI: `init`, `doctor`, `assets`, `android`, `build android`
- [ ] Android shell: WebView, URL router, `window.appcask` bridge, OAuth handoff, offline, downloads
- [ ] `@appcask/web` client
- [ ] Docs site + demo APK
- [ ] iOS shell (`ASWebAuthenticationSession`)
- [ ] Push (FCM + APNs) → tap opens a URL
- [ ] Native bottom-tab / drawer navigation
- [ ] Biometric app-lock, in-app review prompt

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](./LICENSE) © appcask contributors

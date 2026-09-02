# `appcask.config.json` reference

One file describes the whole app. Only `identity` and `startUrl` are required.

```jsonc
{
  "$schema": "https://appcask.dev/schema/v1.json",

  "identity": {
    "appName": "Acme",                 // REQUIRED — label under the launcher icon (max 50 chars)
    "packageName": "com.acme.app",     // REQUIRED — unique app id, reverse-DNS, lowercase.
                                       //            Also the iOS bundle id. Never change it after publishing.
    "version": "1.0.0"                 // REQUIRED — x.y.z. The build number is derived from it.
  },

  "startUrl": "https://acme.example/", // REQUIRED — first page the app loads. Must be https.

  "internalHosts": ["acme.example", "www.acme.example"],
                                       // Domains that render INSIDE the app. Anything else opens
                                       // in a browser sheet. Defaults to the host of startUrl.

  "theme": {
    "statusBar": {
      "style": "dark",                 // "dark" = dark icons (for a light bar), "light" = light icons
      "color": "#ffffff"               // Android status-bar background
    },
    "navigationBarColor": "#ffffff",   // Android bottom system bar
    "splash": {
      "background": "#ffffff",         // REQUIRED inside "splash"
      "logo": "assets/splash-logo.png" // optional centred logo
    },
    "safeArea": "inset",               // how the app handles the notch / status bar / home indicator:
                                       //  "inset"    (default) — the WebView is padded to the safe area
                                       //             and the strip is filled with statusBar.color.
                                       //             Any site looks right with no changes.
                                       //  "css-vars" — WebView goes edge-to-edge; --appcask-{top,right,
                                       //             bottom,left}-inset are injected for your CSS.
                                       //  "none"     — edge-to-edge, no help.
    "insetSelectors": ["header", ".chat-fab@bottom"]
                                       // only with "css-vars": get the edge-to-edge look WITHOUT editing
                                       // the site. Each entry offsets a fixed/sticky element by the inset:
                                       //   "header"          -> header { top: var(--appcask-top-inset) }
                                       //   ".chat-fab@bottom" -> .chat-fab { bottom: var(--appcask-bottom-inset) }
  },

  "navigation": { "mode": "single" },  // "single" = one WebView. "tabs" / "drawer" add native
                                       // chrome and are on the roadmap.

  "features": {
    "pullToRefresh": true,             // swipe down to reload (default false)
    "offlinePage": true,               // built-in screen when a load fails with no connection (default true)
    "fileAccess": true,                // wire up <input type=file> + camera capture (default true)
    "downloads": true,                 // route downloads to the OS download manager (default true)

    "externalBrowserAuth": [           // identity providers that BLOCK embedded WebViews.
      "accounts.google.com",           // Pages on these hosts open in the OS browser (Custom Tabs /
      "appleid.apple.com",             // ASWebAuthenticationSession) and the redirect back to an
      "login.microsoftonline.com"      // internalHost is caught and handed to the app.
    ],                                 // Leave these in if your site has social sign-in.

    "separateDocumentPatterns": [      // Paths that are their OWN page, not a route inside your
      "/admin", "/checkout/*"          // single-page app. They load via a native page load so your
    ],                                 // SPA history never ends up on a route it can't render.

    "deepLinks": {                     // Let https://<host>/<path> open the app directly.
      "host": "acme.example",          // Needs a /.well-known/assetlinks.json on that host —
      "pathPatterns": ["/p/*", "/order/*"]   //  `appcask doctor` checks it for you.
    },

    "push": { "provider": "fcm", "onTapUrlParam": "url" }   // roadmap
  },

  "bridge": {
    "allowedOrigins": ["https://acme.example"],  // origins allowed to call window.appcask at all.
                                                 // Defaults to https://<each internalHost>.

    "grants": [                                  // OPTIONAL. Omit -> every method allowed everywhere.
      { "capabilities": ["haptic", "share", "navigate", "openExternal", "setStatusBar", "getInfo"] },
      { "match": { "pathPrefix": "/account" }, "capabilities": ["secureStore.*"] },
      { "match": { "pathGlob": "/support/**" }, "capabilities": ["clipboard.read"] }
    ]
  }
}
```

## `bridge.grants` — scope the native bridge

The bridge is an API surface exposed to whatever HTML is in the WebView —
including third-party pages and injected content. `bridge.grants` limits which
capabilities each page can reach.

- **Omit `grants`** → every `window.appcask` method works on every allowed
  origin (the simple default).
- **Add `grants`** → the bridge is **default-deny**: a call is refused with
  `PERMISSION_DENIED` unless a grant whose `match` covers the current page lists
  that capability.

A grant's `capabilities` are method names, a namespace wildcard
(`secureStore.*`, `clipboard.*`), or `*`. A grant with no `match` applies to
every allowed origin; otherwise `match` narrows by `host` (exact, or `.acme.com`
for sub-domains), `pathPrefix`, and/or `pathGlob`.

Example above: session tokens (`secureStore`) are reachable only under
`/account`; clipboard *reading* only in the support flow; everything else is the
harmless always-on set.

`appcask doctor` prints the resolved grant table.

## Glob syntax (`separateDocumentPatterns`, `deepLinks.pathPatterns`)

- `*` — anything except `/` (one path segment)
- `**` — anything including `/`
- no wildcard — matches that exact path **and** anything under it
  (`/admin` matches `/admin` and `/admin/users/42`)

## Picking a `packageName`

Lowercase letters, digits, and dots; at least two parts. If you own
`acme.com`, use `com.acme.app`. If you don't own a domain, just invent
something unique like `app.acme.shop` — it never has to resolve. It **cannot
change** once the app is on a store.

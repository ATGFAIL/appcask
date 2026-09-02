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
    "safeArea": "css-vars"             // "css-vars" (default) injects --appcask-{top,right,bottom,left}-inset
                                       // so your CSS can pad around notches. "none" to opt out.
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
    "allowedOrigins": ["https://acme.example"]   // origins allowed to call window.appcask.
                                                 // Defaults to https://<each internalHost>.
  }
}
```

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

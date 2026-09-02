# @appcask/router

Pure URL-routing decisions for the appcask shell. **Zero dependencies.**

```ts
import { createRouter } from '@appcask/router';

const router = createRouter({
  internalHosts: ['acme.example', '.cdn.acme.example'], // leading . = and sub-domains
  externalBrowserAuth: ['accounts.google.com'],
  separateDocumentPatterns: ['/admin', '/checkout/*'],
});

router.route('https://accounts.google.com/o/oauth2/…', { currentUrl });
// -> { kind: 'external-auth', url: … }
```

`route()` returns one of:

| kind | the shell should… |
|---|---|
| `internal` | load in the main WebView |
| `separate-document` | load via native `loadUrl` (avoids the `location.*` bounce) |
| `external-auth` | open the OS auth browser, capture the redirect back |
| `external` | open a Custom Tab / in-app browser |
| `system` | hand to the OS (`tel:`, `mailto:`, `market:`, an app `intent:` …) |
| `block` | refuse (`about:blank`, `javascript:`, `data:`) |

Also exports `unwrapIntent()` (Android `intent://` → https) and `pathMatchesGlob()`.

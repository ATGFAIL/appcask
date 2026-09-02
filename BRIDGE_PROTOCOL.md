# The appcask bridge protocol

`window.appcask` (from [`@appcask/web`](./packages/web)) talks to the native
shell over a small, versioned message protocol. This document is the
specification; [`@appcask/bridge`](./packages/bridge) is the reference codec used
by both sides.

## Transport

| Direction | Mechanism |
|---|---|
| page → native | `window.ReactNativeWebView.postMessage(json)` |
| native → page (reply) | native evaluates `window.__appcaskReceive(json)` |
| native → page (event) | native evaluates `window.__appcaskEmit(json)` |

`json` is always a single JSON string with the envelope below. The native shell
also sets `window.__APPCASK__` (see [Environment](#environment)) **before the
page's first script runs**, so `isAppcask()` is synchronous and reliable.

## Envelope

Every message carries:

```jsonc
{ "channel": "appcask", "version": 1, "kind": "request" | "response" | "event" }
```

A message whose `channel` or `version` does not match is ignored — this keeps
appcask traffic distinct from anything else using `postMessage`.

### `request` (page → native)

```jsonc
{
  "channel": "appcask",
  "version": 1,
  "kind": "request",
  "id": "w1a2b3-4",          // /^[A-Za-z0-9_-]{1,96}$/, unique per call
  "method": "share",
  "params": { "url": "https://example.com" }
}
```

### `response` (native → page)

```jsonc
// success
{ "channel": "appcask", "version": 1, "kind": "response", "id": "w1a2b3-4", "ok": true, "result": { "shared": true } }

// failure
{ "channel": "appcask", "version": 1, "kind": "response", "id": "w1a2b3-4", "ok": false,
  "error": { "code": "PERMISSION_DENIED", "message": "user cancelled" } }
```

The page matches `id` to the pending call. **Every call has a client-side
timeout** (default 10 s); a native handler that never replies rejects the caller
with `TIMEOUT` rather than hanging forever.

### `event` (native → page)

```jsonc
{ "channel": "appcask", "version": 1, "kind": "event", "name": "network", "detail": { "online": false } }
```

Delivered to `window.addEventListener('appcask:network', …)` and to
`appcask.on('network', …)`.

## Error codes

| code | meaning |
|---|---|
| `INVALID_ARGUMENT` | a param was missing, the wrong type, or out of range |
| `NATIVE_UNAVAILABLE` | not running inside the shell (or the module is detached) |
| `TIMEOUT` | native did not answer within the caller's timeout |
| `NOT_SUPPORTED` | method known, not implemented on this OS / version |
| `PERMISSION_DENIED` | the user or OS denied a required permission |
| `ORIGIN_NOT_ALLOWED` | the calling origin is not in `bridge.allowedOrigins` |
| `INTERNAL` | unexpected native failure |

## Methods (v1)

| method | params | result |
|---|---|---|
| `getInfo` | – | `DeviceInfo` |
| `haptic` | `{ type }` | – |
| `share` | `{ title?, text?, url? }` | `{ shared }` |
| `navigate` | `{ url }` | – — native `loadUrl`, avoids the `location.*` bounce |
| `openExternal` | `{ url }` | – — Custom Tab / `SFSafariViewController` |
| `setStatusBar` | `{ style?, color? }` | – |
| `secureStore.get` | `{ key }` | `{ value }` |
| `secureStore.set` | `{ key, value }` | – |
| `secureStore.remove` | `{ key }` | – |
| `clipboard.read` | – | `{ text }` |
| `clipboard.write` | `{ text }` | – |

## Events (v1)

| name | detail |
|---|---|
| `context` | `{ insets, platform, online }` — on load and on change |
| `deeplink` | `{ url }` — a deep link arrived while running |
| `appstate` | `{ state: 'active' \| 'background' }` |
| `network` | `{ online }` |

## Environment

Set on `window` by the shell before first paint:

```ts
window.__APPCASK__ = {
  present: true,
  platform: 'android' | 'ios',
  shellVersion: string,   // the appcask version that built the app
  appVersion: string,     // identity.version from the config
  bridgeVersion: 1,
}
```

## Security

- The shell only accepts requests from an origin in `bridge.allowedOrigins`
  (defaults to `https://<each internalHost>`); others get `ORIGIN_NOT_ALLOWED`.
- `navigate` / `openExternal` params must be `https:` URLs.
- Injected payloads are escaped (`<`, U+2028, U+2029) so a value can never break
  out of the `<script>` used to deliver it.

## Versioning

`version` changes only on an **incompatible envelope** change. New methods and
events are additive within a version; a shell replies `NOT_SUPPORTED` for a
method it doesn't know.

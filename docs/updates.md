# Safe updates

Your app loads a live URL, so a bad web deploy reaches every install instantly.
`features.updates` gives you a health check, a kill switch, and automatic
fall-back to the last version that worked.

```jsonc
"features": {
  "updates": {
    "manifestUrl": "https://acme.example/.well-known/appcask.json",
    "healthCheck": {
      "selector": "#app-root",   // must appear for the load to count as "healthy"
      "timeoutMs": 12000,
      "maxFailures": 2           // consecutive bad loads before onUnhealthy fires
    },
    "onUnhealthy": "previous"    // "previous" | "offline-screen" | "retry"
  }
}
```

## The health check

After every page load the shell checks whether the page actually came up:

- with a `selector` — the element must appear within `timeoutMs`
- without one — the document must finish loading, with visible text, and no
  `5xx` on the main frame

A failure increments a counter (persisted). When it reaches `maxFailures`:

| `onUnhealthy` | what happens |
|---|---|
| `previous` *(default)* | reload the last URL that passed the health check. If there's nothing to fall back to, show the offline screen. |
| `offline-screen` | show the built-in "having trouble" screen with a Try-again button |
| `retry` | just keep reloading |

A healthy load resets the counter and records the URL as the new "last good".

## The manifest

`manifestUrl` points at a small JSON file **you host and control**. The shell
fetches it on launch (5 s timeout, then falls back to the last cached copy).
Every field is optional:

```jsonc
{
  "startUrl": "https://acme.example/",   // override where the app loads
  "blocked": true,                       // show the maintenance screen everywhere — a kill switch
  "message": "Back at 03:00 UTC.",       // shown on the maintenance / update screen
  "minShellVersion": "0.3.0"             // installs older than this get an "update required" screen
}
```

Use it to:

- **freeze** installs on a known-good URL (`startUrl`) while you fix `latest`
- **pull the cord** during an incident (`"blocked": true`) without shipping an
  app update
- **stage a rollout** — point `startUrl` at `?v=next` for a while, then flip it

## Checking it

`appcask doctor` prints the health-check settings and, if `manifestUrl` is set,
fetches it and reports whether it's valid JSON, currently `blocked`, or pins a
`startUrl` / `minShellVersion`.

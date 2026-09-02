# Push notifications (Android / FCM)

**Status: wired, not yet device-verified.** The plumbing is in place; you need a
Firebase project and a real device to test the round trip.

## Setup

1. Create a Firebase project, add an Android app with **your `packageName`**,
   download **`google-services.json`**.
2. Put `google-services.json` **next to your `appcask.config.json`**.
3. Add to the config:

```jsonc
"features": {
  "push": {
    "provider": "fcm",
    "onTapUrlParam": "url"   // the data key on the push payload holding the URL to open
  }
}
```

4. `appcask android` (or `appcask build android`) then:
   - copies `google-services.json` into the project
   - adds the `com.google.gms.google-services` Gradle plugin
   - adds `@react-native-firebase/app` + `@react-native-firebase/messaging`
   - swaps `src/shell/push.ts` for the real implementation

Without `google-services.json`, push stays a no-op and `appcask doctor` warns.

## From your website

```ts
import { appcask } from '@appcask/web';

if (await appcask.push.requestPermission()) {
  const token = await appcask.push.getToken();   // register it with your backend
}
```

Send a message with a `data` payload:

```json
{ "to": "<token>", "data": { "url": "https://acme.example/orders/123" } }
```

Tapping the notification opens the app at that URL (via native `loadUrl`, so
your SPA history stays sane). Foreground messages are delivered to the site's
own handler — the shell doesn't draw a banner.

## Not done

- APNs / iOS (needs the iOS shell)
- a built-in foreground banner
- topic subscription helpers

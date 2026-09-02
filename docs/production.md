# Shipping to a store

Run this before you build a release:

```bash
appcask doctor --production \
  --keystore /path/to/release.jks --keystore-pass "$KS_PASS" --keystore-alias upload
```

It checks the things that pass in a debug build on your desk and then fail for
real users or in store review.

## What it checks

### Signing

The template signs release builds with a **debug** keystore so the flow works
end to end. The Play Store rejects that. Before publishing:

```bash
keytool -genkeypair -v -keystore release.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then in the materialized project's `android/app/build.gradle`, point
`signingConfigs.release` at it (via a `keystore.properties` file you keep out of
git). `appcask doctor --production` finds `keystore.properties` automatically.

### assetlinks fingerprint

Android App Links only work if `https://<your-host>/.well-known/assetlinks.json`
lists the **SHA-256 of the key you actually sign with**. Get it:

```bash
keytool -list -v -keystore release.jks -alias upload | grep SHA256
```

and publish (note: for Play App Signing, use the fingerprint from the Play
Console, not your upload key):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.acme.app",
    "sha256_cert_fingerprints": ["AB:CD:…"]
  }
}]
```

If this is wrong, deep links **and the return leg of Google/Apple sign-in**
silently open the browser instead of the app. `doctor --production` compares
your local keystore's fingerprint against what's published.

### The live site

| check | why it matters |
|---|---|
| **CSP `script-src`** | On iOS the injected `window.__APPCASK__` bootstrap runs in the page context. A CSP without `'unsafe-inline'` / a nonce blocks it, so `isAppcask()` and the whole bridge fail. Add a nonce or relax it for the app host. |
| **mixed content** | The WebView blocks `http://` sub-resources on an `https://` page — images and scripts just don't load. |
| **viewport meta** | No `width=device-width` → the site renders at 980px, zoomed out. With `safeArea: "css-vars"` you also need `viewport-fit=cover`. |
| **cookies** | A session cookie without `Secure` is dropped over https in the WebView. `SameSite=Strict` on the session cookie means it isn't sent when the app returns from the OAuth Custom Tab — use `Lax`. |
| **UA sniffing** | Some sites serve a "get our app" interstitial or a stripped page to unknown User-Agents. |

### Store review

Apple **Guideline 4.2** rejects apps that are "a repackaged website" with no
native value. `doctor --production` counts the native capabilities your config
turns on (push, deep links, offline, native sign-in, native navigation,
pull-to-refresh) and warns if there are too few. Turn more on, or add a genuine
native feature, before submitting.

Google is more permissive but still expects a WebView-only app to be declared as
such, and `android.usesCleartextTraffic` must stay `false`.

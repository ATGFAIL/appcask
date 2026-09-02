# WebView gotchas, solved

Wrapping a website in a `WebView` is a five-line job. Shipping one that behaves
like an app is not — the hard parts are under-documented and mostly invisible
until a real user hits them. Here is each one and how appcask handles it.

---

## 1. Google / Apple / Microsoft sign-in is blocked

**Symptom.** The user taps "Sign in with Google", the page loads, and instead of
a login form they get `403: disallowed_useragent`.

**Why.** Since 2021, Google (and others) refuse OAuth requests from embedded
WebViews. The host app can read every keystroke in a WebView, so the providers
reject the whole user-agent class. A WebView also has its own empty cookie jar —
the user who is signed into Google in Chrome is a stranger here, and passkeys /
password managers don't autofill.

**Solution.** appcask routes any host in `features.externalBrowserAuth` to
**Custom Tabs** (Android) / **`ASWebAuthenticationSession`** (iOS) — a real
browser sheet with the real cookie jar, presented over the app. When the
provider redirects back to a URL on one of your `internalHosts`, appcask
intercepts it and resumes the WebView with the session established.

For the redirect to reach the app, that callback path must be a **verified App
Link** (`/.well-known/assetlinks.json`). `appcask doctor` checks it.

---

## 2. `location.href` navigation "bounces" out of the app

**Symptom.** A JS navigation (`location.href = …`, `location.assign`,
`router.push` in some setups) sometimes leaves the app on a blank screen or the
SPA's own "Not Found".

**Why.** `shouldOverrideUrlLoading` (Android) / `decidePolicyForNavigationAction`
(iOS) — the hook every wrapper uses to route URLs — **is not called for
script-initiated same-document navigations**. The WebView just does it. If that
URL is actually a separate document your SPA has no route for, the SPA renders
its fallback.

**Solution.** Two parts:

- `features.separateDocumentPatterns` lists paths that are their own document.
  appcask loads those with a **native page load**, not by letting the SPA push
  history.
- `window.appcask.navigate(url)` (from `@appcask/web`) always does a native load,
  so app code can navigate deliberately without tripping the bounce.

---

## 3. A native call hangs the app forever

**Symptom.** The app freezes with no error. A "get token from Keychain" or a
bridge round-trip never comes back.

**Why.** Native module promises have no built-in timeout. A stuck Keychain
provider, a permission dialog that never resolves, a lost message — the JS
`await` waits forever, and anything downstream of it is dead.

**Solution.** Every `window.appcask.*` call and every internal native call is
wrapped in its own `Promise.race` with a timeout. A slow handler rejects with
`BridgeError('TIMEOUT')`; the app stays responsive.

---

## 4. `<input type="file">` does nothing on Android

**Symptom.** Tapping a file input on Android — nothing happens. Downloads
triggered by a link are silently dropped.

**Why.** Android's `WebView` has no default file chooser; you must implement
`WebChromeClient.onShowFileChooser` yourself. Same for `onDownloadStart`.

**Solution.** `features.fileAccess` wires the native file picker plus camera
capture, and `features.downloads` sends download responses through the OS
`DownloadManager`.

---

## 5. The session is lost every time the app restarts

**Symptom.** Users are logged out on every cold start, on some devices only.

**Why.** Some vendor ROMs expose the Keychain / `EncryptedSharedPreferences`
API but fail the final encrypted write — silently. Your code thinks it saved.

**Solution.** appcask's secure store **reads the value back** after every write
and falls back to an app-private store if the encrypted one is broken, so a
successful login is never silently discarded.

---

## 6. Deep links open the browser instead of the app

**Symptom.** Tapping `https://yoursite.com/order/123` from an email opens
Chrome, not the app — even though the app is installed.

**Why.** Android App Links / iOS Universal Links only work if a machine-readable
file on your domain vouches for the app: `/.well-known/assetlinks.json`
(Android) and `/.well-known/apple-app-site-association` (iOS, served as
`application/json` with **no redirect**). One typo and it silently falls back to
the browser.

**Solution.** `appcask android` writes the intent filters from
`features.deepLinks`. `appcask doctor` fetches both files and tells you whether
they verify your package and are served correctly.

---

## 7. `about:blank` takes over the app

**Symptom.** A `target="_blank"` link or a stale back-stack entry replaces the
whole app with an unrecoverable blank surface.

**Why.** `about:blank` is a valid navigation the WebView will happily commit,
and it emits no useful load event to recover from.

**Solution.** appcask's router refuses `about:blank`, `javascript:`, and `data:`
navigations in the main frame outright.

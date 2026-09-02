# Troubleshooting

Known build and runtime issues, newest first. Paste any error into an AI
assistant with the prompt in [with-ai.md](./with-ai.md#4-fix-a-build-error).

## Build

### `mergeReleaseJavaResource` / `mergeDebugJavaResource` fails with a `VerifyException` (no message)

Your computer's locale uses a non-Gregorian calendar (e.g. Thai `th_TH` →
Buddhist year 2569), which overflows the date field in the APK's zip entries.

The template pins a Gregorian locale for the build JVM in
`android/gradle.properties`:

```properties
org.gradle.jvmargs=... -Duser.language=en -Duser.country=US
```

If you materialized before this fix, add that to the `org.gradle.jvmargs` line.

### `Unresolved reference 'currentActivity'` when compiling Kotlin

An older materialized project. `AppcaskNativeModule.kt` must use
`reactContext.currentActivity` (not the bare `currentActivity`). Re-run
`appcask android --force`, or pull the latest repo.

### `Unable to resolve module @react-native/virtualized-lists` (Metro)

Metro can't see a nested dependency. Make sure `metro.config.js` does **not**
set `resolver.disableHierarchicalLookup: true`. Materialized projects get a
clean config automatically — re-run `appcask android --force`.

### `Android SDK not found`

Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) to your SDK path, or create
`android/local.properties` in the materialized project:

```properties
sdk.dir=/absolute/path/to/Android/Sdk
```

### `'gradlew.bat' is not recognized` (Windows / Git Bash)

`react-native run-android` calls `gradlew.bat` without a `.\` prefix. Run the
task yourself instead:

```bash
cd android
./gradlew.bat :app:installDebug -PreactNativeArchitectures=x86_64
```

### The build works but the APK is huge / won't install on my phone

By default all CPU architectures are bundled. For one device:

```bash
cd <project>/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Runtime

### "Sign in with Google" shows `disallowed_useragent`

The auth host isn't in `features.externalBrowserAuth`. Add
`"accounts.google.com"` (and whichever other providers you use), then rebuild.

### After signing in, the app doesn't come back / stays on the login page

The provider redirects to a URL on your domain that must be a **verified App
Link**. Host `https://<your-host>/.well-known/assetlinks.json` with your app's
`packageName` and signing-cert SHA-256. Run `appcask doctor` — it checks this.

### A page inside my site opens in a browser instead of the app

That host isn't in `internalHosts`. Add every domain your site serves from
(apex + `www` + any CDN/subdomains that render pages).

### My SPA shows its own "Not Found" after some navigations

Those routes are separate documents, not SPA routes. List them in
`features.separateDocumentPatterns` (e.g. `["/admin", "/checkout/*"]`).

### The status bar / a fixed header sits under the notch

Use the injected CSS variables:

```css
header { padding-top: var(--appcask-top-inset, 0px); }
.bottom-bar { padding-bottom: var(--appcask-bottom-inset, 0px); }
```

(or set `theme.safeArea` to `"none"` if your site handles it another way.)

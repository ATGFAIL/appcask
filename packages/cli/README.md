# appcask

The CLI. Turn any website into a real Android app from one config file.

```bash
npx appcask init                    # scaffold appcask.config.json + assets/
npx appcask doctor [--production]   # validate config; --production also checks the live site
npx appcask assets                  # preview every generated icon + splash size
npx appcask android                 # materialize a buildable Android project
npx appcask build android           # materialize + npm install + Gradle -> APK
npx appcask build android --aab     # -> AAB for the Play Store
npx appcask run                     # debug build -> install on a device -> start Metro
```

## `appcask android [--out <dir>] [--force]`

Copies the React Native shell into `<slug>-android` (or `--out`) and rewrites it
for your config:

- `applicationId` / `namespace`, `versionName`, `versionCode` (derived from `x.y.z`)
- `app_name`, the App Links host (`@string/appcask_deeplink_host`)
- theme colours (`values/colors.xml`)
- the Kotlin package is renamed from `com.appcaskshell` to your `packageName`
- `assets/icon.png` → every `mipmap-*` density, round + adaptive icons, splash
  icon, `play-store-icon.png` (needs `icon.png`; optional `icon-foreground.png`,
  `splash-logo.png`)
- the `@appcask/*` packages are vendored into `appcask-packages/`
- `appcask.config.json` is copied in — re-run with `--force` after editing it

The output is a normal RN project: `cd <dir> && npm install && npm run android`.

## `appcask build android`

Runs `appcask android` (unless `--project <dir>` points at an existing one),
then `npm install` and `./gradlew assembleRelease` (or `bundleRelease` with
`--aab`, `assembleDebug` with `--debug`). Needs `ANDROID_HOME` (or
`android/local.properties`). The artifact is copied to `build/<slug>-<version>-release.apk`
next to your config.

The release build is self-contained and signed with the template **debug**
keystore — set a real keystore in `android/app/build.gradle` before publishing.

## `appcask doctor [--offline] [--production]`

Loads and validates `appcask.config.json`, then checks the start URL is
reachable, `assetlinks.json` verifies your package, `apple-app-site-association`
is served as JSON, and the icon / splash sources are the right size and opacity.

`--production` adds the pre-release checks — what actually breaks when the
wrapped site meets a real device and a store review:

- **signing** — is a real release keystore set up, or would the build ship
  debug-signed (Play Store rejects that)?
- **assetlinks fingerprint** — with `--keystore <path> --keystore-pass <pw>`,
  extracts the SHA-256 and checks it's actually in your published
  `assetlinks.json` (the #1 reason deep links and the OAuth return silently open
  the browser)
- **the live site** — CSP blocking the injected bootstrap script (iOS),
  `http://` mixed content, a missing/!device-width viewport, `viewport-fit`,
  cookies set without `Secure` or with `SameSite=Strict` (breaks the OAuth
  return), HSTS, and User-Agent sniffing / app interstitials
- **store review** — counts the native capabilities in your config and warns
  about Apple Guideline 4.2 (a repackaged website gets rejected)

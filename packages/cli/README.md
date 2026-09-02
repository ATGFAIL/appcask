# appcask

The CLI. Turn any website into a real Android & iOS app from one config file.

```bash
npx appcask init            # scaffold appcask.config.json + assets/
npx appcask doctor          # validate config, check assetlinks.json / AASA / icon sizes
npx appcask assets          # generate every icon + splash size          (coming soon)
npx appcask android         # materialize the Android project            (coming soon)
npx appcask build android   # signed APK / AAB                           (coming soon)
```

## `appcask doctor`

Loads `appcask.config.json`, validates it against the schema, then checks:

- `startUrl` host is in `internalHosts`
- `externalBrowserAuth` is set (or warns that Google/Apple sign-in will break)
- `assets/icon.png` and the splash logo exist, are square, big enough, and (for
  the icon) opaque
- `startUrl` is reachable
- `https://<deepLinks.host>/.well-known/assetlinks.json` verifies your package
  and has a fingerprint
- `apple-app-site-association` is present and served as JSON

`--offline` skips the network checks. Exit code is non-zero only on a real error.

# my-app — build your app without installing anything

This folder is a **starter you edit in the browser**. GitHub builds the APK for
you. No terminal, no Android Studio.

## Steps

1. **Fork this repo** (top-right "Fork" button on the repo page).

2. **Edit `my-app/appcask.config.json`** — click it in your fork, click the
   pencil ✏️, change:
   - `identity.appName` — the name under the icon
   - `identity.packageName` — a unique id like `com.yourname.yourapp`
     (lowercase, reverse of a domain; just make one up if unsure)
   - `startUrl` — your website, must start with `https://`
   - `internalHosts` — every domain that should stay *inside* the app
   - `features.externalBrowserAuth` — leave the Google/Apple entries if your
     site has "Sign in with Google / Apple"

   Then "Commit changes".

3. **(Optional) add an icon** — upload a 1024×1024 PNG named `icon.png` into
   `my-app/assets/` ("Add file" → "Upload files"). Skip this and you get a
   plain placeholder icon.

4. **Run the build** — go to the **Actions** tab of your fork → **Build my app**
   → **Run workflow**. Wait ~10 minutes.

5. **Download the APK** — open the finished run, scroll to **Artifacts**,
   download `my-app-apk`. Unzip it, copy the `.apk` to an Android phone, tap it
   to install (you may need to allow "install from unknown sources").

## Notes

- The APK is signed with a **test key** — fine for installing on your own
  phones, **not** accepted by the Play Store. Publishing needs your own signing
  key (see the main README).
- Editing the config and re-running the workflow gives you a fresh APK.
- iOS is not supported yet.

## What the config can do

See [`../docs/config.md`](../docs/config.md) for every option (deep links,
native theming, separate-document routing, …), or ask an AI assistant with the
prompt in [`../docs/with-ai.md`](../docs/with-ai.md).

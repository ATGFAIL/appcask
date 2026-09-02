# Getting started

You need: a website that works on a phone browser, served over `https://`.

There are two ways to get an APK. The first needs no software on your computer.

---

## The no-terminal way

GitHub builds the app for you in the cloud. ~10 minutes, no Android Studio.

### 1. Fork this repo

Open the repo page and click **Fork** (top right). You now have your own copy.

### 2. Edit one file

In your fork, open **`my-app/appcask.config.json`** and click the pencil ✏️.

```jsonc
{
  "$schema": "https://appcask.dev/schema/v1.json",
  "identity": {
    "appName": "Acme",                      // shown under the icon
    "packageName": "com.acme.app",          // a unique id — lowercase, dotted
    "version": "1.0.0"
  },
  "startUrl": "https://acme.example",        // your site, must be https
  "internalHosts": ["acme.example"],         // domains that stay inside the app
  "theme": {
    "statusBar": { "style": "dark", "color": "#ffffff" },
    "splash": { "background": "#ffffff" }
  },
  "features": {
    "pullToRefresh": true,
    "offlinePage": true,
    "externalBrowserAuth": ["accounts.google.com", "appleid.apple.com"]
  }
}
```

Every option is explained in [config.md](./config.md). Click **Commit changes**.

### 3. (Optional) add your icon

"Add file" → "Upload files" → drop a **1024×1024 PNG** named `icon.png` into
`my-app/assets/`. Skip this and you get a plain placeholder.

### 4. Run the build

**Actions** tab → **Build my app** → **Run workflow**. Wait for the green check.

> First time only: GitHub may ask you to enable Actions on your fork — click the
> green button.

### 5. Get the APK

Open the finished run → **Artifacts** → download **my-app-apk** → unzip →
copy the `.apk` to an Android phone → tap it → allow "install from unknown
sources" if asked.

To change something: edit the config again, run the workflow again.

---

## The local way

Faster once set up, and lets you run the app on an emulator while you tweak it.

### Prerequisites

| tool | version | get it |
|---|---|---|
| Node.js | 20+ | <https://nodejs.org> |
| pnpm | 9+ | `npm install -g pnpm` |
| Java (JDK) | **17** | <https://adoptium.net> |
| Android Studio | latest | <https://developer.android.com/studio> — install it, open it once, let it download the SDK |

Set `ANDROID_HOME`:

- **macOS / Linux**: add to `~/.zshrc` or `~/.bashrc`:
  `export ANDROID_HOME="$HOME/Library/Android/sdk"` (macOS) or `"$HOME/Android/Sdk"` (Linux)
- **Windows**: it's usually `%LOCALAPPDATA%\Android\Sdk`

Not sure how to do any of this? See [with-ai.md](./with-ai.md) — it has a prompt
that gets an AI assistant to install it with you, one step at a time.

### Build

```bash
git clone https://github.com/ATGFAIL/appcask.git
cd appcask
pnpm install
pnpm -r --filter "./packages/*" build

# your project — anywhere, doesn't have to be inside the repo
mkdir my-shop && cd my-shop
npx --prefix ../appcask appcask init      # answer 3 questions
#   ...or copy appcask/my-app/appcask.config.json here and edit it
# drop assets/icon.png (1024×1024)

node ../appcask/packages/cli/dist/cli.js doctor
node ../appcask/packages/cli/dist/cli.js build android
```

The APK lands at `my-shop/build/<name>-<version>-release.apk`.

```bash
adb install -r build/*.apk        # onto a connected phone / emulator
```

### Run it live while you edit

```bash
node ../appcask/packages/cli/dist/cli.js android        # materialize the project
cd <name>-android
npm install
npx react-native start                                  # keep this running
# another terminal:
npm run android                                         # or: cd android && ./gradlew installDebug
```

Windows / Git Bash: `npm run android` can fail because it calls `gradlew.bat`
without `.\` — run `cd android && ./gradlew.bat :app:installDebug` yourself.

---

## Checklist once it's on a phone

- [ ] your site loads full-screen
- [ ] links to *other* sites open a browser sheet, not inside the app
- [ ] Android back button goes back in history, then exits
- [ ] airplane mode → the offline screen appears, "Try again" works
- [ ] "Sign in with Google/Apple" opens a real browser and returns you signed in
- [ ] `<input type="file">` opens the file picker

If any of these misbehave, see [troubleshooting.md](./troubleshooting.md).

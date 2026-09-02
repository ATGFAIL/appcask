# Doing it with an AI assistant

If you're not comfortable with a terminal, paste these into an AI assistant
(Claude, ChatGPT, Gemini, …) and follow along. Fill in the `<…>` parts first.

Each prompt is self-contained — start a fresh chat for each one.

---

## 1. Set up my computer

> I want to build an Android app from a website using an open-source tool called
> **appcask** (`https://github.com/ATGFAIL/appcask`). I'm on **<Windows / macOS>**
> and I'm **not a developer** — explain every command before I run it and wait
> for me to confirm each step worked before moving on.
>
> I need: **Node.js 20+**, **pnpm**, **JDK 17**, and the **Android SDK**
> (via Android Studio or the command-line tools). At the end, help me set the
> `ANDROID_HOME` environment variable and verify everything with `node -v`,
> `pnpm -v`, `java -version`, and `adb --version`.
>
> Go one step at a time.

---

## 2. Write my config

> I'm using **appcask** to turn my website into an Android app. Here is the
> config format:
>
> ```
> <paste the contents of docs/config.md here>
> ```
>
> My website is **<https://your-site.com>**. It <does / does not> have
> "Sign in with Google". Other domains my site loads: **<none / list them>**.
> I want the app named **<App Name>**.
>
> Give me a complete `appcask.config.json` for it. Explain each choice in one
> line. Pick a sensible `packageName` for me.

---

## 3. Build the app (drive the terminal with me)

> Help me build an Android APK with **appcask**
> (`https://github.com/ATGFAIL/appcask`). I've already installed Node, pnpm,
> JDK 17 and the Android SDK, and `ANDROID_HOME` is set.
>
> I have my `appcask.config.json` ready (I'll paste it). Walk me through, one
> command at a time, waiting for me to paste the output back:
>
> 1. clone the repo and build its packages
>    (`pnpm install` then `pnpm -r --filter "./packages/*" build`)
> 2. put my config in a new folder with an `assets/` subfolder
> 3. run `node <repo>/packages/cli/dist/cli.js doctor`
> 4. run `node <repo>/packages/cli/dist/cli.js build android`
> 5. install the resulting APK onto my phone with `adb install -r`
>
> If a step errors, help me fix it before continuing.
>
> My config:
> ```
> <paste your appcask.config.json>
> ```

---

## 4. Fix a build error

> I'm building an Android app with **appcask**
> (`https://github.com/ATGFAIL/appcask`) — a React Native 0.82 WebView shell.
> The build failed. Here is the exact command I ran and the full output:
>
> ```
> <paste the command and ALL of the output>
> ```
>
> My machine: **<Windows / macOS / Linux>**, `java -version` says **<…>**.
>
> Tell me the root cause and the exact fix. Check the repo's
> `docs/troubleshooting.md` first — several known issues are listed there.

---

## 5. Make an app icon

> I need a **1024×1024 opaque PNG** app icon for my website
> **<https://your-site.com>** / brand **<name>**. The brand colours are
> **<#hex, #hex>**. Design a simple, recognisable icon that reads well at small
> sizes (no thin lines, no text). Give it to me as a downloadable PNG at exactly
> 1024×1024 with no transparency.

*(Most image-capable assistants can do this. Save it as `assets/icon.png`.)*

---

## 6. (For developers) make my website talk to the app

> My website will be wrapped as an app with **appcask**. Add the
> **`@appcask/web`** client (`npm i @appcask/web`) so the site can call native
> features when it's running inside the app and fall back to Web APIs in a
> normal browser.
>
> Specifically: use `appcask.share()` for my share buttons, trigger
> `appcask.haptic('success')` on <some action>, and read the safe-area insets
> from the `--appcask-*-inset` CSS variables so my fixed header/footer clear the
> notch. The API reference is at
> `https://github.com/ATGFAIL/appcask/blob/main/packages/web/README.md` and the
> protocol is in `BRIDGE_PROTOCOL.md`.

---

## Tips

- Paste **whole** error messages, not a screenshot of the last line.
- Tell the assistant your OS and that you're not a developer — it changes how
  much it explains.
- If an assistant suggests something that contradicts the repo's docs, trust
  the docs and say so.

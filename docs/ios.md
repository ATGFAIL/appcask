# iOS

**Status: partial.** The React Native shell, the config, the router, and the
bridge protocol are cross-platform and run on iOS as-is. What's missing is the
last mile of the **native** side, which needs a Mac with Xcode.

## What works today

`appcask ios` materializes the project and patches:

- the bundle id, display name, and version (`project.pbxproj`, `Info.plist`)
- `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`

The JS shell (`WebShell`, routing, `window.appcask`, offline, updates, tabs)
works unchanged.

## What you finish in Xcode

The Swift bridge module is written but not yet wired into the Xcode target:

```bash
cd <project> && npm install
cd ios && pod install
open ios/<Name>.xcworkspace
```

In Xcode:

1. Add `ios/AppcaskShell/AppcaskNative.swift` and `AppcaskNative.mm` to the app
   target (drag them in, or File → Add Files).
2. Build Settings → **Objective-C Bridging Header** →
   `AppcaskShell/AppcaskShell-Bridging-Header.h` (Xcode will offer to create one
   the first time you add a Swift file — point it at the existing header).
3. For the OAuth handoff, add a **Custom URL scheme** or an **Associated Domain**
   for your callback host (`applinks:<your-host>`), matching `features.deepLinks`.
4. `npx react-native run-ios`.

`AppcaskNative.swift` implements `haptic`, `share`, `openExternal`
(`SFSafariViewController`), `secureGet/Set/Remove` (Keychain, verify-after-write),
`clipboard`, `osVersion`, and `startAuthSession` (`ASWebAuthenticationSession`).
It mirrors `AppcaskNativeModule.kt` — read that for the intended behaviour.

## Not started

- `theme.safeArea` on iOS (the RN `SafeAreaView` covers most of it; notch /
  home-indicator colour needs a check)
- App Store `PrivacyInfo.xcprivacy` entries for the APIs used
- push (APNs)

Contributions welcome — this is the biggest open item.

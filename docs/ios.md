# iOS

**Status: compiles green on CI, not device-verified.** The shell, config, router, and bridge
protocol are cross-platform. The Swift native module is written and
`appcask ios` wires it into the Xcode project — but it hasn't run on a device
yet.

## You don't need a Mac

`appcask ios` patches everything a Mac would need you to click through in Xcode:

- bundle id, display name, version
- `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`
- `AppcaskNative.swift` + `AppcaskNative.mm` added to the app target
- the Objective-C bridging header set

The **Build iOS** GitHub Action runs `pod install` + `xcodebuild` on a hosted
macOS runner (free for public repos) on every push — it currently passes, so the
Swift compiles. What's left is running it on an actual device.

## Getting an app you can install

An unsigned build won't run on a real iPhone. To install one you need an **Apple
Developer account** ($99/yr) — then, still with no Mac:

1. In the Action, add signing: an `.p12` certificate + a provisioning profile as
   repo secrets, and switch `xcodebuild` to `archive` + `-exportArchive`.
2. Upload the `.ipa` to **TestFlight** (`xcrun altool` / `notarytool` from the
   runner), or distribute ad-hoc.

The workflow in `.github/workflows/ios.yml` is the build-only version; extending
it for signing is a small change once you have the certificate.

## The Swift module

`AppcaskNative.swift` mirrors `AppcaskNativeModule.kt`: `haptic`, `share`,
`openExternal` (`SFSafariViewController`), Keychain secure store
(verify-after-write), `clipboard`, `osVersion`, and `startAuthSession`
(`ASWebAuthenticationSession`).

## Still to do

- Run it on a device and fix what breaks.
- OAuth / Universal Links: add an **Associated Domain**
  (`applinks:<your-host>`) — this is an Xcode entitlement `appcask ios` does not
  set yet.
- `theme.safeArea` on iOS (RN `SafeAreaView` covers most of it).
- `PrivacyInfo.xcprivacy` entries for the APIs used.
- Push / APNs.

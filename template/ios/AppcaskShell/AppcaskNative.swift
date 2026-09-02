import Foundation
import UIKit
import Security
import SafariServices
import AuthenticationServices

/**
 * iOS half of the appcask bridge — the counterpart of AppcaskNativeModule.kt.
 * Every method maps to one entry in @appcask/bridge's method map. The JS side
 * wraps each call in its own timeout.
 *
 * NOTE: written against the Android module's contract; not yet compiled on a
 * Mac. Finish + verify before shipping iOS.
 */
@objc(AppcaskNative)
class AppcaskNative: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  private var authSession: ASWebAuthenticationSession?
  private var authPresentationAnchor = AppcaskAuthAnchor()

  // MARK: haptics

  @objc(haptic:resolver:rejecter:)
  func haptic(_ type: String, resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      switch type {
      case "success", "warning", "error":
        let g = UINotificationFeedbackGenerator()
        g.notificationOccurred(type == "success" ? .success : type == "warning" ? .warning : .error)
      case "selection":
        UISelectionFeedbackGenerator().selectionChanged()
      case "heavy":
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
      case "medium":
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
      default:
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
      }
      resolve(nil)
    }
  }

  // MARK: share

  @objc(share:resolver:rejecter:)
  func share(_ payload: [String: Any], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    var items: [Any] = []
    if let text = payload["text"] as? String { items.append(text) }
    if let urlString = payload["url"] as? String, let url = URL(string: urlString) { items.append(url) }
    if items.isEmpty, let title = payload["title"] as? String { items.append(title) }
    guard !items.isEmpty else { return reject("INVALID_ARGUMENT", "nothing to share", nil) }

    DispatchQueue.main.async {
      guard let root = Self.topViewController() else { return reject("NATIVE_UNAVAILABLE", "no view controller", nil) }
      let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
      vc.completionWithItemsHandler = { _, completed, _, _ in resolve(completed) }
      vc.popoverPresentationController?.sourceView = root.view
      root.present(vc, animated: true)
    }
  }

  // MARK: external browser

  @objc(openExternal:resolver:rejecter:)
  func openExternal(_ urlString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: urlString), url.scheme == "https" else {
      return reject("INVALID_ARGUMENT", "not an https URL", nil)
    }
    DispatchQueue.main.async {
      guard let root = Self.topViewController() else { return reject("NATIVE_UNAVAILABLE", "no view controller", nil) }
      let safari = SFSafariViewController(url: url)
      root.present(safari, animated: true)
      resolve(nil)
    }
  }

  // MARK: status bar

  @objc(setStatusBar:color:resolver:rejecter:)
  func setStatusBar(_ style: String?, color: String?, resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    // iOS status-bar style is driven by the view controller; the RN shell also
    // sets <StatusBar>. This is a best-effort hook.
    resolve(nil)
  }

  // MARK: secure store (Keychain)

  @objc(secureGet:resolver:rejecter:)
  func secureGet(_ key: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    var query = keychainQuery(key)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound { return resolve(nil) }
    guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
      return reject("INTERNAL", "keychain read failed (\(status))", nil)
    }
    resolve(value)
  }

  @objc(secureSet:value:resolver:rejecter:)
  func secureSet(_ key: String, value: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let data = Data(value.utf8)
    var query = keychainQuery(key)
    SecItemDelete(query as CFDictionary)
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else { return reject("INTERNAL", "keychain write failed (\(status))", nil) }
    // read back — parity with the Android verify-after-write
    var check = keychainQuery(key)
    check[kSecReturnData as String] = true
    var item: CFTypeRef?
    if SecItemCopyMatching(check as CFDictionary, &item) == errSecSuccess, (item as? Data) == data {
      resolve(nil)
    } else {
      reject("INTERNAL", "keychain did not persist the value", nil)
    }
  }

  @objc(secureRemove:resolver:rejecter:)
  func secureRemove(_ key: String, resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    SecItemDelete(keychainQuery(key) as CFDictionary)
    resolve(nil)
  }

  private func keychainQuery(_ key: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "appcask.secure",
      kSecAttrAccount as String: key,
    ]
  }

  // MARK: clipboard

  @objc(clipboardRead:rejecter:)
  func clipboardRead(_ resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async { resolve(UIPasteboard.general.string ?? "") }
  }

  @objc(clipboardWrite:resolver:rejecter:)
  func clipboardWrite(_ text: String, resolve: @escaping RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      UIPasteboard.general.string = text
      resolve(nil)
    }
  }

  // MARK: os version

  @objc(osVersion:rejecter:)
  func osVersion(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    resolve(UIDevice.current.systemVersion)
  }

  // MARK: auth session

  @objc(startAuthSession:callbackHosts:resolver:rejecter:)
  func startAuthSession(_ urlString: String, callbackHosts: [String], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: urlString) else { return reject("INVALID_ARGUMENT", "bad url", nil) }
    DispatchQueue.main.async {
      let session = ASWebAuthenticationSession(url: url, callbackURLScheme: nil) { callbackURL, error in
        if let callbackURL = callbackURL, let host = callbackURL.host,
           callbackHosts.contains(where: { $0 == host || ($0.hasPrefix(".") && host.hasSuffix($0)) }) {
          resolve(["redirectUrl": callbackURL.absoluteString])
        } else {
          reject("PERMISSION_DENIED", error?.localizedDescription ?? "auth cancelled", error)
        }
      }
      session.presentationContextProvider = self.authPresentationAnchor
      session.prefersEphemeralWebBrowserSession = false
      self.authSession = session
      session.start()
    }
  }

  // MARK: helpers

  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
    var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}

final class AppcaskAuthAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
    return scene?.windows.first ?? ASPresentationAnchor()
  }
}

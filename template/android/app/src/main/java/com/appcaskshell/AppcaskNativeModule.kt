package com.appcaskshell

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.view.HapticFeedbackConstants
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.FragmentActivity
import com.google.android.play.core.review.ReviewManagerFactory
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Native half of the appcask bridge. Every method maps to one entry in
 * `@appcask/bridge`'s method map. The JS side wraps each call in its own
 * timeout, so a handler that never resolves can't hang the WebView.
 */
class AppcaskNativeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "AppcaskNative"

  private var pendingAuth: Promise? = null
  private var authCallbackHosts: List<String> = emptyList()
  /** A deep link / share received before JS was listening — drained by getInitialDeepLink(). */
  private var pendingDeepLink: String? = null

  init {
    AuthRedirectBus.register { uri -> onAuthRedirect(uri) }
  }

  @ReactMethod
  fun getInitialDeepLink(promise: Promise) {
    val url = pendingDeepLink
    pendingDeepLink = null
    promise.resolve(url)
  }

  // --- haptics ---
  @ReactMethod
  fun haptic(type: String, promise: Promise) {
    runOnUi {
      val view = reactContext.currentActivity?.window?.decorView
      val constant = when (type) {
        "success", "light", "selection" -> HapticFeedbackConstants.KEYBOARD_TAP
        "warning", "medium" -> HapticFeedbackConstants.LONG_PRESS
        "error", "heavy" -> HapticFeedbackConstants.LONG_PRESS
        else -> HapticFeedbackConstants.KEYBOARD_TAP
      }
      view?.performHapticFeedback(constant)
      promise.resolve(null)
    }
  }

  // --- share ---
  @ReactMethod
  fun share(payload: ReadableMap, promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.reject("NATIVE_UNAVAILABLE", "no activity")
    val text = listOfNotNull(
      payload.getStringOrNull("text"),
      payload.getStringOrNull("url"),
    ).joinToString(" ").ifEmpty { payload.getStringOrNull("title") ?: "" }

    val send = Intent(Intent.ACTION_SEND).apply {
      this.type = "text/plain"
      payload.getStringOrNull("title")?.let { putExtra(Intent.EXTRA_SUBJECT, it) }
      putExtra(Intent.EXTRA_TEXT, text)
    }
    runOnUi {
      activity.startActivity(Intent.createChooser(send, null))
      promise.resolve(true)
    }
  }

  // --- external browser ---
  @ReactMethod
  fun openExternal(url: String, promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.reject("NATIVE_UNAVAILABLE", "no activity")
    runOnUi {
      try {
        CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity, Uri.parse(url))
        promise.resolve(null)
      } catch (e: Exception) {
        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        promise.resolve(null)
      }
    }
  }

  // --- status bar ---
  @ReactMethod
  fun setStatusBar(style: String?, color: String?, promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.reject("NATIVE_UNAVAILABLE", "no activity")
    runOnUi {
      val window = activity.window
      color?.let {
        try {
          window.statusBarColor = Color.parseColor(it)
        } catch (_: IllegalArgumentException) {
        }
      }
      style?.let {
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = it == "dark"
      }
      promise.resolve(null)
    }
  }

  // --- secure store (EncryptedSharedPreferences) ---
  private val securePrefs by lazy {
    val key = MasterKey.Builder(reactContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
    EncryptedSharedPreferences.create(
      reactContext,
      "appcask_secure",
      key,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
  }

  @ReactMethod
  fun secureGet(key: String, promise: Promise) {
    try {
      promise.resolve(securePrefs.getString(key, null))
    } catch (e: Exception) {
      promise.reject("INTERNAL", e.message, e)
    }
  }

  @ReactMethod
  fun secureSet(key: String, value: String, promise: Promise) {
    try {
      securePrefs.edit().putString(key, value).apply()
      // Read back before claiming success — some ROMs expose the API but fail the write.
      if (securePrefs.getString(key, null) != value) {
        promise.reject("INTERNAL", "secure store did not persist the value")
      } else {
        promise.resolve(null)
      }
    } catch (e: Exception) {
      promise.reject("INTERNAL", e.message, e)
    }
  }

  @ReactMethod
  fun secureRemove(key: String, promise: Promise) {
    try {
      securePrefs.edit().remove(key).apply()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INTERNAL", e.message, e)
    }
  }

  // --- clipboard ---
  @ReactMethod
  fun clipboardRead(promise: Promise) {
    runOnUi {
      val cm = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val text = cm.primaryClip?.getItemAt(0)?.coerceToText(reactContext)?.toString() ?: ""
      promise.resolve(text)
    }
  }

  @ReactMethod
  fun clipboardWrite(text: String, promise: Promise) {
    runOnUi {
      val cm = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      cm.setPrimaryClip(ClipData.newPlainText("appcask", text))
      promise.resolve(null)
    }
  }

  // --- os version ---
  @ReactMethod
  fun osVersion(promise: Promise) {
    promise.resolve(Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString())
  }

  // --- biometrics ---
  @ReactMethod
  fun biometricAuthenticate(reason: String?, promise: Promise) {
    val activity = reactContext.currentActivity as? FragmentActivity
      ?: return promise.reject("NATIVE_UNAVAILABLE", "no FragmentActivity")
    val allowed = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
    if (BiometricManager.from(reactContext).canAuthenticate(allowed) != BiometricManager.BIOMETRIC_SUCCESS) {
      return promise.reject("NOT_SUPPORTED", "no biometrics or device credential enrolled")
    }
    runOnUi {
      var settled = false
      val prompt = BiometricPrompt(
        activity,
        androidx.core.content.ContextCompat.getMainExecutor(activity),
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            if (!settled) { settled = true; promise.resolve(Arguments.createMap().apply { putBoolean("authenticated", true) }) }
          }
          override fun onAuthenticationError(code: Int, msg: CharSequence) {
            if (!settled) { settled = true; promise.resolve(Arguments.createMap().apply { putBoolean("authenticated", false) }) }
          }
        },
      )
      prompt.authenticate(
        BiometricPrompt.PromptInfo.Builder()
          .setTitle(reason ?: "Unlock")
          .setAllowedAuthenticators(allowed)
          .build(),
      )
    }
  }

  // --- in-app review ---
  @ReactMethod
  fun reviewRequest(promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.reject("NATIVE_UNAVAILABLE", "no activity")
    val manager = ReviewManagerFactory.create(reactContext)
    manager.requestReviewFlow().addOnCompleteListener { task ->
      if (task.isSuccessful) {
        manager.launchReviewFlow(activity, task.result).addOnCompleteListener { promise.resolve(null) }
      } else {
        // Play decides not to show it — that's a normal outcome, not an error.
        promise.resolve(null)
      }
    }
  }

  /**
   * Open `url` in a Custom Tab and resolve once the browser redirects to a
   * verified App Link on one of `callbackHosts` (see `assetlinks.json`).
   * MainActivity forwards the intent through [AuthRedirectBus].
   */
  @ReactMethod
  fun startAuthSession(url: String, callbackHosts: com.facebook.react.bridge.ReadableArray, promise: Promise) {
    val activity = reactContext.currentActivity ?: return promise.reject("NATIVE_UNAVAILABLE", "no activity")
    pendingAuth?.reject("INTERNAL", "superseded by a new auth session")
    pendingAuth = promise
    authCallbackHosts = (0 until callbackHosts.size()).mapNotNull { callbackHosts.getString(it) }
    runOnUi {
      CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(activity, Uri.parse(url))
    }
  }

  /**
   * An incoming ACTION_VIEW / ACTION_SEND url. If it's the redirect for an
   * in-flight auth session, resolve that promise; otherwise treat it as a deep
   * link / share and hand it to the WebView.
   */
  private fun onAuthRedirect(uri: Uri) {
    val host = uri.host
    val pending = pendingAuth
    if (pending != null && host != null &&
      authCallbackHosts.any { it == host || (it.startsWith(".") && host.endsWith(it)) }
    ) {
      pendingAuth = null
      pending.resolve(Arguments.createMap().apply { putString("redirectUrl", uri.toString()) })
      return
    }
    pendingDeepLink = uri.toString()
    emit("appcask:deeplink", Arguments.createMap().apply { putString("url", uri.toString()) })
  }

  private fun runOnUi(block: () -> Unit) {
    val activity = reactContext.currentActivity
    if (activity != null) activity.runOnUiThread(block) else block()
  }

  private fun emit(name: String, params: com.facebook.react.bridge.WritableMap) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, params)
  }
}

private fun ReadableMap.getStringOrNull(key: String): String? =
  if (hasKey(key) && !isNull(key)) getString(key) else null

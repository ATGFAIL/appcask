package com.appcaskshell

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "AppcaskShell"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(savedInstanceState)
    applyNavigationBar()
    handleIntent(intent)
  }

  /** theme.navigationBarColor from the config (written into colors.xml by `appcask android`). */
  private fun applyNavigationBar() {
    val color = ContextCompat.getColor(this, R.color.appcask_navigation_bar)
    window.navigationBarColor = color
    val light = ((0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255) > 0.5
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = light
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntent(intent)
  }

  /**
   * An App Link (an auth redirect, or a deep link tap) or a share to the app —
   * hand the URL to [AuthRedirectBus], which routes it to the auth promise or
   * the WebView.
   */
  private fun handleIntent(intent: Intent?) {
    intent ?: return
    when (intent.action) {
      Intent.ACTION_VIEW -> {
        val data = intent.data ?: return
        if (data.scheme == "https" || data.scheme == "http") AuthRedirectBus.publish(data)
      }
      Intent.ACTION_SEND -> {
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
        val base = getString(R.string.appcask_share_url)
        if (base.isNotEmpty()) AuthRedirectBus.publish(Uri.parse(base + Uri.encode(text)))
      }
    }
  }
}

package com.appcaskshell

import android.content.Intent
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
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
    forwardAuthRedirect(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    forwardAuthRedirect(intent)
  }

  /** A verified App Link that came back from a Custom Tab auth flow. */
  private fun forwardAuthRedirect(intent: Intent?) {
    val data = intent?.data ?: return
    if (intent.action == Intent.ACTION_VIEW && (data.scheme == "https" || data.scheme == "http")) {
      AuthRedirectBus.publish(data)
    }
  }
}

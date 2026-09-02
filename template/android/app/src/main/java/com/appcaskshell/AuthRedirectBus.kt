package com.appcaskshell

import android.net.Uri

/**
 * A tiny hand-off point between [MainActivity] (which receives the App Link
 * intent when a Custom Tab redirects back) and [AppcaskNativeModule] (which has
 * the pending `startAuthSession` promise).
 */
object AuthRedirectBus {
  private var listener: ((Uri) -> Unit)? = null
  private var buffered: Uri? = null

  fun register(l: (Uri) -> Unit) {
    listener = l
    buffered?.let { l(it); buffered = null }
  }

  fun publish(uri: Uri) {
    val l = listener
    if (l != null) l(uri) else buffered = uri
  }
}

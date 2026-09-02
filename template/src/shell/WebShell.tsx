import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebViewBase from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview/lib/WebView';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewErrorEvent,
  ShouldStartLoadRequest,
} from 'react-native-webview/lib/WebViewTypes';
import { createRouter } from '@appcask/router';
import { config } from '../config';
import { native } from './native';
import { handleBridgeMessage, type DispatchContext } from './bridgeDispatch';
import { beforeContentScript, contextScript, deliverScript } from './injection';
import { OfflineScreen } from './OfflineScreen';

const UA_TAG = `appcask/${config.identity.version}`;

/** The imperative handle react-native-webview forwards through its ref. */
interface WebViewHandle {
  goBack(): void;
  goForward(): void;
  reload(): void;
  stopLoading(): void;
  injectJavaScript(script: string): void;
}

const WebView = WebViewBase as unknown as React.ForwardRefExoticComponent<
  WebViewProps & React.RefAttributes<WebViewHandle>
>;

export function WebShell(): React.JSX.Element {
  const webRef = useRef<WebViewHandle>(null);
  const insets = useSafeAreaInsets();
  const [sourceUrl, setSourceUrl] = useState(config.startUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [offline, setOffline] = useState(false);
  const currentUrlRef = useRef(config.startUrl);

  const router = useMemo(
    () =>
      createRouter({
        internalHosts: config.internalHosts,
        externalBrowserAuth: config.features.externalBrowserAuth,
        separateDocumentPatterns: config.features.separateDocumentPatterns,
      }),
    [],
  );

  /** Force a native load of `url` (used for `navigate` and separate documents). */
  const loadNative = useCallback((url: string) => {
    currentUrlRef.current = url;
    setSourceUrl(url);
    setReloadKey((k) => k + 1);
  }, []);

  const dispatchContext = useMemo<DispatchContext>(
    () => ({
      platform: 'android',
      online: !offline,
      insets: {
        top: Math.round(insets.top),
        right: Math.round(insets.right),
        bottom: Math.round(insets.bottom),
        left: Math.round(insets.left),
      },
      requestNavigate: loadNative,
    }),
    [offline, insets, loadNative],
  );

  // --- Android hardware back ---
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // --- push safe-area insets into the page whenever they change ---
  useEffect(() => {
    webRef.current?.injectJavaScript(contextScript(dispatchContext));
  }, [dispatchContext]);

  const onShouldStartLoadWithRequest = useCallback(
    (req: ShouldStartLoadRequest): boolean => {
      const decision = router.route(req.url, { currentUrl: currentUrlRef.current });
      switch (decision.kind) {
        case 'internal':
          currentUrlRef.current = decision.url;
          return true;
        case 'separate-document':
          loadNative(decision.url);
          return false;
        case 'external':
          void native.openExternal(decision.url).catch(() => Linking.openURL(decision.url));
          return false;
        case 'external-auth':
          void startAuth(decision.url);
          return false;
        case 'system':
          void Linking.openURL(decision.url).catch(() => undefined);
          return false;
        case 'block':
          return false;
      }
    },
    [router, loadNative],
  );

  const startAuth = useCallback(
    async (url: string) => {
      try {
        const { redirectUrl } = await native.startAuthSession(url, config.internalHosts);
        loadNative(redirectUrl);
      } catch {
        // user cancelled or the session failed — stay where we are
      }
    },
    [loadNative],
  );

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const response = await handleBridgeMessage(event.nativeEvent.data, dispatchContext);
      if (response) webRef.current?.injectJavaScript(deliverScript(response));
    },
    [dispatchContext],
  );

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    if (nav.url) currentUrlRef.current = nav.url;
  }, []);

  const retry = useCallback(() => {
    setOffline(false);
    setReloadKey((k) => k + 1);
  }, []);

  if (offline && config.features.offlinePage) {
    return <OfflineScreen onRetry={retry} />;
  }

  return (
    <View style={styles.fill}>
      <WebView
        key={reloadKey}
        ref={webRef}
        source={{ uri: sourceUrl }}
        applicationNameForUserAgent={UA_TAG}
        originWhitelist={['https://*', 'http://*']}
        injectedJavaScriptBeforeContentLoaded={beforeContentScript()}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={() => webRef.current?.injectJavaScript(contextScript(dispatchContext))}
        pullToRefreshEnabled={config.features.pullToRefresh}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        domStorageEnabled
        javaScriptEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess={config.features.fileAccess}
        onError={(e: WebViewErrorEvent) => {
          if (isNetworkError(e.nativeEvent.code)) setOffline(true);
        }}
      />
    </View>
  );
}

/** Android WebView error codes for "no / lost connection". */
function isNetworkError(code: number): boolean {
  // -2 ERR_NAME_NOT_RESOLVED-ish, -6 CONNECTION_REFUSED, -7 TIMED_OUT, -8 CONNECTION_ABORTED, -1009/-1004 iOS
  return [-2, -6, -7, -8, -1009, -1004, -1001].includes(code);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

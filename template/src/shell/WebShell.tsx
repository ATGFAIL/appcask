import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WebViewBase from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview/lib/WebView';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  ShouldStartLoadRequest,
} from 'react-native-webview/lib/WebViewTypes';
import { createRouter } from '@appcask/router';
import { manifestGate, reduceHealth, type HealthState, INITIAL_HEALTH } from '@appcask/config/updates';
import { config } from '../config';
import { native } from './native';
import { handleBridgeMessage, type DispatchContext } from './bridgeDispatch';
import { beforeContentScript, contextScript, deliverScript } from './injection';
import { OfflineScreen } from './OfflineScreen';
import { TabBar, activeTabIndex } from './TabBar';
import { SHELL_VERSION } from './version';
import {
  updatesEnabled,
  loadManifest,
  loadHealthState,
  saveHealthState,
  healthCheckScript,
  parseHealthMessage,
} from './updates';

const UA_TAG = `appcask/${config.identity.version}`;
const HEALTH_POLICY = {
  maxFailures: config.features.updates?.healthCheck.maxFailures ?? 2,
  onUnhealthy: config.features.updates?.onUnhealthy ?? 'previous',
} as const;

interface Maintenance {
  title: string;
  body: string;
}

const TABS = config.navigation.mode === 'tabs' ? config.navigation.tabs : [];

/**
 * `inset` (the default): the WebView sits inside the safe area, so any website
 * looks right with no changes — its header can't hide under the status bar, its
 * fixed footer can't hide under the home indicator. `css-vars` / `none` let the
 * WebView go edge-to-edge (the site handles insets via the injected variables).
 */
const SAFE_AREA_MODE = config.theme.safeArea;
/** The colour behind the inset strips (status bar + home indicator). */
const INSET_BG =
  config.theme.statusBar.color ?? config.theme.splash?.background ?? '#000000';

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
  const [booting, setBooting] = useState(updatesEnabled);
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  const [currentUrl, setCurrentUrl] = useState(config.startUrl);
  const currentUrlRef = useRef(config.startUrl);
  const healthRef = useRef<HealthState>(INITIAL_HEALTH);

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

  // --- updates: manifest gate + last-good state, before the first load ---
  useEffect(() => {
    if (!updatesEnabled) return;
    let cancelled = false;
    void (async () => {
      const [manifest, health] = await Promise.all([loadManifest(), loadHealthState()]);
      if (cancelled) return;
      healthRef.current = health;
      const gate = manifestGate(manifest, SHELL_VERSION);
      if (gate.stop) {
        setMaintenance({
          title: gate.reason === 'shell-outdated' ? 'Update required' : `${config.identity.appName} is updating`,
          body: gate.message ?? 'Please check back in a few minutes.',
        });
      } else if (manifest?.startUrl && manifest.startUrl !== currentUrlRef.current) {
        currentUrlRef.current = manifest.startUrl;
        setSourceUrl(manifest.startUrl);
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Fold a load outcome into the health state and act on it. */
  const handleHealth = useCallback(
    (healthy: boolean) => {
      if (!updatesEnabled) return;
      const { state, action } = reduceHealth(
        healthRef.current,
        { healthy, url: currentUrlRef.current },
        HEALTH_POLICY,
      );
      healthRef.current = state;
      saveHealthState(state);
      switch (action.type) {
        case 'retry':
          setReloadKey((k) => k + 1);
          break;
        case 'load':
          loadNative(action.url);
          break;
        case 'offline-screen':
          setMaintenance({
            title: `${config.identity.appName} is having trouble`,
            body: "We couldn't load the latest version. Please try again shortly.",
          });
          break;
        case 'none':
          break;
      }
    },
    [loadNative],
  );

  const dispatchContext = useMemo<DispatchContext>(
    () => ({
      platform: 'android',
      online: !offline,
      // In `inset` mode the WebView is already padded, so from the page's point
      // of view there is no unsafe area — report zeros.
      insets:
        SAFE_AREA_MODE === 'inset'
          ? { top: 0, right: 0, bottom: 0, left: 0 }
          : {
              top: Math.round(insets.top),
              right: Math.round(insets.right),
              bottom: Math.round(insets.bottom),
              left: Math.round(insets.left),
            },
      currentUrl: config.startUrl,
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
      const data = event.nativeEvent.data;
      const health = parseHealthMessage(data);
      if (health) {
        handleHealth(health.healthy);
        return;
      }
      // currentUrl must be the live value — capability grants are per-page.
      const response = await handleBridgeMessage(data, {
        ...dispatchContext,
        currentUrl: currentUrlRef.current,
      });
      if (response) webRef.current?.injectJavaScript(deliverScript(response));
    },
    [dispatchContext, handleHealth],
  );

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    if (nav.url) {
      currentUrlRef.current = nav.url;
      if (TABS.length > 0) setCurrentUrl(nav.url);
    }
  }, []);

  const retry = useCallback(() => {
    setOffline(false);
    setMaintenance(null);
    healthRef.current = INITIAL_HEALTH;
    currentUrlRef.current = config.startUrl;
    setSourceUrl(config.startUrl);
    setReloadKey((k) => k + 1);
  }, []);

  if (maintenance) {
    return <OfflineScreen title={maintenance.title} body={maintenance.body} onRetry={retry} />;
  }
  if (offline && config.features.offlinePage) {
    return <OfflineScreen onRetry={retry} />;
  }
  if (booting) {
    return <View style={[styles.fill, { backgroundColor: INSET_BG }]} />;
  }

  const Frame = SAFE_AREA_MODE === 'inset' ? SafeAreaView : View;
  const frameStyle =
    SAFE_AREA_MODE === 'inset' ? [styles.fill, { backgroundColor: INSET_BG }] : styles.fill;

  return (
    <Frame style={frameStyle}>
      <WebView
        key={reloadKey}
        ref={webRef}
        style={styles.fill}
        source={{ uri: sourceUrl }}
        applicationNameForUserAgent={UA_TAG}
        originWhitelist={['https://*', 'http://*']}
        injectedJavaScriptBeforeContentLoaded={beforeContentScript()}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={() => {
          webRef.current?.injectJavaScript(contextScript(dispatchContext));
          if (updatesEnabled) webRef.current?.injectJavaScript(healthCheckScript());
        }}
        onHttpError={(e: WebViewHttpErrorEvent) => {
          // a 5xx on the main frame means the deploy itself is broken
          if (updatesEnabled && e.nativeEvent.statusCode >= 500) handleHealth(false);
        }}
        pullToRefreshEnabled={config.features.pullToRefresh}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        domStorageEnabled
        javaScriptEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess={config.features.fileAccess}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        {...(config.features.downloads
          ? { downloadingMessage: `Downloading…`, lackPermissionToDownloadMessage: 'Storage permission is needed to download.' }
          : {})}
        onError={(e: WebViewErrorEvent) => {
          if (isNetworkError(e.nativeEvent.code)) setOffline(true);
        }}
      />
      {TABS.length > 0 ? (
        <TabBar
          tabs={TABS}
          activeIndex={activeTabIndex(TABS, currentUrl)}
          onSelect={(i) => {
            const tab = TABS[i];
            if (tab) loadNative(tab.url);
          }}
        />
      ) : null}
    </Frame>
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

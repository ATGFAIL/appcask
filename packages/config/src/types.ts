/**
 * The shape of `appcask.config.json`.
 *
 * `schema.json` (JSON Schema draft 2020-12) is the runtime source of truth; this
 * type mirrors it. `config.test.ts` asserts the two agree on the example configs.
 */

/** Hex colour: `#rgb`, `#rrggbb`, or `#rrggbbaa`. */
export type Color = string;

export interface AppcaskIdentity {
  /** Human-readable name shown under the launcher icon. */
  appName: string;
  /** Reverse-DNS application id, e.g. `com.acme.app`. Also the iOS bundle id. */
  packageName: string;
  /** Marketing version `x.y.z`. */
  version: string;
}

export interface StatusBarTheme {
  /** Colour of the status-bar text/icons. Default `dark`. */
  style?: 'light' | 'dark';
  /** Status-bar background (Android). */
  color?: Color;
}

export interface SplashTheme {
  background: Color;
  /** Path (relative to the config file) to a centred splash logo. */
  logo?: string;
}

export interface AppcaskTheme {
  statusBar?: StatusBarTheme;
  /** Android system navigation-bar colour. */
  navigationBarColor?: Color;
  splash?: SplashTheme;
  /**
   * `css-vars` injects `--appcask-{top,right,bottom,left}-inset` so the site can
   * pad around notches. Default `css-vars`.
   */
  safeArea?: 'css-vars' | 'none';
}

export interface NavigationTab {
  label: string;
  url: string;
  /** Named icon or path to a 24dp glyph. */
  icon?: string;
}

export interface AppcaskNavigation {
  /** `single` = one WebView. `tabs` / `drawer` add native chrome (roadmap). Default `single`. */
  mode?: 'single' | 'tabs' | 'drawer';
  /** Used when `mode` is `tabs`. */
  tabs?: NavigationTab[];
}

export interface DeepLinkConfig {
  host: string;
  /** Verified App Link / Universal Link paths that open the app. Default `["/*"]`. */
  pathPatterns?: string[];
}

export interface PushConfig {
  /** `fcm` covers Android now; APNs arrives with the iOS shell. */
  provider: 'fcm';
  /** Data key on the push payload holding the URL to open on tap. Default `url`. */
  onTapUrlParam?: string;
}

export interface AppcaskFeatures {
  pullToRefresh?: boolean;
  /** Show a built-in offline screen when a load fails with no connection. Default `true`. */
  offlinePage?: boolean;
  /** Wire up `<input type=file>`, camera capture, and the native file picker. Default `true`. */
  fileAccess?: boolean;
  /** Route download responses through the OS download manager. Default `true`. */
  downloads?: boolean;
  /** Register the app as an Android share target that forwards to a URL (roadmap). */
  shareTarget?: boolean;
  /** Expose `window.appcask.review.request()` (roadmap). */
  appReviewPrompt?: boolean;
  /**
   * Domains whose pages must open in Custom Tabs / `ASWebAuthenticationSession`
   * instead of the WebView. The redirect back to an `internalHost` is
   * intercepted and the session handed to the WebView.
   */
  externalBrowserAuth?: string[];
  /**
   * Path globs that are their own document, not a route inside your SPA. These
   * load via native `loadUrl` to avoid the `location.*` navigation bounce.
   */
  separateDocumentPatterns?: string[];
  deepLinks?: DeepLinkConfig;
  /** Push notifications (roadmap). */
  push?: PushConfig;
}

export interface BridgeConfig {
  /**
   * Origins allowed to call `window.appcask`. Defaults to
   * `https://<each internalHost>`.
   */
  allowedOrigins?: string[];
}

export interface AppcaskConfig {
  $schema?: string;
  identity: AppcaskIdentity;
  /** The first URL the WebView loads. Must be https. */
  startUrl: string;
  /**
   * Hosts that stay inside the WebView. Anything else opens in an external
   * browser tab. Defaults to the host of `startUrl`.
   */
  internalHosts?: string[];
  theme?: AppcaskTheme;
  navigation?: AppcaskNavigation;
  features?: AppcaskFeatures;
  bridge?: BridgeConfig;
}

/**
 * `AppcaskConfig` with every optional field the loader fills in made required.
 * This is what the shell and CLI consume after `resolveConfig()`.
 */
export interface ResolvedAppcaskConfig {
  identity: Required<AppcaskIdentity>;
  startUrl: string;
  internalHosts: string[];
  theme: {
    statusBar: { style: 'light' | 'dark'; color?: Color };
    navigationBarColor?: Color;
    splash?: SplashTheme;
    safeArea: 'css-vars' | 'none';
  };
  navigation: { mode: 'single' | 'tabs' | 'drawer'; tabs: NavigationTab[] };
  features: {
    pullToRefresh: boolean;
    offlinePage: boolean;
    fileAccess: boolean;
    downloads: boolean;
    shareTarget: boolean;
    appReviewPrompt: boolean;
    externalBrowserAuth: string[];
    separateDocumentPatterns: string[];
    deepLinks?: Required<DeepLinkConfig>;
    push?: Required<PushConfig>;
  };
  bridge: { allowedOrigins: string[] };
}

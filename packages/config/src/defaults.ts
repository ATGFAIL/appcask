import type { AppcaskConfig, ResolvedAppcaskConfig } from './types.js';

/**
 * Fill in every default, producing the fully-populated config the shell and CLI
 * consume. **Pure** — no validation, no Node built-ins — so the React Native
 * shell can call it directly (`@appcask/config/defaults`).
 *
 * `resolveConfig` (in the package root) validates first, then calls this.
 *
 * Derived defaults:
 *  - `internalHosts`         -> `[host(startUrl)]`
 *  - `bridge.allowedOrigins` -> `https://<host>` for each internal host
 *  - `theme.statusBar.style` -> `dark`
 *  - `theme.safeArea`        -> `inset`
 *  - `navigation.mode`       -> `single`
 */
export function applyDefaults(config: AppcaskConfig): ResolvedAppcaskConfig {
  const startHost = new URL(config.startUrl).host;
  const internalHosts =
    config.internalHosts && config.internalHosts.length > 0
      ? [...config.internalHosts]
      : [startHost];

  const allowedOrigins =
    config.bridge?.allowedOrigins && config.bridge.allowedOrigins.length > 0
      ? [...config.bridge.allowedOrigins]
      : internalHosts.map((h) => `https://${h}`);

  const f = config.features ?? {};

  return {
    identity: { ...config.identity },
    startUrl: config.startUrl,
    internalHosts,
    theme: {
      statusBar: {
        style: config.theme?.statusBar?.style ?? 'dark',
        color: config.theme?.statusBar?.color,
      },
      navigationBarColor: config.theme?.navigationBarColor,
      splash: config.theme?.splash,
      safeArea: config.theme?.safeArea ?? 'inset',
      insetSelectors: config.theme?.insetSelectors ?? [],
    },
    navigation: {
      mode: config.navigation?.mode ?? 'single',
      tabs: config.navigation?.tabs ?? [],
    },
    features: {
      pullToRefresh: f.pullToRefresh ?? false,
      offlinePage: f.offlinePage ?? true,
      fileAccess: f.fileAccess ?? true,
      downloads: f.downloads ?? true,
      shareTarget: f.shareTarget ?? false,
      appReviewPrompt: f.appReviewPrompt ?? false,
      externalBrowserAuth: f.externalBrowserAuth ?? [],
      separateDocumentPatterns: f.separateDocumentPatterns ?? [],
      deepLinks: f.deepLinks
        ? { host: f.deepLinks.host, pathPatterns: f.deepLinks.pathPatterns ?? ['/*'] }
        : undefined,
      push: f.push
        ? { provider: f.push.provider, onTapUrlParam: f.push.onTapUrlParam ?? 'url' }
        : undefined,
    },
    bridge: {
      allowedOrigins,
      grants: config.bridge?.grants ? config.bridge.grants.map((g) => ({ ...g })) : null,
    },
  };
}

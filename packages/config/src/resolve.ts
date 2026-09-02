import { assertConfig } from './validate.js';
import type { AppcaskConfig, ResolvedAppcaskConfig } from './types.js';

/**
 * Validate `data` and fill in every default, producing the fully-populated
 * config the shell and CLI consume.
 *
 * Derived defaults:
 *  - `internalHosts`      -> `[host(startUrl)]`
 *  - `bridge.allowedOrigins` -> `https://<host>` for each internal host
 *  - `theme.statusBar.style` -> `dark`
 *  - `theme.safeArea`     -> `css-vars`
 *  - `navigation.mode`    -> `single`
 *  - feature flags        -> see below
 */
export function resolveConfig(data: unknown): ResolvedAppcaskConfig {
  assertConfig(data);
  const config: AppcaskConfig = data;

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
      safeArea: config.theme?.safeArea ?? 'css-vars',
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
    bridge: { allowedOrigins },
  };
}

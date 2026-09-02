import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { loadProject } from '../project.js';
import { readPngInfo } from '../png.js';
import { parseManifest } from '@appcask/config/updates';
import { runProductionChecks } from '../production.js';
import { CliError, dim, fail, heading, info, line, ok, warn } from '../ui.js';

interface DoctorFlags {
  /** Skip network checks (start URL, assetlinks, AASA). */
  offline: boolean;
  /** Also run the pre-release / store-review checks. */
  production?: boolean;
  keystore?: string;
  keystorePass?: string;
  keystoreAlias?: string;
}

interface Tally {
  fail: number;
  warn: number;
}

export async function doctorCommand(flags: DoctorFlags): Promise<void> {
  const project = await loadProject();
  const { config, root, configPath } = project;
  const tally: Tally = { fail: 0, warn: 0 };
  const T = {
    ok,
    warn: (m: string) => {
      tally.warn += 1;
      warn(m);
    },
    fail: (m: string) => {
      tally.fail += 1;
      fail(m);
    },
    info,
  };

  heading(`appcask doctor  ${dim(configPath)}`);

  // --- config ---
  heading('Config');
  T.ok(`schema valid — ${config.identity.appName} (${config.identity.packageName}) v${config.identity.version}`);
  const startHost = new URL(config.startUrl).host;
  if (config.internalHosts.includes(startHost)) {
    T.ok(`startUrl host "${startHost}" is in internalHosts`);
  } else {
    T.warn(`startUrl host "${startHost}" is not in internalHosts — the first page would open in an external browser`);
  }
  T.info(
    `User-Agent: ${config.features.userAgent}` +
      (config.features.userAgent === 'chrome' ? ' — embedded Google / Apple sign-in works' : ''),
  );
  if (config.features.externalBrowserAuth.length > 0) {
    T.info(`OS auth browser for: ${config.features.externalBrowserAuth.join(', ')}`);
    if (!config.features.deepLinks) {
      T.warn(
        'externalBrowserAuth is set but there is no deepLinks host — the OS browser has no verified ' +
          'App Link to return through, so sign-in ends up in the browser, not the app. Either host ' +
          'assetlinks.json + set features.deepLinks, or drop externalBrowserAuth (the default clean ' +
          'User-Agent handles Google / Apple).',
      );
    }
  }
  if (config.features.separateDocumentPatterns.length > 0) {
    T.info(`native loadUrl for paths: ${config.features.separateDocumentPatterns.join(', ')}`);
  }
  if (config.features.updates) {
    const u = config.features.updates;
    const hc = u.healthCheck.selector ? `wait for "${u.healthCheck.selector}"` : 'page loads without a 5xx';
    T.info(`updates: health check = ${hc}, after ${u.healthCheck.maxFailures} fails → ${u.onUnhealthy}`);
  }
  if (config.features.push) {
    if (existsSync(join(root, 'google-services.json'))) {
      T.ok('push: FCM configured (google-services.json present)');
    } else {
      T.warn('features.push is set but google-services.json is not next to the config — push stays disabled');
    }
  }

  // --- bridge capabilities ---
  if (config.bridge.grants === null) {
    T.info('bridge: every window.appcask method is allowed on every allowed origin (no bridge.grants)');
  } else if (config.bridge.grants.length === 0) {
    T.warn('bridge.grants is empty — every window.appcask call will be refused with PERMISSION_DENIED');
  } else {
    T.ok(`bridge: default-deny, ${config.bridge.grants.length} grant(s)`);
    for (const g of config.bridge.grants) {
      const scope = g.match
        ? [g.match.host, g.match.pathPrefix && `path ${g.match.pathPrefix}*`, g.match.pathGlob && `path ${g.match.pathGlob}`]
            .filter(Boolean)
            .join(' ')
        : 'everywhere';
      T.info(`  ${scope}: ${g.capabilities.join(', ')}`);
    }
  }

  // --- assets ---
  heading('Assets');
  await checkImage(T, root, config.theme.splash?.logo, { label: 'splash logo', min: 128, square: true });
  const iconPath = join(root, 'assets', 'icon.png');
  if (existsSync(iconPath)) {
    await checkImage(T, root, 'assets/icon.png', { label: 'app icon', min: 1024, square: true, opaque: true });
  } else {
    T.warn('assets/icon.png not found — "appcask assets" needs a 1024×1024 source icon');
  }

  // --- network ---
  if (flags.offline) {
    heading('Network');
    T.info('skipped (--offline)');
  } else {
    heading('Network');
    await checkReachable(T, config.startUrl);
    if (config.features.updates?.manifestUrl) {
      await checkManifest(T, config.features.updates.manifestUrl);
    }
    if (config.features.deepLinks) {
      await checkAssetLinks(T, config.features.deepLinks.host, config.identity.packageName);
      await checkAasa(T, config.features.deepLinks.host);
    } else {
      T.info('no deepLinks configured — skipping App Links / Universal Links checks');
    }
  }

  // --- production ---
  if (flags.production) {
    if (flags.offline) {
      heading('Production');
      T.warn('--production needs network — skipped because --offline was passed');
    } else {
      await runProductionChecks(T, config, root, {
        keystore: flags.keystore,
        keystorePass: flags.keystorePass,
        keystoreAlias: flags.keystoreAlias,
      });
    }
  }

  // --- summary ---
  heading('Summary');
  if (tally.fail === 0 && tally.warn === 0) {
    line(`  ${dim('everything looks good.')}`);
  } else {
    line(`  ${tally.fail} error(s), ${tally.warn} warning(s)`);
  }
  if (tally.fail > 0) {
    throw new CliError(`doctor found ${tally.fail} problem(s) that will break the build`);
  }
}

interface Checks {
  ok: (m: string) => void;
  warn: (m: string) => void;
  fail: (m: string) => void;
  info: (m: string) => void;
}

async function checkImage(
  T: Checks,
  root: string,
  relPath: string | undefined,
  opts: { label: string; min: number; square?: boolean; opaque?: boolean },
): Promise<void> {
  if (!relPath) {
    T.info(`no ${opts.label} configured`);
    return;
  }
  const abs = join(root, relPath);
  if (!existsSync(abs)) {
    T.warn(`${opts.label}: ${relPath} not found yet — add it before "appcask assets"`);
    return;
  }
  try {
    const png = await readPngInfo(abs);
    const issues: string[] = [];
    if (opts.square && png.width !== png.height) issues.push(`not square (${png.width}×${png.height})`);
    if (png.width < opts.min) issues.push(`smaller than ${opts.min}px (${png.width}px)`);
    if (opts.opaque && png.hasAlpha) issues.push('has transparency (store icons must be opaque)');
    if (issues.length === 0) {
      T.ok(`${opts.label}: ${relPath} (${png.width}×${png.height})`);
    } else {
      T.warn(`${opts.label}: ${relPath} — ${issues.join(', ')}`);
    }
  } catch (err) {
    T.fail(`${opts.label}: ${relPath} — ${(err as Error).message}`);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkReachable(T: Checks, url: string): Promise<void> {
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow' });
    if (res.ok) T.ok(`startUrl reachable (${res.status})`);
    else T.warn(`startUrl returned ${res.status}`);
  } catch (err) {
    T.warn(`could not reach startUrl: ${(err as Error).message}`);
  }
}

async function checkManifest(T: Checks, url: string): Promise<void> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      T.warn(`update manifest ${url} returned ${res.status} — the app falls back to the config startUrl (fine)`);
      return;
    }
    const manifest = parseManifest(await res.text());
    if (!manifest) {
      T.fail(`update manifest ${url} is not valid JSON — fix it or the app can't read it`);
      return;
    }
    if (manifest.blocked) {
      T.warn('update manifest has "blocked": true — every install currently shows the maintenance screen');
    }
    const bits = [
      manifest.startUrl && `startUrl → ${manifest.startUrl}`,
      manifest.minShellVersion && `minShellVersion ${manifest.minShellVersion}`,
      manifest.message && 'has a message',
    ].filter(Boolean);
    T.ok(`update manifest reachable${bits.length ? ` (${bits.join(', ')})` : ''}`);
  } catch (err) {
    T.warn(`update manifest check failed: ${(err as Error).message}`);
  }
}

async function checkAssetLinks(T: Checks, host: string, packageName: string): Promise<void> {
  const url = `https://${host}/.well-known/assetlinks.json`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      T.warn(`assetlinks.json: ${url} returned ${res.status} — Android App Links will fall back to the browser`);
      return;
    }
    const body = (await res.json()) as Array<{ target?: { package_name?: string; sha256_cert_fingerprints?: string[] } }>;
    const entry = Array.isArray(body)
      ? body.find((e) => e.target?.package_name === packageName)
      : undefined;
    if (!entry) {
      T.warn(`assetlinks.json found but has no entry for package "${packageName}"`);
    } else if (!entry.target?.sha256_cert_fingerprints?.length) {
      T.warn(`assetlinks.json entry for "${packageName}" has no sha256_cert_fingerprints`);
    } else {
      T.ok(`assetlinks.json verifies "${packageName}" (${entry.target.sha256_cert_fingerprints.length} fingerprint(s))`);
    }
  } catch (err) {
    T.warn(`assetlinks.json check failed: ${(err as Error).message}`);
  }
}

async function checkAasa(T: Checks, host: string): Promise<void> {
  const url = `https://${host}/.well-known/apple-app-site-association`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      T.info(`apple-app-site-association: ${res.status} (needed for iOS Universal Links, added with the iOS shell)`);
      return;
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('text/html')) {
      T.warn('apple-app-site-association is served as text/html — Apple requires application/json and no redirects');
    } else {
      T.ok('apple-app-site-association present');
    }
  } catch (err) {
    T.info(`apple-app-site-association check skipped: ${(err as Error).message}`);
  }
}

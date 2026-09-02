import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedAppcaskConfig } from '@appcask/config';
import { dim, heading } from './ui.js';

export interface Checks {
  ok: (m: string) => void;
  warn: (m: string) => void;
  fail: (m: string) => void;
  info: (m: string) => void;
}

export interface ProductionFlags {
  keystore?: string;
  keystorePass?: string;
  keystoreAlias?: string;
}

interface Page {
  status: number;
  headers: Headers;
  html: string;
}

/**
 * The `--production` checks: what actually breaks when a wrapped site meets a
 * real device and a store review. No device needed.
 */
export async function runProductionChecks(
  T: Checks,
  config: ResolvedAppcaskConfig,
  root: string,
  flags: ProductionFlags,
): Promise<void> {
  heading('Production — signing');
  const keystore = await resolveKeystore(root, flags);
  const fingerprints = keystore ? await readFingerprints(T, keystore) : [];
  if (!keystore) {
    T.warn(
      'no release keystore found — `appcask build android` signs with the template DEBUG key, ' +
        'which the Play Store rejects. Generate one (keytool -genkeypair) and set signingConfigs.release.',
    );
  } else {
    T.ok(`release keystore: ${dim(keystore.storeFile)}${fingerprints.length ? ` (SHA-256 ×${fingerprints.length})` : ''}`);
  }

  if (config.features.deepLinks) {
    await checkAssetLinksFingerprint(T, config.features.deepLinks.host, config.identity.packageName, fingerprints);
  }

  heading('Production — the live site');
  const page = await fetchPage(config.startUrl);
  if (!page) {
    T.fail(`could not fetch ${config.startUrl} — a release build would show a blank screen`);
  } else {
    checkCsp(T, page.headers);
    checkMixedContent(T, page.html);
    checkViewport(T, page.html, config.theme.safeArea);
    checkCookies(T, page.headers);
    checkHsts(T, page.headers);
    await checkUaSniffing(T, config.startUrl, page);
  }

  heading('Production — store review');
  storePolicyNotes(T, config);
}

// --- signing ---

interface Keystore {
  storeFile: string;
  storePassword?: string;
  keyAlias?: string;
}

async function resolveKeystore(root: string, flags: ProductionFlags): Promise<Keystore | null> {
  if (flags.keystore && existsSync(flags.keystore)) {
    return { storeFile: flags.keystore, storePassword: flags.keystorePass, keyAlias: flags.keystoreAlias };
  }
  for (const dir of [root, ...findAndroidDirs(root)]) {
    const propsPath = join(dir, 'keystore.properties');
    if (!existsSync(propsPath)) continue;
    const props = parseProps(await readFile(propsPath, 'utf8'));
    const storeFile = props.storeFile ?? props['storeFile'];
    if (storeFile) {
      const abs = storeFile.startsWith('/') ? storeFile : join(dir, storeFile);
      return {
        storeFile: abs,
        storePassword: props.storePassword,
        keyAlias: props.keyAlias,
      };
    }
  }
  return null;
}

function findAndroidDirs(root: string): string[] {
  const out: string[] = [];
  try {
    for (const name of readdirSync(root)) {
      if (name.endsWith('-android')) out.push(join(root, name, 'android', 'app'), join(root, name, 'android'));
    }
  } catch {
    /* ignore */
  }
  return out;
}

function parseProps(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const eq = l.indexOf('=');
    if (eq > 0) out[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
  }
  return out;
}

async function readFingerprints(T: Checks, ks: Keystore): Promise<string[]> {
  if (!ks.storePassword) {
    T.info('keystore password not provided — pass --keystore-pass to verify the assetlinks fingerprint');
    return [];
  }
  const args = ['-list', '-v', '-keystore', ks.storeFile, '-storepass', ks.storePassword];
  if (ks.keyAlias) args.push('-alias', ks.keyAlias);
  const out = await runCapture('keytool', args);
  if (out === null) {
    T.info('keytool not found on PATH (part of the JDK) — skipping fingerprint verification');
    return [];
  }
  return [...out.matchAll(/SHA-?256:\s*([0-9A-F:]{95})/gi)].map((m) => (m[1] as string).toUpperCase());
}

async function checkAssetLinksFingerprint(
  T: Checks,
  host: string,
  packageName: string,
  localFingerprints: string[],
): Promise<void> {
  const url = `https://${host}/.well-known/assetlinks.json`;
  const res = await fetchQuiet(url);
  if (!res || !res.ok) {
    T.warn(`assetlinks.json unreachable (${res?.status ?? 'no response'}) — deep links open the browser, not the app`);
    return;
  }
  let published: string[] = [];
  try {
    const body = (await res.json()) as Array<{ target?: { package_name?: string; sha256_cert_fingerprints?: string[] } }>;
    published = (body.find((e) => e.target?.package_name === packageName)?.target?.sha256_cert_fingerprints ?? []).map(
      (f) => f.toUpperCase(),
    );
  } catch {
    T.warn('assetlinks.json is not valid JSON');
    return;
  }
  if (published.length === 0) {
    T.warn(`assetlinks.json has no fingerprint for "${packageName}"`);
    return;
  }
  if (localFingerprints.length === 0) {
    T.info(`assetlinks.json publishes ${published.length} fingerprint(s) — could not compare (no local keystore)`);
    return;
  }
  const missing = localFingerprints.filter((f) => !published.includes(f));
  if (missing.length === 0) {
    T.ok('assetlinks.json contains your release signing fingerprint');
  } else {
    T.fail(
      `assetlinks.json does NOT list your release fingerprint (${missing[0]?.slice(0, 17)}…) — ` +
        'deep links and the OAuth return will silently fall back to the browser',
    );
  }
}

// --- live-site checks ---

async function fetchPage(url: string): Promise<Page | null> {
  const res = await fetchQuiet(url, { headers: { 'User-Agent': appcaskUa() } });
  if (!res) return null;
  return { status: res.status, headers: res.headers, html: await res.text().catch(() => '') };
}

export function checkCsp(T: Checks, headers: Headers): void {
  const csp = headers.get('content-security-policy');
  if (!csp) {
    T.info('no Content-Security-Policy header (fine for a WebView)');
    return;
  }
  const directive = /(?:^|;)\s*(script-src|default-src)\s+([^;]+)/i.exec(csp);
  if (directive && !/'unsafe-inline'|'nonce-|'strict-dynamic'/.test(directive[2] as string)) {
    T.warn(
      `CSP ${directive[1]} has no 'unsafe-inline' — on iOS the injected window.__APPCASK__ script is blocked, ` +
        'so isAppcask() and the bridge fail. Add a nonce or relax it for the app host.',
    );
  } else {
    T.ok('CSP allows the shell to inject its bootstrap script');
  }
}

export function checkMixedContent(T: Checks, html: string): void {
  const http = [...html.matchAll(/\b(?:src|href)=["'](http:\/\/[^"']+)/gi)]
    .map((m) => m[1] as string)
    .filter((u) => !u.startsWith('http://localhost'));
  if (http.length === 0) {
    T.ok('no mixed (http://) sub-resources in the landing HTML');
  } else {
    T.warn(`${http.length} http:// resource(s) on the page (e.g. ${http[0]}) — the WebView blocks mixed content`);
  }
}

export function checkViewport(T: Checks, html: string, safeArea: string): void {
  const m = /<meta[^>]+name=["']viewport["'][^>]*>/i.exec(html);
  if (!m) {
    T.warn('no <meta name="viewport"> — the site renders at 980px, zoomed out, on a phone');
    return;
  }
  const content = /content=["']([^"']+)/i.exec(m[0])?.[1] ?? '';
  if (!/width\s*=\s*device-width/i.test(content)) {
    T.warn('viewport meta is missing width=device-width');
  } else if (safeArea === 'css-vars' && !/viewport-fit\s*=\s*cover/i.test(content)) {
    T.warn('safeArea is "css-vars" but the viewport meta lacks viewport-fit=cover — env() insets stay 0 on iOS');
  } else {
    T.ok('viewport meta is set for mobile');
  }
}

export function checkCookies(T: Checks, headers: Headers): void {
  const setCookie = headers.getSetCookie?.() ?? [];
  if (setCookie.length === 0) {
    T.info('the landing page sets no cookies');
    return;
  }
  const insecure = setCookie.filter((c) => !/;\s*Secure/i.test(c));
  const strict = setCookie.filter((c) => /;\s*SameSite=Strict/i.test(c));
  if (insecure.length) T.warn(`${insecure.length} cookie(s) set without Secure — dropped in the WebView over https`);
  if (strict.length) {
    T.warn(
      `${strict.length} cookie(s) are SameSite=Strict — a session cookie set during the OAuth Custom Tab won't ` +
        'be sent when the app returns. Use SameSite=Lax for the session cookie.',
    );
  }
  if (!insecure.length && !strict.length) T.ok('cookie flags look WebView-safe');
}

function checkHsts(T: Checks, headers: Headers): void {
  if (headers.get('strict-transport-security')) T.ok('HSTS enabled');
  else T.info('no Strict-Transport-Security header (recommended)');
}

async function checkUaSniffing(T: Checks, url: string, appPage: Page): Promise<void> {
  const desktop = await fetchQuiet(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
  });
  if (!desktop) return;
  if (desktop.status !== appPage.status) {
    T.warn(`the site answers the appcask User-Agent with ${appPage.status} but a desktop UA with ${desktop.status} — it may be sniffing`);
    return;
  }
  const other = (await desktop.text().catch(() => '')).length;
  const ratio = other === 0 ? 1 : appPage.html.length / other;
  if (ratio < 0.6 || ratio > 1.7) {
    T.warn('the response to the appcask User-Agent is very different in size from a desktop browser — check for UA sniffing / an app interstitial');
  } else {
    T.ok('the site serves the same page to the appcask User-Agent');
  }
}

export function storePolicyNotes(T: Checks, config: ResolvedAppcaskConfig): void {
  const nativeSignals = [
    config.features.deepLinks && 'deep links',
    config.features.offlinePage && 'offline screen',
    config.features.externalBrowserAuth.length > 0 && 'native sign-in',
    config.features.pullToRefresh && 'pull-to-refresh',
    config.navigation.mode !== 'single' && 'native navigation',
    config.features.push && 'push notifications',
  ].filter(Boolean) as string[];

  if (nativeSignals.length >= 3) {
    T.ok(`store review: ${nativeSignals.length} native capabilities enabled (${nativeSignals.join(', ')})`);
  } else {
    T.warn(
      `store review: only ${nativeSignals.length} native capability enabled. Apple rejects apps that are just a ` +
        'repackaged website (Guideline 4.2). Turn on push, deep links, offline, or native navigation.',
    );
  }
  T.info('Play Store: a WebView-only app is allowed but flag it as such; keep android.usesCleartextTraffic=false.');
}

// --- helpers ---

function appcaskUa(): string {
  return 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 appcask/1.0';
}

async function fetchQuiet(url: string, init: RequestInit = {}): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, { redirect: 'follow', ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function runCapture(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out : out || null));
  });
}

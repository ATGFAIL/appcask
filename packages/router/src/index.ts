import { pathMatchesAnyGlob } from './glob.js';

export { pathMatchesGlob, pathMatchesAnyGlob } from './glob.js';

/** What the shell should do with a navigation attempt. */
export type RouteDecision =
  /** Load in the primary WebView (normal in-app navigation). */
  | { kind: 'internal'; url: string }
  /**
   * Its own document, not a route inside the SPA — load via native `loadUrl`
   * so the SPA history isn't left holding a path it can't render
   * (the `location.*` navigation bounce).
   */
  | { kind: 'separate-document'; url: string }
  /**
   * An identity provider (Google, Apple, ...). Open in Custom Tabs /
   * `ASWebAuthenticationSession` and watch for the redirect back to an
   * internal host, then resume the WebView.
   */
  | { kind: 'external-auth'; url: string }
  /** Some other web page — open in a Custom Tab / in-app browser, not the app WebView. */
  | { kind: 'external'; url: string }
  /** A non-web scheme (`tel:`, `mailto:`, `market:`, an app `intent:` ...) — hand to the OS. */
  | { kind: 'system'; url: string }
  /** Refuse the navigation (`about:blank`, `javascript:`, `data:` in the top frame). */
  | { kind: 'block'; reason: string };

export interface RouterConfig {
  /**
   * Hosts that render inside the WebView. An entry beginning with `.`
   * (e.g. `.acme.com`) also matches sub-domains; otherwise the match is exact.
   */
  internalHosts: readonly string[];
  /** Hosts whose pages must open in the OS auth browser. Same `.` sub-domain rule. */
  externalBrowserAuth?: readonly string[];
  /** Path globs on an internal host that are their own document. */
  separateDocumentPatterns?: readonly string[];
}

export interface RouteOptions {
  /** The URL currently shown, used to resolve a relative `target`. */
  currentUrl?: string;
}

const SYSTEM_SCHEMES = new Set([
  'tel:',
  'sms:',
  'mailto:',
  'geo:',
  'maps:',
  'market:',
  'intent:',
  'whatsapp:',
  'tg:',
  'fb:',
  'twitter:',
  'line:',
  'itms-apps:',
  'itms-appss:',
]);

const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'blob:', 'file:', 'content:']);

export interface Router {
  route(target: string, options?: RouteOptions): RouteDecision;
}

export function createRouter(config: RouterConfig): Router {
  const internalHosts = config.internalHosts.map((h) => h.toLowerCase());
  const authHosts = (config.externalBrowserAuth ?? []).map((h) => h.toLowerCase());
  const separateDocs = config.separateDocumentPatterns ?? [];

  if (internalHosts.length === 0) {
    throw new Error('createRouter: internalHosts must not be empty');
  }
  const fallbackBase = `https://${stripDotPrefix(internalHosts[0] as string)}/`;

  function hostMatches(host: string, list: readonly string[]): boolean {
    const h = host.toLowerCase();
    return list.some((entry) =>
      entry.startsWith('.') ? h === entry.slice(1) || h.endsWith(entry) : h === entry,
    );
  }

  function route(target: string, options: RouteOptions = {}): RouteDecision {
    const trimmed = target.trim();
    if (trimmed === '' || trimmed === 'about:blank' || trimmed.startsWith('about:')) {
      return { kind: 'block', reason: `refused navigation to "${trimmed || '(empty)'}"` };
    }

    const scheme = schemeOf(trimmed);

    if (scheme && BLOCKED_SCHEMES.has(scheme)) {
      return { kind: 'block', reason: `refused navigation to a ${scheme} URL in the main frame` };
    }

    if (scheme === 'intent:') {
      const unwrapped = unwrapIntent(trimmed);
      if (unwrapped) return route(unwrapped, options);
      return { kind: 'system', url: trimmed };
    }

    if (scheme && SYSTEM_SCHEMES.has(scheme)) {
      return { kind: 'system', url: trimmed };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed, options.currentUrl ?? fallbackBase);
    } catch {
      return { kind: 'block', reason: `could not parse URL "${trimmed}"` };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { kind: 'system', url: parsed.toString() };
    }

    if (hostMatches(parsed.host, authHosts)) {
      return { kind: 'external-auth', url: parsed.toString() };
    }

    if (hostMatches(parsed.host, internalHosts)) {
      if (pathMatchesAnyGlob(parsed.pathname, separateDocs)) {
        return { kind: 'separate-document', url: parsed.toString() };
      }
      return { kind: 'internal', url: parsed.toString() };
    }

    return { kind: 'external', url: parsed.toString() };
  }

  return { route };
}

function schemeOf(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*:)/i.exec(url);
  return m ? (m[1] as string).toLowerCase() : null;
}

function stripDotPrefix(host: string): string {
  return host.startsWith('.') ? host.slice(1) : host;
}

/**
 * Pull an https target out of an Android `intent://` URL — either the
 * `S.browser_fallback_url` extra or the intent's own host/path.
 * Ported from the ATG Play shell's `atgIntentDeepLink`.
 */
export function unwrapIntent(intentUrl: string): string | null {
  if (!/^intent:\/\//i.test(intentUrl)) return null;

  const fallbackMatch = /S\.browser_fallback_url=([^;]+)/i.exec(intentUrl);
  if (fallbackMatch) {
    try {
      const decoded = decodeURIComponent(fallbackMatch[1] as string);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      /* fall through */
    }
  }

  const withoutIntentBlock = intentUrl.split('#Intent;')[0] as string;
  const asHttps = withoutIntentBlock.replace(/^intent:\/\//i, 'https://');
  try {
    const parsed = new URL(asHttps);
    if (parsed.host) return parsed.toString();
  } catch {
    /* ignore */
  }
  return null;
}

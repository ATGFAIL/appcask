import { describe, it, expect } from 'vitest';
import { createRouter, unwrapIntent } from './index.js';
import { pathMatchesGlob } from './glob.js';

const router = createRouter({
  internalHosts: ['acme.example', '.cdn.acme.example'],
  externalBrowserAuth: ['accounts.google.com', 'appleid.apple.com'],
  separateDocumentPatterns: ['/admin', '/checkout/*', '/reports/**'],
});

describe('internal vs external', () => {
  it('keeps an internal host in the WebView', () => {
    expect(router.route('https://acme.example/dashboard')).toEqual({
      kind: 'internal',
      url: 'https://acme.example/dashboard',
    });
  });

  it('matches sub-domains for a dot-prefixed host', () => {
    expect(router.route('https://img.cdn.acme.example/a.png').kind).toBe('internal');
    expect(router.route('https://cdn.acme.example/a.png').kind).toBe('internal');
  });

  it('sends an unknown host to an external browser', () => {
    expect(router.route('https://news.ycombinator.com')).toEqual({
      kind: 'external',
      url: 'https://news.ycombinator.com/',
    });
  });

  it('resolves a relative URL against currentUrl', () => {
    expect(
      router.route('/settings', { currentUrl: 'https://acme.example/home' }),
    ).toMatchObject({ kind: 'internal', url: 'https://acme.example/settings' });
  });
});

describe('auth hosts', () => {
  it('routes a Google sign-in page to the OS auth browser', () => {
    expect(router.route('https://accounts.google.com/o/oauth2/v2/auth?x=1')).toMatchObject({
      kind: 'external-auth',
    });
  });
});

describe('separate documents', () => {
  it('routes an exact match via native loadUrl', () => {
    expect(router.route('https://acme.example/admin').kind).toBe('separate-document');
  });
  it('treats a no-wildcard pattern as a directory prefix', () => {
    expect(router.route('https://acme.example/admin/users/42').kind).toBe('separate-document');
  });
  it('matches a single-segment wildcard', () => {
    expect(router.route('https://acme.example/checkout/step-2').kind).toBe('separate-document');
    expect(router.route('https://acme.example/checkout/step-2/extra').kind).toBe('internal');
  });
  it('matches a multi-segment wildcard', () => {
    expect(router.route('https://acme.example/reports/2026/q1/summary').kind).toBe(
      'separate-document',
    );
  });
});

describe('non-web schemes', () => {
  it.each([
    ['tel:+123', 'system'],
    ['mailto:a@b.com', 'system'],
    ['market://details?id=com.x', 'system'],
    ['whatsapp://send?text=hi', 'system'],
  ])('%s -> %s', (url, kind) => {
    expect(router.route(url).kind).toBe(kind);
  });

  it.each(['about:blank', 'about:srcdoc', ''])('blocks %s', (url) => {
    expect(router.route(url).kind).toBe('block');
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd'])(
    'blocks %s in the main frame',
    (url) => {
      expect(router.route(url).kind).toBe('block');
    },
  );
});

describe('intent:// unwrapping', () => {
  it('follows S.browser_fallback_url', () => {
    const intent =
      'intent://acme.example/promo#Intent;scheme=https;S.browser_fallback_url=https%3A%2F%2Facme.example%2Fpromo;end';
    expect(router.route(intent)).toMatchObject({ kind: 'internal', url: 'https://acme.example/promo' });
  });

  it('falls back to the intent host/path when there is no fallback url', () => {
    const intent = 'intent://acme.example/x/y#Intent;scheme=https;package=com.acme;end';
    expect(router.route(intent)).toMatchObject({ kind: 'internal' });
  });

  it('routes an unresolvable intent to the system', () => {
    expect(unwrapIntent('intent://#Intent;package=com.whatever;end')).toBeNull();
    expect(router.route('intent://#Intent;package=com.whatever;end').kind).toBe('system');
  });
});

describe('http (not https)', () => {
  it('keeps http on an internal host (the site may redirect itself)', () => {
    expect(router.route('http://acme.example/x').kind).toBe('internal');
  });
  it('sends http on a foreign host to an external browser', () => {
    expect(router.route('http://tracker.evil/x').kind).toBe('external');
  });
});

describe('pathMatchesGlob', () => {
  it('anchors to the whole path', () => {
    expect(pathMatchesGlob('/a/b', '/a/*')).toBe(true);
    expect(pathMatchesGlob('/a/b/c', '/a/*')).toBe(false);
    expect(pathMatchesGlob('/a/b/c', '/a/**')).toBe(true);
  });
});

describe('createRouter guards', () => {
  it('throws when internalHosts is empty', () => {
    expect(() => createRouter({ internalHosts: [] })).toThrow();
  });
});

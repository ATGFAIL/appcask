import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  checkCsp,
  checkMixedContent,
  checkViewport,
  checkCookies,
  storePolicyNotes,
  runProductionChecks,
  type Checks,
} from './production.js';
import { resolveConfig } from '@appcask/config';

/** A Checks recorder. */
function recorder() {
  const calls: { level: keyof Checks; msg: string }[] = [];
  const make = (level: keyof Checks) => (msg: string) => calls.push({ level, msg });
  const T: Checks = { ok: make('ok'), warn: make('warn'), fail: make('fail'), info: make('info') };
  return {
    T,
    levels: () => calls.map((c) => c.level),
    last: () => calls[calls.length - 1],
    has: (level: keyof Checks) => calls.some((c) => c.level === level),
    msgOf: (level: keyof Checks) => calls.find((c) => c.level === level)?.msg,
  };
}

describe('checkCsp', () => {
  it('warns when script-src blocks inline', () => {
    const r = recorder();
    checkCsp(r.T, new Headers({ 'content-security-policy': "default-src 'self'; script-src 'self'" }));
    expect(r.has('warn')).toBe(true);
    expect(r.last()?.msg).toMatch(/unsafe-inline/);
  });

  it('is ok with a nonce', () => {
    const r = recorder();
    checkCsp(r.T, new Headers({ 'content-security-policy': "script-src 'self' 'nonce-abc123'" }));
    expect(r.has('warn')).toBe(false);
    expect(r.has('ok')).toBe(true);
  });

  it('is ok with unsafe-inline', () => {
    const r = recorder();
    checkCsp(r.T, new Headers({ 'content-security-policy': "script-src 'self' 'unsafe-inline'" }));
    expect(r.has('ok')).toBe(true);
  });

  it('info when there is no CSP', () => {
    const r = recorder();
    checkCsp(r.T, new Headers());
    expect(r.levels()).toEqual(['info']);
  });
});

describe('checkMixedContent', () => {
  it('flags http:// sub-resources', () => {
    const r = recorder();
    checkMixedContent(r.T, '<img src="http://cdn.old/logo.png"><script src="https://ok/a.js">');
    expect(r.last()).toMatchObject({ level: 'warn' });
    expect(r.last()?.msg).toContain('http://cdn.old/logo.png');
  });
  it('ignores localhost and passes a clean page', () => {
    const r = recorder();
    checkMixedContent(r.T, '<img src="https://cdn/x.png"><a href="http://localhost:3000">');
    expect(r.has('ok')).toBe(true);
    expect(r.has('warn')).toBe(false);
  });
});

describe('checkViewport', () => {
  it('warns when the meta is missing', () => {
    const r = recorder();
    checkViewport(r.T, '<head></head>', 'inset');
    expect(r.last()?.msg).toMatch(/no <meta name="viewport">/);
  });
  it('warns when width=device-width is missing', () => {
    const r = recorder();
    checkViewport(r.T, '<meta name="viewport" content="initial-scale=1">', 'inset');
    expect(r.last()?.msg).toMatch(/device-width/);
  });
  it('warns about viewport-fit only in css-vars mode', () => {
    const inset = recorder();
    checkViewport(inset.T, '<meta name="viewport" content="width=device-width, initial-scale=1">', 'inset');
    expect(inset.has('ok')).toBe(true);

    const cssVars = recorder();
    checkViewport(cssVars.T, '<meta name="viewport" content="width=device-width, initial-scale=1">', 'css-vars');
    expect(cssVars.last()?.msg).toMatch(/viewport-fit=cover/);
  });
});

describe('checkCookies', () => {
  it('warns about a cookie without Secure and about SameSite=Strict', () => {
    const r = recorder();
    const h = new Headers();
    h.append('set-cookie', 'sid=abc; Path=/; HttpOnly; SameSite=Strict');
    h.append('set-cookie', 'pref=en; Path=/; Secure');
    checkCookies(r.T, h);
    const msgs = r.levels();
    expect(msgs.filter((l) => l === 'warn').length).toBe(2);
  });
  it('passes WebView-safe cookies', () => {
    const r = recorder();
    const h = new Headers();
    h.append('set-cookie', 'sid=abc; Secure; SameSite=Lax');
    checkCookies(r.T, h);
    expect(r.has('ok')).toBe(true);
    expect(r.has('warn')).toBe(false);
  });
});

describe('storePolicyNotes', () => {
  const base = { identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' }, startUrl: 'https://x.example' };

  it('is ok with 3+ native capabilities', () => {
    const r = recorder();
    storePolicyNotes(
      r.T,
      resolveConfig({
        ...base,
        features: { offlinePage: true, pullToRefresh: true, deepLinks: { host: 'x.example' } },
      }),
    );
    expect(r.has('ok')).toBe(true);
  });

  it('warns about Apple 4.2 with a bare wrapper', () => {
    const r = recorder();
    storePolicyNotes(
      r.T,
      resolveConfig({ ...base, features: { offlinePage: false, pullToRefresh: false, externalBrowserAuth: [] } }),
    );
    expect(r.has('warn')).toBe(true);
    expect(r.msgOf('warn')).toMatch(/Guideline 4.2|repackaged website/i);
  });
});

describe('runProductionChecks live site', () => {
  const config = resolveConfig({
    identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' },
    startUrl: 'https://x.example',
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([404, 500])('fails on an HTTP %s start URL without running downstream checks', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status })));
    const r = recorder();

    await runProductionChecks(r.T, config, '/missing-project', {});

    expect(r.msgOf('fail')).toContain(`responded with HTTP ${status}`);
    expect(r.levels()).not.toContain('ok');
    expect(r.levels().filter((level) => level === 'info')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('runs downstream live-site checks for a 2xx start URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<meta name="viewport" content="width=device-width">', { status: 200 }),
      ),
    );
    const r = recorder();

    await runProductionChecks(r.T, config, '/missing-project', {});

    expect(r.has('fail')).toBe(false);
    expect(r.msgOf('ok')).toBe('no mixed (http://) sub-resources in the landing HTML');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

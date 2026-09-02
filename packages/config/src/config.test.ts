import { describe, it, expect } from 'vitest';
import { validateConfig } from './validate.js';
import { resolveConfig } from './resolve.js';
import type { AppcaskConfig } from './types.js';

const minimal: AppcaskConfig = {
  identity: { appName: 'Acme', packageName: 'com.acme.app', version: '1.0.0' },
  startUrl: 'https://acme.example',
};

describe('validateConfig', () => {
  it('accepts a minimal config', () => {
    expect(validateConfig(minimal)).toEqual({ valid: true, problems: [] });
  });

  it('accepts a fully-populated config', () => {
    const full: AppcaskConfig = {
      $schema: 'https://appcask.dev/schema/v1.json',
      identity: { appName: 'Acme', packageName: 'com.acme.mobile', version: '2.3.4' },
      startUrl: 'https://app.acme.example/home',
      internalHosts: ['app.acme.example', 'acme.example'],
      theme: {
        statusBar: { style: 'light', color: '#0b0b10' },
        navigationBarColor: '#000000',
        splash: { background: '#0b0b10', logo: 'assets/logo.png' },
        safeArea: 'css-vars',
      },
      navigation: {
        mode: 'tabs',
        tabs: [
          { label: 'Home', url: 'https://app.acme.example/home' },
          { label: 'Account', url: 'https://app.acme.example/me', icon: 'user' },
        ],
      },
      features: {
        pullToRefresh: true,
        offlinePage: true,
        fileAccess: true,
        downloads: true,
        externalBrowserAuth: ['accounts.google.com', 'appleid.apple.com'],
        separateDocumentPatterns: ['/admin/*', '/checkout'],
        deepLinks: { host: 'acme.example', pathPatterns: ['/p/*', '/order/*'] },
        push: { provider: 'fcm', onTapUrlParam: 'target' },
      },
      bridge: { allowedOrigins: ['https://app.acme.example'] },
    };
    expect(validateConfig(full).valid).toBe(true);
  });

  it('rejects a missing identity', () => {
    const r = validateConfig({ startUrl: 'https://acme.example' });
    expect(r.valid).toBe(false);
    expect(r.problems).toContainEqual({ path: '/', message: 'missing required property "identity"' });
  });

  it('rejects a non-https startUrl', () => {
    const r = validateConfig({ ...minimal, startUrl: 'http://acme.example' });
    expect(r.valid).toBe(false);
    expect(r.problems.some((p) => p.path === '/startUrl')).toBe(true);
  });

  it('rejects a bad package name', () => {
    const r = validateConfig({ ...minimal, identity: { ...minimal.identity, packageName: 'Acme App' } });
    expect(r.valid).toBe(false);
    expect(r.problems.some((p) => p.path === '/identity/packageName')).toBe(true);
  });

  it('rejects a non-semver version', () => {
    const r = validateConfig({ ...minimal, identity: { ...minimal.identity, version: 'v1' } });
    expect(r.valid).toBe(false);
  });

  it('rejects an unknown top-level property', () => {
    const r = validateConfig({ ...minimal, colour: 'blue' });
    expect(r.valid).toBe(false);
    expect(r.problems).toContainEqual({ path: '/', message: 'unknown property "colour"' });
  });

  it('rejects a malformed hex colour', () => {
    const r = validateConfig({ ...minimal, theme: { splash: { background: 'black' } } });
    expect(r.valid).toBe(false);
  });
});

describe('resolveConfig', () => {
  it('derives internalHosts from startUrl', () => {
    const resolved = resolveConfig(minimal);
    expect(resolved.internalHosts).toEqual(['acme.example']);
  });

  it('derives bridge origins from internal hosts', () => {
    const resolved = resolveConfig({ ...minimal, internalHosts: ['acme.example', 'cdn.acme.example'] });
    expect(resolved.bridge.allowedOrigins).toEqual([
      'https://acme.example',
      'https://cdn.acme.example',
    ]);
  });

  it('applies feature defaults', () => {
    const resolved = resolveConfig(minimal);
    expect(resolved.features).toMatchObject({
      userAgent: 'chrome',
      pullToRefresh: false,
      offlinePage: true,
      fileAccess: true,
      downloads: true,
      externalBrowserAuth: [],
      separateDocumentPatterns: [],
    });
  });

  it('accepts a custom userAgent string', () => {
    const r = validateConfig({ ...minimal, features: { userAgent: 'MyCustom/1.0 UA string' } });
    expect(r.valid).toBe(true);
  });

  it('defaults statusBar style to dark and safeArea to inset', () => {
    const resolved = resolveConfig(minimal);
    expect(resolved.theme.statusBar.style).toBe('dark');
    expect(resolved.theme.safeArea).toBe('inset');
  });

  it('fills deepLinks.pathPatterns default', () => {
    const resolved = resolveConfig({
      ...minimal,
      features: { deepLinks: { host: 'acme.example' } },
    });
    expect(resolved.features.deepLinks?.pathPatterns).toEqual(['/*']);
  });

  it('throws AppcaskConfigError listing every problem', () => {
    expect(() => resolveConfig({ startUrl: 'ftp://x' })).toThrowError(/Invalid appcask config/);
  });
});

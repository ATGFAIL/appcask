import { describe, it, expect } from 'vitest';
import { checkCapability, grantedCapabilities } from './capabilities.js';
import { resolveConfig } from './resolve.js';
import type { CapabilityGrant } from './types.js';

const ALL = ['haptic', 'share', 'navigate', 'secureStore.get', 'secureStore.set', 'clipboard.read', 'clipboard.write'];

describe('checkCapability', () => {
  it('allows everything when grants is null (no policy)', () => {
    for (const m of ALL) expect(checkCapability(null, 'https://x.example/', m).allowed).toBe(true);
  });

  it('is default-deny once grants is an array', () => {
    expect(checkCapability([], 'https://x.example/', 'haptic')).toEqual({
      allowed: false,
      reason: 'capability "haptic" is not granted for x.example/',
    });
  });

  const grants: CapabilityGrant[] = [
    { capabilities: ['haptic', 'share', 'navigate', 'clipboard.write'] },
    { match: { pathPrefix: '/account' }, capabilities: ['secureStore.*'] },
    { match: { host: 'x.example', pathGlob: '/support/**' }, capabilities: ['clipboard.read'] },
  ];

  it('grants a global capability everywhere', () => {
    expect(checkCapability(grants, 'https://x.example/anything', 'haptic').allowed).toBe(true);
    expect(checkCapability(grants, 'https://x.example/deep/path', 'clipboard.write').allowed).toBe(true);
  });

  it('scopes a capability to a path prefix', () => {
    expect(checkCapability(grants, 'https://x.example/account/settings', 'secureStore.get').allowed).toBe(true);
    expect(checkCapability(grants, 'https://x.example/account', 'secureStore.set').allowed).toBe(true);
    expect(checkCapability(grants, 'https://x.example/home', 'secureStore.get').allowed).toBe(false);
  });

  it('scopes a capability to a host + glob', () => {
    expect(checkCapability(grants, 'https://x.example/support/ticket/9', 'clipboard.read').allowed).toBe(true);
    expect(checkCapability(grants, 'https://x.example/other', 'clipboard.read').allowed).toBe(false);
    expect(checkCapability(grants, 'https://evil.example/support/x', 'clipboard.read').allowed).toBe(false);
  });

  it('namespace wildcard matches only that namespace', () => {
    expect(checkCapability([{ match: { pathPrefix: '/a' }, capabilities: ['secureStore.*'] }], 'https://x/a', 'secureStore.remove').allowed).toBe(true);
    expect(checkCapability([{ match: { pathPrefix: '/a' }, capabilities: ['secureStore.*'] }], 'https://x/a', 'clipboard.read').allowed).toBe(false);
  });

  it('`*` grants everything in scope', () => {
    expect(checkCapability([{ match: { host: 'admin.x.example' }, capabilities: ['*'] }], 'https://admin.x.example/', 'secureStore.set').allowed).toBe(true);
  });

  it('leading-dot host matches sub-domains', () => {
    const g: CapabilityGrant[] = [{ match: { host: '.x.example' }, capabilities: ['haptic'] }];
    expect(checkCapability(g, 'https://cdn.x.example/', 'haptic').allowed).toBe(true);
    expect(checkCapability(g, 'https://x.example/', 'haptic').allowed).toBe(true);
    expect(checkCapability(g, 'https://x.example.evil.com/', 'haptic').allowed).toBe(false);
  });
});

describe('grantedCapabilities', () => {
  it('lists what a URL can do', () => {
    const grants: CapabilityGrant[] = [
      { capabilities: ['haptic', 'share'] },
      { match: { pathPrefix: '/account' }, capabilities: ['secureStore.get', 'secureStore.set'] },
    ];
    expect(grantedCapabilities(grants, 'https://x.example/account/x', ALL).sort()).toEqual(
      ['haptic', 'secureStore.get', 'secureStore.set', 'share'].sort(),
    );
    expect(grantedCapabilities(grants, 'https://x.example/home', ALL).sort()).toEqual(['haptic', 'share'].sort());
  });

  it('returns everything for a null policy', () => {
    expect(grantedCapabilities(null, 'https://x/', ALL)).toEqual(ALL);
  });
});

describe('resolveConfig integration', () => {
  it('keeps grants null when the config omits bridge.grants', () => {
    const c = resolveConfig({
      identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' },
      startUrl: 'https://x.example',
    });
    expect(c.bridge.grants).toBeNull();
  });

  it('carries grants through when present', () => {
    const c = resolveConfig({
      identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' },
      startUrl: 'https://x.example',
      bridge: { grants: [{ capabilities: ['haptic'] }] },
    });
    expect(c.bridge.grants).toEqual([{ capabilities: ['haptic'] }]);
    expect(checkCapability(c.bridge.grants, 'https://x.example/', 'share').allowed).toBe(false);
  });

  it('rejects a malformed capability name', () => {
    const c = resolveConfig.bind(null, {
      identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' },
      startUrl: 'https://x.example',
      bridge: { grants: [{ capabilities: ['secure store'] }] },
    });
    expect(c).toThrow(/Invalid appcask config/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  androidVersionCode,
  packageToPath,
  patchBuildGradle,
  patchStringsXml,
  patchAppJson,
  patchKotlinPackage,
  colorsXml,
  deeplinkHost,
} from './androidPatch.js';
import { resolveConfig } from '@appcask/config';

const config = resolveConfig({
  identity: { appName: 'ATG Shop', packageName: 'net.atgofficial.atgshop', version: '2.4.1' },
  startUrl: 'https://atgshop.atgofficial.net',
  theme: { statusBar: { color: '#0b0b10' }, splash: { background: '#0b3d2e' } },
});

describe('androidVersionCode', () => {
  it.each([
    ['1.0.0', 10000],
    ['2.4.1', 20401],
    ['0.9.12', 912],
    ['12.34.56', 123456],
  ])('%s -> %d', (v, code) => {
    expect(androidVersionCode(v)).toBe(code);
  });
});

describe('packageToPath', () => {
  it('maps dots to slashes', () => {
    expect(packageToPath('net.atgofficial.atgshop')).toBe('net/atgofficial/atgshop');
  });
});

describe('patchBuildGradle', () => {
  const gradle = `android {
    namespace "com.appcaskshell"
    defaultConfig {
        applicationId "com.appcaskshell"
        versionCode 1
        versionName "1.0"
    }
}`;
  it('rewrites namespace, applicationId, version', () => {
    const out = patchBuildGradle(gradle, {
      oldPackage: 'com.appcaskshell',
      packageName: 'net.atgofficial.atgshop',
      version: '2.4.1',
    });
    expect(out).toContain('namespace "net.atgofficial.atgshop"');
    expect(out).toContain('applicationId "net.atgofficial.atgshop"');
    expect(out).toContain('versionCode 20401');
    expect(out).toContain('versionName "2.4.1"');
    expect(out).not.toContain('appcaskshell');
  });
});

describe('patchStringsXml', () => {
  it('rewrites app_name and deeplink host, escaping XML', () => {
    const xml = `<resources>
    <string name="app_name">Appcask Shell</string>
    <string name="appcask_deeplink_host">example.com</string>
</resources>`;
    const out = patchStringsXml(xml, { appName: 'Tom & Jerry', deeplinkHost: 'shop.acme.com' });
    expect(out).toContain('<string name="app_name">Tom &amp; Jerry</string>');
    expect(out).toContain('<string name="appcask_deeplink_host">shop.acme.com</string>');
  });
});

describe('patchAppJson', () => {
  it('keeps name, sets displayName', () => {
    const out = JSON.parse(patchAppJson('{"name":"AppcaskShell","displayName":"x"}', { appName: 'ATG Shop' }));
    expect(out).toEqual({ name: 'AppcaskShell', displayName: 'ATG Shop' });
  });
});

describe('patchKotlinPackage', () => {
  it('rewrites the package declaration and qualified references', () => {
    const kt = `package com.appcaskshell

import com.appcaskshell.AuthRedirectBus
class X : com.appcaskshell.Base()`;
    const out = patchKotlinPackage(kt, {
      oldPackage: 'com.appcaskshell',
      newPackage: 'net.atgofficial.atgshop',
    });
    expect(out).toContain('package net.atgofficial.atgshop');
    expect(out).toContain('import net.atgofficial.atgshop.AuthRedirectBus');
    expect(out).toContain('net.atgofficial.atgshop.Base()');
    expect(out).not.toContain('appcaskshell');
  });

  it('does not touch a similarly-named package', () => {
    const kt = 'package com.appcaskshelltools';
    expect(patchKotlinPackage(kt, { oldPackage: 'com.appcaskshell', newPackage: 'x.y' })).toBe(kt);
  });
});

describe('colorsXml', () => {
  it('uses the config theme colours', () => {
    const out = colorsXml(config);
    expect(out).toContain('<color name="appcask_status_bar">#0b0b10</color>');
    expect(out).toContain('<color name="appcask_splash_background">#0b3d2e</color>');
    // nav bar falls back to the status bar colour
    expect(out).toContain('<color name="appcask_navigation_bar">#0b0b10</color>');
  });
});

describe('deeplinkHost', () => {
  it('prefers features.deepLinks.host', () => {
    const c = resolveConfig({
      identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' },
      startUrl: 'https://app.x.com',
      features: { deepLinks: { host: 'x.com' } },
    });
    expect(deeplinkHost(c)).toBe('x.com');
  });
  it('falls back to the first internal host', () => {
    expect(deeplinkHost(config)).toBe('atgshop.atgofficial.net');
  });
});

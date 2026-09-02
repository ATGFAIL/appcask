import { Platform } from 'react-native';
import { BRIDGE_VERSION, safeStringify } from '@appcask/bridge';
import type { Insets } from '@appcask/bridge';
import { config } from '../config';
import { SHELL_VERSION } from './version';

export interface InjectionEnv {
  platform: 'android' | 'ios';
  insets: Insets;
  online: boolean;
}

/**
 * Runs **before the page's own scripts**. Sets `window.__APPCASK__` so
 * `isAppcask()` is synchronous, and installs fallback bridge sinks that a site
 * not using `@appcask/web` can still listen to as DOM events.
 */
export function beforeContentScript(): string {
  const env = safeStringify({
    present: true,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    shellVersion: SHELL_VERSION,
    appVersion: config.identity.version,
    bridgeVersion: BRIDGE_VERSION,
  });

  return `(function () {
  try {
    if (window.__APPCASK__ && window.__APPCASK__.present) return;
    window.__APPCASK__ = ${env};
    if (typeof window.__appcaskReceive !== 'function') {
      window.__appcaskReceive = function (raw) {
        try {
          var msg = JSON.parse(raw);
          window.dispatchEvent(new CustomEvent('appcask:response', { detail: msg }));
        } catch (e) {}
      };
    }
    if (typeof window.__appcaskEmit !== 'function') {
      window.__appcaskEmit = function (raw) {
        try {
          var msg = JSON.parse(raw);
          if (msg && msg.name) {
            window.dispatchEvent(new CustomEvent('appcask:' + msg.name, { detail: msg.detail }));
          }
        } catch (e) {}
      };
    }
  } catch (e) {}
})();
true;`;
}

/**
 * Runs on every load and whenever insets / connectivity change. Publishes the
 * safe-area insets as CSS custom properties and fires an `appcask:context`
 * event / bridge event.
 */
export function contextScript(env: InjectionEnv): string {
  const payload = safeStringify({
    channel: 'appcask',
    version: BRIDGE_VERSION,
    kind: 'event',
    name: 'context',
    detail: { insets: env.insets, platform: env.platform, online: env.online },
  });
  const useCssVars = config.theme.safeArea === 'css-vars';
  const insetCss = useCssVars ? buildInsetSelectorCss(config.theme.insetSelectors) : '';

  return `(function () {
  try {
    var msg = ${payload};
    var i = msg.detail.insets;
    ${
      useCssVars
        ? `var root = document.documentElement;
    root.style.setProperty('--appcask-top-inset', i.top + 'px');
    root.style.setProperty('--appcask-right-inset', i.right + 'px');
    root.style.setProperty('--appcask-bottom-inset', i.bottom + 'px');
    root.style.setProperty('--appcask-left-inset', i.left + 'px');
    root.dataset.appcask = 'ready';`
        : ''
    }${
      insetCss
        ? `
    var s = document.getElementById('appcask-inset-css');
    if (!s) { s = document.createElement('style'); s.id = 'appcask-inset-css'; document.head.appendChild(s); }
    s.textContent = ${safeStringify(insetCss)};`
        : ''
    }
    if (typeof window.__appcaskEmit === 'function') {
      window.__appcaskEmit(JSON.stringify(msg));
    }
  } catch (e) {}
})();
true;`;
}

/**
 * Turn `theme.insetSelectors` into CSS that offsets fixed / sticky elements by
 * the safe-area inset — an edge-to-edge look with no changes to the site.
 * `"header"` → top; `".fab@bottom"` → bottom.
 */
function buildInsetSelectorCss(selectors: string[]): string {
  const rules: string[] = [];
  for (const raw of selectors) {
    const bottom = raw.endsWith('@bottom');
    const selector = bottom ? raw.slice(0, -'@bottom'.length).trim() : raw.trim();
    if (!selector) continue;
    const edge = bottom ? 'bottom' : 'top';
    rules.push(`${selector}{${edge}:var(--appcask-${edge}-inset) !important}`);
  }
  return rules.join('\n');
}

/** Deliver a native → page bridge message (response or event). */
export function deliverScript(rawMessage: string): string {
  const encoded = safeStringify(rawMessage);
  return `(function () {
  try {
    var raw = ${encoded};
    var msg = JSON.parse(raw);
    if (msg.kind === 'event' && typeof window.__appcaskEmit === 'function') window.__appcaskEmit(raw);
    else if (typeof window.__appcaskReceive === 'function') window.__appcaskReceive(raw);
  } catch (e) {}
})();
true;`;
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { decodeRequest, encodeOk, encodeError, encodeEvent } from '@appcask/bridge';

// The module keeps internal state (installed sinks, pending map), so re-import
// fresh for every test.
async function loadClient() {
  vi.resetModules();
  return import('./index.js');
}

interface FakeShell {
  sent: string[];
  /** Reply to the most recent request with an ok result. */
  replyOk(result: Record<string, unknown>): void;
  replyError(code: string, message: string): void;
  emit(name: string, detail: Record<string, unknown>): void;
}

function installFakeShell(): FakeShell {
  const sent: string[] = [];
  (globalThis as Record<string, unknown>).__APPCASK__ = {
    present: true,
    platform: 'android',
    shellVersion: '0.1.0',
    appVersion: '1.0.0',
    bridgeVersion: 1,
  };
  (globalThis as Record<string, unknown>).ReactNativeWebView = {
    postMessage: (data: string) => sent.push(data),
  };
  const g = globalThis as Record<string, (raw: string) => void>;
  return {
    sent,
    replyOk(result) {
      const req = decodeRequest(sent[sent.length - 1] as string);
      g.__appcaskReceive?.(encodeOk(req!.id, result));
    },
    replyError(code, message) {
      const req = decodeRequest(sent[sent.length - 1] as string);
      g.__appcaskReceive?.(encodeError(req!.id, code as never, message));
    },
    emit(name, detail) {
      g.__appcaskEmit?.(encodeEvent(name as never, detail));
    },
  };
}

function uninstallShell() {
  delete (globalThis as Record<string, unknown>).__APPCASK__;
  delete (globalThis as Record<string, unknown>).ReactNativeWebView;
  delete (globalThis as Record<string, unknown>).__appcaskReceive;
  delete (globalThis as Record<string, unknown>).__appcaskEmit;
}

afterEach(uninstallShell);

describe('outside the shell', () => {
  beforeEach(uninstallShell);

  it('isAppcask() is false and platform is web', async () => {
    const { appcask, isAppcask } = await loadClient();
    expect(isAppcask()).toBe(false);
    expect(appcask.platform).toBe('web');
  });

  it('haptic resolves as a no-op', async () => {
    const { appcask } = await loadClient();
    await expect(appcask.haptic('light')).resolves.toBeUndefined();
  });

  it('getInfo rejects with NATIVE_UNAVAILABLE', async () => {
    const { appcask } = await loadClient();
    await expect(appcask.getInfo()).rejects.toMatchObject({ code: 'NATIVE_UNAVAILABLE' });
  });

  it('secureStore falls back to localStorage', async () => {
    const { appcask } = await loadClient();
    await appcask.secureStore.set('token', 'abc');
    expect(await appcask.secureStore.get('token')).toBe('abc');
    await appcask.secureStore.remove('token');
    expect(await appcask.secureStore.get('token')).toBeNull();
  });

  it('openExternal falls back to window.open', async () => {
    const { appcask } = await loadClient();
    const spy = vi.spyOn(window, 'open').mockReturnValue(null);
    await appcask.openExternal('https://x.example/next');
    expect(spy).toHaveBeenCalledWith('https://x.example/next', '_blank', 'noopener');
  });

  it('navigate resolves without touching the bridge', async () => {
    const { appcask } = await loadClient();
    // hash navigation is the one form jsdom implements
    await expect(appcask.navigate('#section')).resolves.toBeUndefined();
    expect(window.location.hash).toBe('#section');
  });
});

describe('inside the shell', () => {
  it('sends a typed request and resolves the reply', async () => {
    const shell = installFakeShell();
    const { appcask } = await loadClient();

    const p = appcask.getInfo();
    expect(shell.sent).toHaveLength(1);
    const req = decodeRequest(shell.sent[0] as string);
    expect(req?.method).toBe('getInfo');

    shell.replyOk({
      platform: 'android',
      osVersion: '14',
      appVersion: '1.0.0',
      shellVersion: '0.1.0',
      bridgeVersion: 1,
      insets: { top: 24, right: 0, bottom: 0, left: 0 },
      online: true,
    });
    await expect(p).resolves.toMatchObject({ platform: 'android', osVersion: '14' });
  });

  it('rejects with a BridgeError carrying the native code', async () => {
    const shell = installFakeShell();
    const { appcask } = await loadClient();
    const p = appcask.clipboard.read();
    shell.replyError('PERMISSION_DENIED', 'user said no');
    await expect(p).rejects.toMatchObject({ code: 'PERMISSION_DENIED', message: 'user said no' });
  });

  it('times out when native never answers', async () => {
    vi.useFakeTimers();
    installFakeShell();
    const { appcask } = await loadClient();
    const p = appcask.haptic('light', { timeoutMs: 5000 });
    const assertion = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5001);
    await assertion;
    vi.useRealTimers();
  });

  it('delivers native events to on() and as a DOM CustomEvent', async () => {
    const shell = installFakeShell();
    const { appcask } = await loadClient();

    const seen: unknown[] = [];
    appcask.on('network', (d) => seen.push(d));
    const domSeen: unknown[] = [];
    window.addEventListener('appcask:network', (e) => domSeen.push((e as CustomEvent).detail));

    shell.emit('network', { online: false });
    expect(seen).toEqual([{ online: false }]);
    expect(domSeen).toEqual([{ online: false }]);
  });

  it('caches the latest context insets', async () => {
    const shell = installFakeShell();
    const { appcask } = await loadClient();
    shell.emit('context', { platform: 'android', online: true, insets: { top: 48, right: 0, bottom: 16, left: 0 } });
    expect(appcask.insets()).toEqual({ top: 48, right: 0, bottom: 16, left: 0 });
  });
});

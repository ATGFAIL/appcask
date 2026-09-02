/**
 * @format
 */
import { encodeRequest, decodeResponse } from '@appcask/bridge';
import { handleBridgeMessage, type DispatchContext } from '../src/shell/bridgeDispatch';
import { native } from '../src/shell/native';

jest.mock('../src/shell/native', () => ({
  native: {
    available: true,
    haptic: jest.fn().mockResolvedValue(undefined),
    share: jest.fn().mockResolvedValue(true),
    openExternal: jest.fn().mockResolvedValue(undefined),
    setStatusBar: jest.fn().mockResolvedValue(undefined),
    secureGet: jest.fn().mockResolvedValue('cached'),
    secureSet: jest.fn().mockResolvedValue(undefined),
    secureRemove: jest.fn().mockResolvedValue(undefined),
    clipboardRead: jest.fn().mockResolvedValue('hi'),
    clipboardWrite: jest.fn().mockResolvedValue(undefined),
    startAuthSession: jest.fn(),
    osVersion: jest.fn().mockResolvedValue('14'),
  },
}));

const mockNative = native as jest.Mocked<typeof native>;

const ctx: DispatchContext = {
  platform: 'android',
  online: true,
  insets: { top: 24, right: 0, bottom: 0, left: 0 },
  currentUrl: 'https://example.com/',
  requestNavigate: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

function call(method: string, params: Record<string, unknown>) {
  return handleBridgeMessage(encodeRequest('t1', method as never, params), ctx);
}

test('getInfo returns device + shell info', async () => {
  const res = decodeResponse((await call('getInfo', {}))!);
  expect(res).toMatchObject({
    ok: true,
    result: { platform: 'android', osVersion: '14', bridgeVersion: 1, online: true },
  });
});

test('haptic validates the type and forwards to native', async () => {
  const ok = decodeResponse((await call('haptic', { type: 'success' }))!);
  expect(ok?.ok).toBe(true);
  expect(mockNative.haptic).toHaveBeenCalledWith('success');

  const bad = decodeResponse((await call('haptic', { type: 'boom' }))!);
  expect(bad).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } });
});

test('navigate asks the shell to load natively, never touches native', async () => {
  const res = decodeResponse((await call('navigate', { url: 'https://x.example/next' }))!);
  expect(res?.ok).toBe(true);
  expect(ctx.requestNavigate).toHaveBeenCalledWith('https://x.example/next');
});

test('navigate rejects a non-https url', async () => {
  const res = decodeResponse((await call('navigate', { url: 'javascript:alert(1)' }))!);
  expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } });
});

test('share requires at least one field', async () => {
  const res = decodeResponse((await call('share', {}))!);
  expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } });
});

test('secureStore.get forwards the key', async () => {
  const res = decodeResponse((await call('secureStore.get', { key: 'session.token' }))!);
  expect(res).toMatchObject({ ok: true, result: { value: 'cached' } });
  expect(mockNative.secureGet).toHaveBeenCalledWith('session.token');
});

test('secureStore rejects a key with illegal characters', async () => {
  const res = decodeResponse((await call('secureStore.get', { key: 'bad key!' }))!);
  expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } });
});

test('push methods resolve via the stub (push disabled by default)', async () => {
  expect(decodeResponse((await call('push.requestPermission', {}))!)).toMatchObject({
    ok: true,
    result: { granted: false },
  });
  expect(decodeResponse((await call('push.getToken', {}))!)).toMatchObject({
    ok: true,
    result: { token: null },
  });
});

test('an unknown method is rejected at decode time (returns null, not a response)', async () => {
  expect(await call('teleport', {})).toBeNull();
});

test('a non-bridge message returns null', async () => {
  expect(await handleBridgeMessage('just some text', ctx)).toBeNull();
});

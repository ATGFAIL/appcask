import { describe, it, expect } from 'vitest';
import {
  decodeRequest,
  decodeResponse,
  decodeEvent,
  encodeRequest,
  encodeOk,
  encodeError,
  encodeEvent,
  safeStringify,
  BRIDGE_CHANNEL,
  BRIDGE_VERSION,
} from './protocol.js';

const req = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    channel: BRIDGE_CHANNEL,
    version: BRIDGE_VERSION,
    kind: 'request',
    id: 'abc123',
    method: 'haptic',
    params: { type: 'light' },
    ...over,
  });

describe('decodeRequest', () => {
  it('parses a well-formed request', () => {
    expect(decodeRequest(req())).toEqual({
      channel: 'appcask',
      version: 1,
      kind: 'request',
      id: 'abc123',
      method: 'haptic',
      params: { type: 'light' },
    });
  });

  it('defaults missing params to {}', () => {
    expect(decodeRequest(req({ params: undefined }))?.params).toEqual({});
  });

  it.each([
    ['not JSON', '{nope'],
    ['wrong channel', req({ channel: 'other' })],
    ['wrong version', req({ version: 2 })],
    ['wrong kind', req({ kind: 'response' })],
    ['unknown method', req({ method: 'selfDestruct' })],
    ['id too long', req({ id: 'x'.repeat(97) })],
    ['id with bad chars', req({ id: 'a b' })],
    ['params not an object', req({ params: [1, 2] })],
  ])('rejects %s', (_label, raw) => {
    expect(decodeRequest(raw)).toBeNull();
  });
});

describe('decodeResponse', () => {
  it('parses an ok response', () => {
    const raw = encodeOk('abc123', { value: null });
    expect(decodeResponse(raw)).toMatchObject({ id: 'abc123', ok: true, result: { value: null } });
  });

  it('parses an error response', () => {
    const raw = encodeError('abc123', 'TIMEOUT', 'took too long');
    expect(decodeResponse(raw)).toMatchObject({
      id: 'abc123',
      ok: false,
      error: { code: 'TIMEOUT', message: 'took too long' },
    });
  });

  it('rejects an error response with an unknown code', () => {
    const raw = JSON.stringify({
      channel: 'appcask',
      version: 1,
      kind: 'response',
      id: 'abc123',
      ok: false,
      error: { code: 'KABOOM', message: 'x' },
    });
    expect(decodeResponse(raw)).toBeNull();
  });
});

describe('decodeEvent', () => {
  it('parses a known event', () => {
    const raw = encodeEvent('network', { online: false });
    expect(decodeEvent(raw)).toEqual({
      channel: 'appcask',
      version: 1,
      kind: 'event',
      name: 'network',
      detail: { online: false },
    });
  });

  it('rejects an unknown event name', () => {
    expect(decodeEvent(encodeEvent('mystery' as never, {}))).toBeNull();
  });
});

describe('round trips', () => {
  it('encodeRequest -> decodeRequest', () => {
    const decoded = decodeRequest(encodeRequest('id-1', 'navigate', { url: 'https://x.example/' }));
    expect(decoded).toMatchObject({ method: 'navigate', params: { url: 'https://x.example/' } });
  });
});

describe('safeStringify', () => {
  it('escapes < and the U+2028 / U+2029 separators', () => {
    const seps = String.fromCharCode(0x2028) + String.fromCharCode(0x2029);
    const out = safeStringify({ a: '</script>', b: seps });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(JSON.parse(out)).toEqual({ a: '</script>', b: seps });
  });
});

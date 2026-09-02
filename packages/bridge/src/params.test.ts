import { describe, it, expect } from 'vitest';
import { onlyParams, stringParam, numberParam, unitParam, enumParam, urlParam } from './params.js';
import { BridgeError } from './errors.js';

describe('onlyParams', () => {
  it('passes when every key is allowed', () => {
    expect(() => onlyParams({ a: 1, b: 2 }, ['a', 'b', 'c'])).not.toThrow();
  });
  it('throws INVALID_ARGUMENT on an extra key', () => {
    try {
      onlyParams({ a: 1, sneaky: 2 }, ['a']);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BridgeError);
      expect((e as BridgeError).code).toBe('INVALID_ARGUMENT');
    }
  });
});

describe('stringParam', () => {
  it('trims and returns', () => {
    expect(stringParam({ k: '  hi  ' }, 'k')).toBe('hi');
  });
  it('rejects a non-string', () => {
    expect(() => stringParam({ k: 5 }, 'k')).toThrow(BridgeError);
  });
  it('rejects an empty string unless allowEmpty', () => {
    expect(() => stringParam({ k: '   ' }, 'k')).toThrow(BridgeError);
    expect(stringParam({ k: '' }, 'k', { allowEmpty: true })).toBe('');
  });
  it('enforces max length', () => {
    expect(() => stringParam({ k: 'abcdef' }, 'k', { max: 3 })).toThrow(BridgeError);
  });
  it('returns null for a missing optional', () => {
    expect(stringParam({}, 'k', { optional: true })).toBeNull();
  });
});

describe('numberParam / unitParam', () => {
  it('rejects NaN and Infinity', () => {
    expect(() => numberParam({ k: NaN }, 'k')).toThrow(BridgeError);
    expect(() => numberParam({ k: Infinity }, 'k')).toThrow(BridgeError);
  });
  it('enforces range', () => {
    expect(() => numberParam({ k: 11 }, 'k', { min: 0, max: 10 })).toThrow(BridgeError);
  });
  it('unitParam clamps to [0,1]', () => {
    expect(unitParam({ k: 0.5 }, 'k')).toBe(0.5);
    expect(() => unitParam({ k: 1.5 }, 'k')).toThrow(BridgeError);
  });
});

describe('enumParam', () => {
  it('accepts a member', () => {
    expect(enumParam({ k: 'b' }, 'k', ['a', 'b'] as const)).toBe('b');
  });
  it('rejects a non-member', () => {
    expect(() => enumParam({ k: 'z' }, 'k', ['a', 'b'] as const)).toThrow(BridgeError);
  });
});

describe('urlParam', () => {
  it('accepts https', () => {
    expect(urlParam({ k: 'https://x.example/a' }, 'k')).toBe('https://x.example/a');
  });
  it('rejects http by default', () => {
    expect(() => urlParam({ k: 'http://x.example' }, 'k')).toThrow(BridgeError);
  });
  it('allows http when allowInsecure', () => {
    expect(urlParam({ k: 'http://x.example/' }, 'k', { allowInsecure: true })).toBe('http://x.example/');
  });
  it('rejects a non-URL', () => {
    expect(() => urlParam({ k: 'not a url' }, 'k')).toThrow(BridgeError);
  });
  it('rejects javascript: and data: schemes', () => {
    expect(() => urlParam({ k: 'javascript:alert(1)' }, 'k')).toThrow(BridgeError);
    expect(() => urlParam({ k: 'data:text/html,x' }, 'k')).toThrow(BridgeError);
  });
});

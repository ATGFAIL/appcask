import { describe, it, expect } from 'vitest';
import {
  parseManifest,
  manifestGate,
  reduceHealth,
  compareVersions,
  INITIAL_HEALTH,
  type HealthPolicy,
} from './updates.js';

describe('parseManifest', () => {
  it('keeps only recognised fields', () => {
    const m = parseManifest(
      JSON.stringify({
        startUrl: 'https://site.com/v2',
        blocked: false,
        message: 'hi',
        minShellVersion: '1.2.0',
        extra: 'ignored',
      }),
    );
    expect(m).toEqual({ startUrl: 'https://site.com/v2', blocked: false, message: 'hi', minShellVersion: '1.2.0' });
  });

  it('drops an http startUrl and a bad version', () => {
    const m = parseManifest(JSON.stringify({ startUrl: 'http://x', minShellVersion: 'v1' }));
    expect(m).toEqual({});
  });

  it('returns null for non-JSON or non-object', () => {
    expect(parseManifest('nope')).toBeNull();
    expect(parseManifest('[1,2]')).toBeNull();
  });
});

describe('manifestGate', () => {
  it('does not stop with no manifest', () => {
    expect(manifestGate(null, '1.0.0')).toEqual({ stop: false });
  });
  it('stops when blocked', () => {
    expect(manifestGate({ blocked: true, message: 'back at 3am' }, '1.0.0')).toEqual({
      stop: true,
      reason: 'blocked',
      message: 'back at 3am',
    });
  });
  it('stops an outdated shell', () => {
    expect(manifestGate({ minShellVersion: '2.0.0' }, '1.9.9').stop).toBe(true);
    expect(manifestGate({ minShellVersion: '2.0.0' }, '2.0.0').stop).toBe(false);
  });
});

describe('compareVersions', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.2.0', '1.10.0', -1],
    ['2.0.0', '1.9.9', 1],
    ['0.1.0', '0.0.9', 1],
  ])('%s vs %s', (a, b, want) => {
    expect(compareVersions(a, b)).toBe(want);
  });
});

describe('reduceHealth', () => {
  const policy: HealthPolicy = { maxFailures: 2, onUnhealthy: 'previous' };

  it('records the URL as last-good on success and clears failures', () => {
    const r = reduceHealth({ failures: 1, lastGoodUrl: null }, { healthy: true, url: 'https://a/x' }, policy);
    expect(r.state).toEqual({ failures: 0, lastGoodUrl: 'https://a/x' });
    expect(r.action).toEqual({ type: 'none' });
  });

  it('retries below the failure threshold', () => {
    const r = reduceHealth(INITIAL_HEALTH, { healthy: false, url: 'https://a/bad' }, policy);
    expect(r).toEqual({ state: { failures: 1, lastGoodUrl: null }, action: { type: 'retry' } });
  });

  it('falls back to the last-good URL at the threshold', () => {
    const r = reduceHealth(
      { failures: 1, lastGoodUrl: 'https://a/good' },
      { healthy: false, url: 'https://a/bad' },
      policy,
    );
    expect(r.action).toEqual({ type: 'load', url: 'https://a/good' });
    expect(r.state.failures).toBe(0);
  });

  it('shows the offline screen at the threshold when there is nothing to fall back to', () => {
    const r = reduceHealth({ failures: 1, lastGoodUrl: null }, { healthy: false, url: 'https://a/bad' }, policy);
    expect(r.action).toEqual({ type: 'offline-screen' });
  });

  it('onUnhealthy: retry loops instead of the offline screen', () => {
    const r = reduceHealth(
      { failures: 1, lastGoodUrl: null },
      { healthy: false, url: 'https://a/bad' },
      { maxFailures: 2, onUnhealthy: 'retry' },
    );
    expect(r.action).toEqual({ type: 'retry' });
    expect(r.state.failures).toBe(0);
  });

  it('does not fall back to the same URL that is failing', () => {
    const r = reduceHealth(
      { failures: 1, lastGoodUrl: 'https://a/x' },
      { healthy: false, url: 'https://a/x' },
      policy,
    );
    expect(r.action).toEqual({ type: 'offline-screen' });
  });
});

import {
  getRateLimitTracker,
  parseTrustProxySetting,
  positiveInteger,
} from './rate-limit.util';

describe('rate limit utilities', () => {
  it('uses the first address supplied by a configured trusted proxy', () => {
    expect(
      getRateLimitTracker({
        ip: '127.0.0.1',
        ips: ['203.0.113.10', '127.0.0.1'],
      }),
    ).toBe('203.0.113.10');
  });

  it('falls back to the direct socket address', () => {
    expect(
      getRateLimitTracker({ socket: { remoteAddress: '192.0.2.15' } }),
    ).toBe('192.0.2.15');
  });

  it('parses disabled, hop-count, and named proxy settings', () => {
    expect(parseTrustProxySetting()).toBe(false);
    expect(parseTrustProxySetting('false')).toBe(false);
    expect(parseTrustProxySetting('1')).toBe(1);
    expect(parseTrustProxySetting('loopback')).toBe('loopback');
  });

  it('uses safe positive integer configuration values', () => {
    expect(positiveInteger('250', 100)).toBe(250);
    expect(positiveInteger('-1', 100)).toBe(100);
    expect(positiveInteger('invalid', 100)).toBe(100);
  });
});

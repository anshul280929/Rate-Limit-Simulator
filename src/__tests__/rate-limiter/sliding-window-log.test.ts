import { SlidingWindowLogLimiter } from '@/lib/rate-limiter/algorithms/sliding-window-log';

describe('SlidingWindowLogLimiter', () => {
  let limiter: SlidingWindowLogLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    limiter = new SlidingWindowLogLimiter({
      windowMs: 10_000,
      maxRequests: 5,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it('rejects requests beyond the limit', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('old timestamps expire and free up capacity', () => {
    // Send 5 requests at t=0
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    // Advance past the window — all timestamps expire
    jest.advanceTimersByTime(10_001);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('partially expired timestamps free proportional capacity', () => {
    // Send 3 requests at t=0
    for (let i = 0; i < 3; i++) {
      limiter.check('user-1');
    }

    // Advance 5s — requests still within window
    jest.advanceTimersByTime(5000);

    // Send 2 more — should be at limit now
    limiter.check('user-1');
    limiter.check('user-1');

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);

    // Advance 5001ms more — first 3 timestamps expire
    jest.advanceTimersByTime(5001);

    // Now we should have room for 3 more
    const afterExpiry = limiter.check('user-1');
    expect(afterExpiry.allowed).toBe(true);
  });

  it('handles multiple keys independently', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    const result = limiter.check('user-2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns correct resetAt pointing to oldest timestamp expiry', () => {
    const baseTime = Date.now();
    limiter.check('user-1');

    jest.advanceTimersByTime(1000);
    const result = limiter.check('user-1');

    // resetAt should be when the first timestamp expires
    expect(result.resetAt).toBe(baseTime + 10_000);
  });

  it('reports algorithm type correctly', () => {
    expect(limiter.algorithm).toBe('sliding-window-log');
  });

  it('reset() clears state for a key', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    limiter.reset('user-1');

    expect(limiter.check('user-1').allowed).toBe(true);
  });
});

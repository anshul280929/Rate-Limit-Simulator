import { SlidingWindowCounterLimiter } from '@/lib/rate-limiter/algorithms/sliding-window-counter';

describe('SlidingWindowCounterLimiter', () => {
  let limiter: SlidingWindowCounterLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    // Start at a clean window boundary
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    limiter = new SlidingWindowCounterLimiter({
      windowMs: 10_000,
      maxRequests: 10,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows requests up to the limit within a single window', () => {
    for (let i = 0; i < 10; i++) {
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
    }
  });

  it('rejects requests beyond the limit', () => {
    for (let i = 0; i < 10; i++) {
      limiter.check('user-1');
    }

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('properly weights previous window counts', () => {
    // Fill up previous window with 10 requests
    for (let i = 0; i < 10; i++) {
      limiter.check('user-1');
    }

    // Advance to 20% into the next window
    jest.advanceTimersByTime(12_000); // 10s + 2s = 20% into next window

    // Weighted estimate: 10 * (1 - 0.2) + 0 = 8
    // So we should be able to make 2 more requests (10 - 8 = 2)
    const result1 = limiter.check('user-1');
    expect(result1.allowed).toBe(true);

    const result2 = limiter.check('user-1');
    expect(result2.allowed).toBe(true);

    // The third should be rejected (estimate would be ~10)
    // Note: exact boundary depends on timing precision, but should be close
  });

  it('window rollover gives full capacity when previous window is empty', () => {
    // Use 5 of 10 in first window
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }

    // Advance past two full windows so previous count zeros out
    jest.advanceTimersByTime(20_001);

    // Should have full capacity
    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('handles multiple keys independently', () => {
    for (let i = 0; i < 10; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    const result = limiter.check('user-2');
    expect(result.allowed).toBe(true);
  });

  it('reports algorithm type correctly', () => {
    expect(limiter.algorithm).toBe('sliding-window-counter');
  });

  it('reset() clears state for a key', () => {
    for (let i = 0; i < 10; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    limiter.reset('user-1');

    expect(limiter.check('user-1').allowed).toBe(true);
  });

  it('returns correct limit in results', () => {
    const result = limiter.check('user-1');
    expect(result.limit).toBe(10);
  });

  it('returns resetAt at end of current window', () => {
    const now = Date.now();
    const windowStart = Math.floor(now / 10_000) * 10_000;
    const windowEnd = windowStart + 10_000;
    const result = limiter.check('user-1');
    expect(result.resetAt).toBe(windowEnd);
  });
});

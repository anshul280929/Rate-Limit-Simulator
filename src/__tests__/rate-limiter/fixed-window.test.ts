import { FixedWindowLimiter } from '@/lib/rate-limiter/algorithms/fixed-window';
import { MemoryStore } from '@/lib/rate-limiter/stores/memory-store';

describe('FixedWindowLimiter', () => {
  let limiter: FixedWindowLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    limiter = new FixedWindowLimiter({
      windowMs: 10_000, // 10 second window
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
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(10_000);
  });

  it('resets counter when window rolls over', () => {
    // Exhaust limit in first window
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    // Advance to next window
    jest.advanceTimersByTime(10_000);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('handles multiple keys independently', () => {
    // Exhaust limit for user-1
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    // user-2 should still have full quota
    const result = limiter.check('user-2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns correct limit in every result', () => {
    const result = limiter.check('user-1');
    expect(result.limit).toBe(5);

    // Exhaust and check rejected result too
    for (let i = 0; i < 5; i++) limiter.check('user-1');
    const rejected = limiter.check('user-1');
    expect(rejected.limit).toBe(5);
  });

  it('returns a resetAt in the future', () => {
    const now = Date.now();
    const result = limiter.check('user-1');
    expect(result.resetAt).toBeGreaterThan(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + 10_000);
  });

  it('reset() clears state for a key', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    limiter.reset('user-1');

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('reports algorithm type correctly', () => {
    expect(limiter.algorithm).toBe('fixed-window');
  });

  it('accepts an injected store', () => {
    const store = new MemoryStore<{ count: number; windowStart: number }>();
    const customLimiter = new FixedWindowLimiter(
      { windowMs: 10_000, maxRequests: 3 },
      store,
    );

    customLimiter.check('key');
    expect(store.get('key')).toBeDefined();
  });
});

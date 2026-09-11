import { TokenBucketLimiter } from '@/lib/rate-limiter/algorithms/token-bucket';

describe('TokenBucketLimiter', () => {
  let limiter: TokenBucketLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    limiter = new TokenBucketLimiter({
      windowMs: 10_000, // 10 second window
      maxRequests: 5,   // 5 tokens total, refills 0.5 tokens/sec
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with a full bucket and allows burst up to bucket size', () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it('rejects when bucket is empty', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('tokens refill over time', () => {
    // Empty the bucket
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    // Advance enough time for all tokens to refill (10 seconds at 0.5/sec = 5 tokens)
    jest.advanceTimersByTime(10_000);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    // Should have 5 tokens (full) minus 1 consumed = 4
    expect(result.remaining).toBe(4);
  });

  it('partial refill after short time', () => {
    // Empty the bucket
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }

    // Advance 2 seconds — 0.5 tokens/sec × 2s = 1 token refilled
    jest.advanceTimersByTime(2000);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // consumed the 1 refilled token
  });

  it('bucket does not exceed max capacity', () => {
    // Wait a very long time — tokens should cap at bucket size
    jest.advanceTimersByTime(100_000);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // capped at 5, consumed 1
  });

  it('handles multiple keys independently', () => {
    // Empty bucket for user-1
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    // user-2 should have full bucket
    const result = limiter.check('user-2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('reports algorithm type correctly', () => {
    expect(limiter.algorithm).toBe('token-bucket');
  });

  it('reset() clears state for a key', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }
    expect(limiter.check('user-1').allowed).toBe(false);

    limiter.reset('user-1');

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // full bucket again
  });

  it('retryAfterMs indicates time until one token refills', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-1');
    }

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
    // 1 token / 0.5 tokens per second = 2000ms
    expect(result.retryAfterMs).toBe(2000);
  });
});

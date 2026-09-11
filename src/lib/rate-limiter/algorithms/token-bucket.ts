import type { RateLimiter, RateLimitConfig, RateLimitResult, RateLimitStore, TokenBucketConfig } from '../types';
import { MemoryStore } from '../stores/memory-store';

// ---------------------------------------------------------------------------
// Token Bucket
// ---------------------------------------------------------------------------

interface BucketState {
  tokens: number;
  lastRefillAt: number;
}

/**
 * Classic token bucket — tokens refill at a constant rate, each request
 * consumes one token. Allows controlled bursts (up to bucket size) while
 * maintaining a steady average throughput.
 *
 * This is what AWS API Gateway uses. The industry workhorse.
 *
 * Key design choice: **lazy refill** — tokens are not added by a background
 * timer. Instead, on each `check()` call we calculate how many tokens have
 * accrued since the last call and add them (capped at bucket size). This is
 * the standard pattern — no timers, no drift, O(1) per check.
 */
export class TokenBucketLimiter implements RateLimiter {
  readonly algorithm = 'token-bucket' as const;

  private store: RateLimitStore<BucketState>;
  private bucketSize: number;
  private refillRate: number; // tokens per millisecond
  private windowMs: number;

  constructor(config: TokenBucketConfig, store?: RateLimitStore<BucketState>) {
    this.windowMs = config.windowMs;
    this.bucketSize = config.bucketSize ?? config.maxRequests;
    // Derive refill rate: fill the bucket exactly once per window
    const refillPerSecond = (config.refillRate ?? config.maxRequests / (config.windowMs / 1000));
    this.refillRate = refillPerSecond / 1000; // convert to per-ms
    this.store = store ?? new MemoryStore();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    let state = this.store.get(key);

    if (!state) {
      // First request — start with a full bucket
      state = { tokens: this.bucketSize, lastRefillAt: now };
    }

    // Lazy refill: add tokens based on elapsed time
    const elapsed = now - state.lastRefillAt;
    const tokensToAdd = elapsed * this.refillRate;
    state.tokens = Math.min(this.bucketSize, state.tokens + tokensToAdd);
    state.lastRefillAt = now;

    if (state.tokens >= 1) {
      state.tokens -= 1;
      this.store.set(key, state, this.windowMs * 2); // TTL = 2x window for safety

      return {
        allowed: true,
        limit: this.bucketSize,
        remaining: Math.floor(state.tokens),
        resetAt: now + Math.ceil((this.bucketSize - state.tokens) / this.refillRate),
      };
    }

    // Rejected — how long until one token refills?
    const retryAfterMs = Math.ceil(1 / this.refillRate);

    this.store.set(key, state, this.windowMs * 2);

    return {
      allowed: false,
      limit: this.bucketSize,
      remaining: 0,
      resetAt: now + Math.ceil(this.bucketSize / this.refillRate),
      retryAfterMs,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

import type { RateLimiter, RateLimitConfig, RateLimitResult, RateLimitStore } from '../types';
import { MemoryStore } from '../stores/memory-store';

// ---------------------------------------------------------------------------
// Fixed Window Counter
// ---------------------------------------------------------------------------

/**
 * Divides time into fixed-duration windows and counts requests per key per window.
 *
 * Simple and fast, but suffers from the **boundary burst problem**: a client
 * can send `maxRequests` at the end of window N and another `maxRequests` at
 * the start of window N+1, effectively doubling throughput at the boundary.
 *
 * This is the algorithm that breaks hardest in distributed setups — each node
 * keeps its own counter, and N nodes each allow `maxRequests`, producing N×
 * the intended limit. The blog post's "gym doors" problem in code.
 */
export class FixedWindowLimiter implements RateLimiter {
  readonly algorithm = 'fixed-window' as const;

  private store: RateLimitStore<{ count: number; windowStart: number }>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig, store?: RateLimitStore<{ count: number; windowStart: number }>) {
    this.config = config;
    this.store = store ?? new MemoryStore();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const windowEnd = windowStart + this.config.windowMs;

    let state = this.store.get(key);

    // New window or first request — reset counter
    if (!state || state.windowStart !== windowStart) {
      state = { count: 0, windowStart };
    }

    const resetAt = windowEnd;

    if (state.count < this.config.maxRequests) {
      state.count++;
      this.store.set(key, state, this.config.windowMs);

      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - state.count,
        resetAt,
      };
    }

    return {
      allowed: false,
      limit: this.config.maxRequests,
      remaining: 0,
      resetAt,
      retryAfterMs: windowEnd - now,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

import type { RateLimiter, RateLimitConfig, RateLimitResult, RateLimitStore } from '../types';
import { MemoryStore } from '../stores/memory-store';

// ---------------------------------------------------------------------------
// Sliding Window Log
// ---------------------------------------------------------------------------

/**
 * Tracks every request timestamp and counts only those within the sliding window.
 *
 * Perfectly accurate — no boundary burst problem — but uses O(n) memory per
 * key where n = number of requests in the window. At high throughput this
 * becomes expensive, which is exactly the trade-off it's here to demonstrate.
 *
 * On each check:
 * 1. Remove timestamps older than `now - windowMs`
 * 2. Count remaining timestamps
 * 3. If count < maxRequests, push `now` and allow
 *
 * `resetAt` points to when the oldest active timestamp will expire,
 * freeing one slot.
 */
export class SlidingWindowLogLimiter implements RateLimiter {
  readonly algorithm = 'sliding-window-log' as const;

  private store: RateLimitStore<{ timestamps: number[] }>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig, store?: RateLimitStore<{ timestamps: number[] }>) {
    this.config = config;
    this.store = store ?? new MemoryStore();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let state = this.store.get(key);
    if (!state) {
      state = { timestamps: [] };
    }

    // Evict expired timestamps
    state.timestamps = state.timestamps.filter((ts) => ts > windowStart);

    if (state.timestamps.length < this.config.maxRequests) {
      state.timestamps.push(now);
      this.store.set(key, state, this.config.windowMs);

      const remaining = this.config.maxRequests - state.timestamps.length;
      // Reset = when the oldest active timestamp expires
      const resetAt = state.timestamps.length > 0
        ? state.timestamps[0] + this.config.windowMs
        : now + this.config.windowMs;

      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining,
        resetAt,
      };
    }

    // Rejected — oldest timestamp determines when a slot opens
    const resetAt = state.timestamps[0] + this.config.windowMs;

    // Still persist the filtered state (we cleaned up expired entries)
    this.store.set(key, state, this.config.windowMs);

    return {
      allowed: false,
      limit: this.config.maxRequests,
      remaining: 0,
      resetAt,
      retryAfterMs: resetAt - now,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

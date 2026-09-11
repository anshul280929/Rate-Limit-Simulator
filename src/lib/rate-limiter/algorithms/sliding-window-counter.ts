import type { RateLimiter, RateLimitConfig, RateLimitResult, RateLimitStore } from '../types';
import { MemoryStore } from '../stores/memory-store';

// ---------------------------------------------------------------------------
// Sliding Window Counter
// ---------------------------------------------------------------------------

interface WindowCounterState {
  currentWindowStart: number;
  currentCount: number;
  previousCount: number;
}

/**
 * Approximates a true sliding window using weighted counters from the current
 * and previous fixed windows.
 *
 *   estimate = previousCount × (1 - elapsedRatio) + currentCount
 *
 * Where `elapsedRatio = (now - currentWindowStart) / windowMs`.
 *
 * This gives near-perfect accuracy with O(1) memory — just two integers per
 * key instead of the sliding-window-log's unbounded timestamp array.
 *
 * **This is what Cloudflare uses.** It's the "hybrid" from the blog post —
 * the sweet spot between the naive fixed window and the memory-heavy log.
 */
export class SlidingWindowCounterLimiter implements RateLimiter {
  readonly algorithm = 'sliding-window-counter' as const;

  private store: RateLimitStore<WindowCounterState>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig, store?: RateLimitStore<WindowCounterState>) {
    this.config = config;
    this.store = store ?? new MemoryStore();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const windowEnd = currentWindowStart + this.config.windowMs;

    let state = this.store.get(key);

    if (!state) {
      state = { currentWindowStart, currentCount: 0, previousCount: 0 };
    }

    // Did the window just roll over?
    if (state.currentWindowStart !== currentWindowStart) {
      // Check if we jumped more than one window (long idle period)
      if (currentWindowStart - state.currentWindowStart >= this.config.windowMs * 2) {
        // Two or more windows passed — previous is zeroed out
        state.previousCount = 0;
      } else {
        // Normal rollover — current becomes previous
        state.previousCount = state.currentCount;
      }
      state.currentCount = 0;
      state.currentWindowStart = currentWindowStart;
    }

    // Weighted estimate
    const elapsedInWindow = now - currentWindowStart;
    const elapsedRatio = elapsedInWindow / this.config.windowMs;
    const estimate = state.previousCount * (1 - elapsedRatio) + state.currentCount;

    if (estimate < this.config.maxRequests) {
      state.currentCount++;
      // Store with TTL of 2 windows so previous-window data survives
      this.store.set(key, state, this.config.windowMs * 2);

      const newEstimate = state.previousCount * (1 - elapsedRatio) + state.currentCount;
      const remaining = Math.max(0, Math.floor(this.config.maxRequests - newEstimate));

      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining,
        resetAt: windowEnd,
      };
    }

    // Rejected
    this.store.set(key, state, this.config.windowMs * 2);

    return {
      allowed: false,
      limit: this.config.maxRequests,
      remaining: 0,
      resetAt: windowEnd,
      retryAfterMs: windowEnd - now,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

import type { RateLimitStore } from '../types';

// ---------------------------------------------------------------------------
// In-memory store with TTL-based expiry
// ---------------------------------------------------------------------------

interface StoreEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Map-backed in-memory store with per-key TTL expiry.
 *
 * A periodic cleanup sweep runs every `cleanupIntervalMs` to evict expired
 * entries, preventing unbounded memory growth from abandoned keys. Individual
 * reads also check expiry lazily — a key past its TTL returns `undefined`.
 *
 * Trade-off: simple and fast (O(1) per op), but not shared across processes.
 * For distributed deployments, swap in a Redis-backed store implementing the
 * same `RateLimitStore<T>` interface.
 */
export class MemoryStore<T> implements RateLimitStore<T> {
  private store = new Map<string, StoreEntry<T>>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private cleanupIntervalMs: number = 60_000) {
    this.startCleanup();
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Stop the background cleanup timer (call on shutdown). */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Visible for testing — number of entries currently held. */
  get size(): number {
    return this.store.size;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (now >= entry.expiresAt) {
          this.store.delete(key);
        }
      }
    }, this.cleanupIntervalMs);

    // Don't let the cleanup timer keep the process alive
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }
}

/**
 * Core type definitions for the RateGate rate limiter.
 *
 * Design: Strategy pattern — every algorithm implements the same `RateLimiter`
 * interface, making them interchangeable at runtime. The `RateLimitStore`
 * abstraction decouples storage from algorithm logic (in-memory now, Redis later).
 */

// ---------------------------------------------------------------------------
// Algorithm registry
// ---------------------------------------------------------------------------

export type AlgorithmType =
  | 'fixed-window'
  | 'sliding-window-log'
  | 'token-bucket'
  | 'sliding-window-counter';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Base configuration shared by all algorithms. */
export interface RateLimitConfig {
  /** Window duration in milliseconds (e.g. 60_000 for 1 minute). */
  windowMs: number;
  /** Maximum requests allowed per window. */
  maxRequests: number;
}

/** Extended config for token bucket — derives defaults from base if omitted. */
export interface TokenBucketConfig extends RateLimitConfig {
  /** Maximum tokens the bucket can hold. Defaults to `maxRequests`. */
  bucketSize?: number;
  /** Tokens added per second. Defaults to `maxRequests / (windowMs / 1000)`. */
  refillRate?: number;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Returned by every `check()` call — enough to populate standard rate-limit headers. */
export interface RateLimitResult {
  /** Whether the request was allowed through. */
  allowed: boolean;
  /** Configured max requests for this window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  resetAt: number;
  /** Milliseconds to wait before retrying. Present only when `allowed` is false. */
  retryAfterMs?: number;
}

// ---------------------------------------------------------------------------
// Strategy interface
// ---------------------------------------------------------------------------

/** All rate-limiting algorithms implement this interface. */
export interface RateLimiter {
  /** Check whether a request identified by `key` should be allowed. */
  check(key: string): RateLimitResult;
  /** Reset all state for a given key. */
  reset(key: string): void;
  /** The algorithm type this limiter implements. */
  readonly algorithm: AlgorithmType;
}

// ---------------------------------------------------------------------------
// Store abstraction
// ---------------------------------------------------------------------------

/**
 * Generic key-value store with TTL support.
 *
 * Algorithms use this to persist their per-key state. The generic parameter `T`
 * lets each algorithm store its own state shape without type casts.
 */
export interface RateLimitStore<T> {
  /** Retrieve state for a key, or `undefined` if missing/expired. */
  get(key: string): T | undefined;
  /** Store state for a key with a time-to-live in milliseconds. */
  set(key: string, value: T, ttlMs: number): void;
  /** Remove a single key. */
  delete(key: string): void;
  /** Remove all keys. */
  clear(): void;
}

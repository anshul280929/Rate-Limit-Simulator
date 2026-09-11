/**
 * RateGate — Rate Limiter Module
 *
 * Public API barrel export. Import everything from `@/lib/rate-limiter`.
 *
 * @example
 * ```ts
 * import { createRateLimiter, type AlgorithmType } from '@/lib/rate-limiter';
 * ```
 */

// Types
export type {
  AlgorithmType,
  RateLimitConfig,
  RateLimitResult,
  RateLimiter,
  RateLimitStore,
  TokenBucketConfig,
} from './types';

// Factory
export { createRateLimiter } from './factory';

// Algorithms (for direct instantiation if needed)
export { FixedWindowLimiter } from './algorithms/fixed-window';
export { SlidingWindowLogLimiter } from './algorithms/sliding-window-log';
export { TokenBucketLimiter } from './algorithms/token-bucket';
export { SlidingWindowCounterLimiter } from './algorithms/sliding-window-counter';

// Stores
export { MemoryStore } from './stores/memory-store';

import type { AlgorithmType, RateLimiter, RateLimitConfig } from './types';
import { FixedWindowLimiter } from './algorithms/fixed-window';
import { SlidingWindowLogLimiter } from './algorithms/sliding-window-log';
import { TokenBucketLimiter } from './algorithms/token-bucket';
import { SlidingWindowCounterLimiter } from './algorithms/sliding-window-counter';

/**
 * Factory function — creates a rate limiter for the specified algorithm.
 *
 * This is the primary entry point for consumers. Pass an algorithm type
 * and config, get back a ready-to-use `RateLimiter`. Changing the algorithm
 * at runtime is as simple as calling this function again.
 *
 * @example
 * ```ts
 * const limiter = createRateLimiter('token-bucket', {
 *   windowMs: 60_000,
 *   maxRequests: 100,
 * });
 *
 * const result = limiter.check('user-123');
 * if (!result.allowed) {
 *   // Return 429
 * }
 * ```
 */
export function createRateLimiter(
  algorithm: AlgorithmType,
  config: RateLimitConfig,
): RateLimiter {
  switch (algorithm) {
    case 'fixed-window':
      return new FixedWindowLimiter(config);
    case 'sliding-window-log':
      return new SlidingWindowLogLimiter(config);
    case 'token-bucket':
      return new TokenBucketLimiter(config);
    case 'sliding-window-counter':
      return new SlidingWindowCounterLimiter(config);
    default: {
      // Exhaustive check — TypeScript will error if a new AlgorithmType is
      // added without a corresponding case here.
      const _exhaustive: never = algorithm;
      throw new Error(`Unknown algorithm: ${_exhaustive}`);
    }
  }
}

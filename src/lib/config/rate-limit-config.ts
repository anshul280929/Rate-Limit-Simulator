/**
 * Global rate-limit configuration singleton.
 *
 * Manages the active algorithm and per-tier limiter instances. The dashboard
 * (Phase 4) and config API both mutate this state to switch algorithms
 * at runtime.
 *
 * Design: a module-level singleton is the simplest correct approach for
 * Next.js API routes, which share the same Node.js process. In a
 * multi-process deployment you'd move this to Redis — but that's v2.
 */

import type { AlgorithmType, RateLimiter, RateLimitConfig } from '@/lib/rate-limiter/types';
import { createRateLimiter } from '@/lib/rate-limiter/factory';
import type { RateLimitTier, TierConfig } from '@/lib/api/types';
import { DEFAULT_TIER_CONFIGS } from '@/lib/api/types';

interface RateLimitState {
  algorithm: AlgorithmType;
  tiers: Record<Exclude<RateLimitTier, 'exempt'>, TierConfig>;
  limiters: Map<string, RateLimiter>;
}

const state: RateLimitState = {
  algorithm: 'sliding-window-counter',
  tiers: { ...DEFAULT_TIER_CONFIGS },
  limiters: new Map(),
};

/**
 * Get or lazily create a rate limiter for the given tier.
 * Returns `null` for exempt tier.
 */
export function getLimiter(tier: RateLimitTier): RateLimiter | null {
  if (tier === 'exempt') return null;

  const key = `${tier}:${state.algorithm}`;
  let limiter = state.limiters.get(key);

  if (!limiter) {
    const tierConfig = state.tiers[tier];
    const config: RateLimitConfig = {
      windowMs: tierConfig.windowMs,
      maxRequests: tierConfig.maxRequests,
    };
    limiter = createRateLimiter(state.algorithm, config);
    state.limiters.set(key, limiter);
  }

  return limiter;
}

/**
 * Switch the active algorithm. Clears cached limiter instances so they're
 * recreated on next request with the new algorithm.
 */
export function setAlgorithm(algorithm: AlgorithmType): void {
  state.algorithm = algorithm;
  state.limiters.clear();
}

/**
 * Get current configuration (for the config API and dashboard).
 */
export function getConfig() {
  return {
    algorithm: state.algorithm,
    tiers: { ...state.tiers },
  };
}

/**
 * Get the current active algorithm type.
 */
export function getAlgorithm(): AlgorithmType {
  return state.algorithm;
}

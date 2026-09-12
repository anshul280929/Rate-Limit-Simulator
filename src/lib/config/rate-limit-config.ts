/**
 * Global rate-limit configuration singleton.
 *
 * Manages the active algorithm, per-tier limiter instances, and the
 * distributed simulation cluster. The dashboard (Phase 4) and config
 * API both mutate this state to switch algorithms at runtime.
 *
 * Design: a module-level singleton is the simplest correct approach for
 * Next.js API routes, which share the same Node.js process. In a
 * multi-process deployment you'd move this to Redis — but that's v2.
 */

import type { AlgorithmType, RateLimiter, RateLimitConfig } from '@/lib/rate-limiter/types';
import { createRateLimiter } from '@/lib/rate-limiter/factory';
import type { RateLimitTier, TierConfig } from '@/lib/api/types';
import { DEFAULT_TIER_CONFIGS } from '@/lib/api/types';
import { NodeCluster } from '@/lib/simulation/node-cluster';

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

// Singleton cluster for the distributed simulation
let cluster: NodeCluster | null = null;

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
 * recreated on next request with the new algorithm. Also updates the
 * simulation cluster if it exists.
 */
export function setAlgorithm(algorithm: AlgorithmType): void {
  state.algorithm = algorithm;
  state.limiters.clear();

  if (cluster) {
    cluster.setAlgorithm(algorithm);
  }
}

/**
 * Get current configuration (for the config API and dashboard).
 */
export function getConfig() {
  return {
    algorithm: state.algorithm,
    tiers: { ...state.tiers },
    simulation: cluster ? cluster.getState() : null,
  };
}

/**
 * Get the current active algorithm type.
 */
export function getAlgorithm(): AlgorithmType {
  return state.algorithm;
}

/**
 * Get or lazily create the simulation cluster singleton.
 * Default: 3 nodes, fixed-window algorithm (best for demonstrating the problem).
 */
export function getCluster(): NodeCluster {
  if (!cluster) {
    cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });
  }
  return cluster;
}

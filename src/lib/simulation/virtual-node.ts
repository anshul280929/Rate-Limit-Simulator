/**
 * VirtualNode — wraps a RateLimiter with per-node metrics tracking.
 *
 * Each virtual node simulates a separate server process (or container)
 * that handles a fraction of incoming traffic. In the real world, each
 * of these would be a separate Node.js instance behind a load balancer.
 *
 * The node can operate in two modes:
 * - **Own limiter**: each node has its own independent limiter (broken distributed setup)
 * - **External limiter**: all nodes share one limiter (the coordinated fix)
 */

import type { RateLimiter, RateLimitResult } from '@/lib/rate-limiter/types';
import type { NodeMetrics } from './types';

export class VirtualNode {
  private allowed = 0;
  private rejected = 0;

  constructor(
    readonly nodeId: number,
    private limiter: RateLimiter,
  ) {}

  /**
   * Check whether a request should be allowed.
   * Delegates to the internal limiter and tracks metrics.
   */
  check(key: string): RateLimitResult {
    const result = this.limiter.check(key);

    if (result.allowed) {
      this.allowed++;
    } else {
      this.rejected++;
    }

    return result;
  }

  /** Swap the limiter (used when switching algorithms or modes). */
  setLimiter(limiter: RateLimiter): void {
    this.limiter = limiter;
  }

  /** Get current metrics for this node. */
  getMetrics(): NodeMetrics {
    return {
      nodeId: this.nodeId,
      allowed: this.allowed,
      rejected: this.rejected,
      total: this.allowed + this.rejected,
    };
  }

  /** Reset counters and limiter state. */
  reset(key?: string): void {
    this.allowed = 0;
    this.rejected = 0;
    if (key) {
      this.limiter.reset(key);
    }
  }
}

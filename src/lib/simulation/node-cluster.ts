/**
 * NodeCluster — the distributed rate-limiter simulation engine.
 *
 * Manages N virtual nodes behind a round-robin "load balancer". This is
 * the core of the project — it makes the blog's "gym doors" problem
 * concrete and observable.
 *
 * In **independent** mode, each node has its own RateLimiter instance.
 * A limit of 100 req/min across 3 nodes effectively becomes 300 req/min
 * because each node independently allows 100. This is the bug.
 *
 * In **coordinated** mode, all nodes share a single RateLimiter instance.
 * The limit stays at 100 regardless of node count. This is the fix.
 */

import type { AlgorithmType, RateLimitConfig } from '@/lib/rate-limiter/types';
import { createRateLimiter } from '@/lib/rate-limiter/factory';
import { VirtualNode } from './virtual-node';
import type { ClusterMode, ClusterMetrics, SimulationResult } from './types';

const DEFAULT_NODE_COUNT = 3;
const DEFAULT_CONFIG: RateLimitConfig = { windowMs: 60_000, maxRequests: 100 };

export class NodeCluster {
  private nodes: VirtualNode[] = [];
  private mode: ClusterMode = 'independent';
  private algorithm: AlgorithmType;
  private config: RateLimitConfig;
  private roundRobinIndex = 0;

  constructor(
    nodeCount: number = DEFAULT_NODE_COUNT,
    algorithm: AlgorithmType = 'fixed-window',
    config: RateLimitConfig = DEFAULT_CONFIG,
  ) {
    this.algorithm = algorithm;
    this.config = config;
    this.buildNodes(nodeCount);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Route a single request through the cluster.
   * Round-robin picks the target node (simulating a load balancer).
   */
  routeRequest(key: string): SimulationResult {
    const node = this.nodes[this.roundRobinIndex % this.nodes.length];
    this.roundRobinIndex++;

    const result = node.check(key);

    return {
      nodeId: node.nodeId,
      allowed: result.allowed,
      remaining: result.remaining,
    };
  }

  /**
   * Fire a batch of requests through the cluster.
   * Returns per-request results — useful for dashboard burst visualization.
   */
  fireRequests(key: string, count: number): SimulationResult[] {
    const results: SimulationResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.routeRequest(key));
    }
    return results;
  }

  /**
   * Switch between independent and coordinated mode.
   * Resets all state because the limiter topology changes.
   */
  setMode(mode: ClusterMode): void {
    this.mode = mode;
    this.rebuildLimiters();
  }

  /**
   * Switch the rate-limiting algorithm.
   * Rebuilds all limiter instances.
   */
  setAlgorithm(algorithm: AlgorithmType): void {
    this.algorithm = algorithm;
    this.rebuildLimiters();
  }

  /**
   * Change the number of nodes in the cluster.
   * Rebuilds the entire cluster.
   */
  setNodeCount(count: number): void {
    const safeCount = Math.max(1, Math.min(10, count));
    this.buildNodes(safeCount);
  }

  /** Get comprehensive metrics for the cluster and each node. */
  getMetrics(): ClusterMetrics {
    const nodeMetrics = this.nodes.map((n) => n.getMetrics());
    const aggregate = nodeMetrics.reduce(
      (acc, m) => ({
        allowed: acc.allowed + m.allowed,
        rejected: acc.rejected + m.rejected,
        total: acc.total + m.total,
      }),
      { allowed: 0, rejected: 0, total: 0 },
    );

    return {
      mode: this.mode,
      nodeCount: this.nodes.length,
      nodes: nodeMetrics,
      aggregate: {
        ...aggregate,
        effectiveRate: this.config.maxRequests > 0
          ? aggregate.allowed / this.config.maxRequests
          : 0,
        intendedLimit: this.config.maxRequests,
      },
    };
  }

  /** Reset all node counters and limiter state. */
  reset(): void {
    this.roundRobinIndex = 0;
    this.nodes.forEach((n) => n.reset('*'));
    this.rebuildLimiters();
  }

  /** Get current cluster configuration. */
  getState() {
    return {
      mode: this.mode,
      nodeCount: this.nodes.length,
      algorithm: this.algorithm,
      config: { ...this.config },
    };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private buildNodes(count: number): void {
    this.roundRobinIndex = 0;

    if (this.mode === 'coordinated') {
      // All nodes share one limiter
      const shared = createRateLimiter(this.algorithm, this.config);
      this.nodes = Array.from({ length: count }, (_, i) => new VirtualNode(i, shared));
    } else {
      // Each node gets its own independent limiter
      this.nodes = Array.from({ length: count }, (_, i) =>
        new VirtualNode(i, createRateLimiter(this.algorithm, this.config)),
      );
    }
  }

  private rebuildLimiters(): void {
    this.roundRobinIndex = 0;
    const count = this.nodes.length;

    if (this.mode === 'coordinated') {
      const shared = createRateLimiter(this.algorithm, this.config);
      this.nodes = Array.from({ length: count }, (_, i) => new VirtualNode(i, shared));
    } else {
      this.nodes = Array.from({ length: count }, (_, i) =>
        new VirtualNode(i, createRateLimiter(this.algorithm, this.config)),
      );
    }
  }
}

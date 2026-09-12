/**
 * Simulation type definitions.
 *
 * These types model the distributed node cluster that demonstrates the
 * "gym doors" problem — N nodes each allowing the full rate limit
 * independently, producing N× the intended throughput.
 */

// ---------------------------------------------------------------------------
// Cluster modes
// ---------------------------------------------------------------------------

/** Independent = each node has its own limiter (broken). Coordinated = shared limiter (fixed). */
export type ClusterMode = 'independent' | 'coordinated';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** Per-node request counters. */
export interface NodeMetrics {
  nodeId: number;
  allowed: number;
  rejected: number;
  total: number;
}

/** Aggregate view across the entire cluster. */
export interface ClusterMetrics {
  mode: ClusterMode;
  nodeCount: number;
  nodes: NodeMetrics[];
  aggregate: {
    allowed: number;
    rejected: number;
    total: number;
    /** Ratio of allowed requests to the intended limit. >1.0 means overshoot. */
    effectiveRate: number;
    /** The configured limit (e.g. 100 req/min). */
    intendedLimit: number;
  };
}

// ---------------------------------------------------------------------------
// Simulation results
// ---------------------------------------------------------------------------

/** Result of routing a single request through the cluster. */
export interface SimulationResult {
  nodeId: number;
  allowed: boolean;
  remaining: number;
}

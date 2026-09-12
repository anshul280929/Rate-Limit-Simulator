import { NodeCluster } from '@/lib/simulation/node-cluster';

describe('NodeCluster', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // THE KEY TESTS — proving the blog's thesis
  // =========================================================================

  it('independent mode: N nodes allow ~N× the intended limit', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    // Fire 300 requests — each node independently allows 100
    const results = cluster.fireRequests('user-1', 300);
    const allowed = results.filter((r) => r.allowed).length;

    // All 300 should be allowed (3 nodes × 100 each)
    expect(allowed).toBe(300);

    const metrics = cluster.getMetrics();
    expect(metrics.aggregate.effectiveRate).toBe(3.0); // 300/100 = 3× overshoot
    expect(metrics.aggregate.intendedLimit).toBe(100);
  });

  it('coordinated mode: total allowed matches intended limit', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });
    cluster.setMode('coordinated');

    // Fire 300 requests — all nodes share one limiter
    const results = cluster.fireRequests('user-1', 300);
    const allowed = results.filter((r) => r.allowed).length;

    // Only 100 should be allowed (shared limiter enforces the real limit)
    expect(allowed).toBe(100);

    const metrics = cluster.getMetrics();
    expect(metrics.aggregate.effectiveRate).toBe(1.0); // 100/100 = correct
  });

  // =========================================================================
  // Round-robin distribution
  // =========================================================================

  it('round-robin distributes requests across nodes', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    const results = cluster.fireRequests('user-1', 9);

    // 9 requests across 3 nodes = 3 each
    expect(results[0].nodeId).toBe(0);
    expect(results[1].nodeId).toBe(1);
    expect(results[2].nodeId).toBe(2);
    expect(results[3].nodeId).toBe(0);
    expect(results[4].nodeId).toBe(1);
    expect(results[5].nodeId).toBe(2);
  });

  it('metrics show per-node breakdown', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 10,
    });

    cluster.fireRequests('user-1', 12); // 4 per node, all allowed

    const metrics = cluster.getMetrics();
    expect(metrics.nodes).toHaveLength(3);
    expect(metrics.nodes[0].allowed).toBe(4);
    expect(metrics.nodes[1].allowed).toBe(4);
    expect(metrics.nodes[2].allowed).toBe(4);
    expect(metrics.aggregate.allowed).toBe(12);
  });

  // =========================================================================
  // Mode switching
  // =========================================================================

  it('setMode resets state', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    cluster.fireRequests('user-1', 50);
    expect(cluster.getMetrics().aggregate.allowed).toBe(50);

    cluster.setMode('coordinated');
    expect(cluster.getMetrics().aggregate.allowed).toBe(0);
    expect(cluster.getMetrics().mode).toBe('coordinated');
  });

  it('setAlgorithm rebuilds limiters', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    cluster.fireRequests('user-1', 50);
    cluster.setAlgorithm('token-bucket');

    // State is reset after algorithm change
    expect(cluster.getMetrics().aggregate.allowed).toBe(0);
    expect(cluster.getState().algorithm).toBe('token-bucket');
  });

  // =========================================================================
  // Node count
  // =========================================================================

  it('setNodeCount changes the number of nodes', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    cluster.setNodeCount(5);
    expect(cluster.getMetrics().nodeCount).toBe(5);

    // 5 nodes in independent mode should allow 500
    const results = cluster.fireRequests('user-1', 500);
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(500);
    expect(cluster.getMetrics().aggregate.effectiveRate).toBe(5.0);
  });

  it('clamps node count between 1 and 10', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    cluster.setNodeCount(0);
    expect(cluster.getMetrics().nodeCount).toBe(1);

    cluster.setNodeCount(99);
    expect(cluster.getMetrics().nodeCount).toBe(10);
  });

  // =========================================================================
  // Reset
  // =========================================================================

  it('reset clears all metrics and restarts round-robin', () => {
    const cluster = new NodeCluster(3, 'fixed-window', {
      windowMs: 60_000,
      maxRequests: 100,
    });

    cluster.fireRequests('user-1', 30);
    expect(cluster.getMetrics().aggregate.total).toBe(30);

    cluster.reset();

    const metrics = cluster.getMetrics();
    expect(metrics.aggregate.total).toBe(0);
    expect(metrics.aggregate.allowed).toBe(0);

    // First request should go to node 0 (round-robin restarted)
    const result = cluster.routeRequest('user-1');
    expect(result.nodeId).toBe(0);
  });

  // =========================================================================
  // Works across all algorithms
  // =========================================================================

  it.each([
    'fixed-window',
    'sliding-window-log',
    'token-bucket',
    'sliding-window-counter',
  ] as const)('independent mode overshoot works with %s algorithm', (algo) => {
    const cluster = new NodeCluster(3, algo, {
      windowMs: 60_000,
      maxRequests: 10,
    });

    const results = cluster.fireRequests('user-1', 30);
    const allowed = results.filter((r) => r.allowed).length;

    // Each of 3 nodes should allow 10 independently = 30 total
    expect(allowed).toBe(30);
  });

  it.each([
    'fixed-window',
    'sliding-window-log',
    'token-bucket',
    'sliding-window-counter',
  ] as const)('coordinated mode enforces limit with %s algorithm', (algo) => {
    const cluster = new NodeCluster(3, algo, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    cluster.setMode('coordinated');

    const results = cluster.fireRequests('user-1', 30);
    const allowed = results.filter((r) => r.allowed).length;

    // All 3 nodes share one limiter — only 10 should be allowed
    expect(allowed).toBe(10);
  });

  // =========================================================================
  // getState
  // =========================================================================

  it('getState returns current configuration', () => {
    const cluster = new NodeCluster(4, 'token-bucket', {
      windowMs: 30_000,
      maxRequests: 50,
    });

    const state = cluster.getState();
    expect(state.mode).toBe('independent');
    expect(state.nodeCount).toBe(4);
    expect(state.algorithm).toBe('token-bucket');
    expect(state.config.maxRequests).toBe(50);
  });
});

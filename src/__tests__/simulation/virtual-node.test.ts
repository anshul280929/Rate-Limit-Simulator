import { VirtualNode } from '@/lib/simulation/virtual-node';
import { FixedWindowLimiter } from '@/lib/rate-limiter/algorithms/fixed-window';

describe('VirtualNode', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks allowed count correctly', () => {
    const limiter = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 5 });
    const node = new VirtualNode(0, limiter);

    node.check('key');
    node.check('key');
    node.check('key');

    const metrics = node.getMetrics();
    expect(metrics.allowed).toBe(3);
    expect(metrics.rejected).toBe(0);
    expect(metrics.total).toBe(3);
  });

  it('tracks rejected count correctly', () => {
    const limiter = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 2 });
    const node = new VirtualNode(0, limiter);

    node.check('key'); // allowed
    node.check('key'); // allowed
    node.check('key'); // rejected
    node.check('key'); // rejected

    const metrics = node.getMetrics();
    expect(metrics.allowed).toBe(2);
    expect(metrics.rejected).toBe(2);
    expect(metrics.total).toBe(4);
  });

  it('delegates check to the internal limiter', () => {
    const limiter = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 3 });
    const node = new VirtualNode(0, limiter);

    const result = node.check('key');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(2);
  });

  it('reset clears counters', () => {
    const limiter = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 5 });
    const node = new VirtualNode(0, limiter);

    node.check('key');
    node.check('key');
    node.reset('key');

    const metrics = node.getMetrics();
    expect(metrics.allowed).toBe(0);
    expect(metrics.rejected).toBe(0);
    expect(metrics.total).toBe(0);
  });

  it('reports correct nodeId', () => {
    const limiter = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 5 });
    const node = new VirtualNode(7, limiter);

    expect(node.getMetrics().nodeId).toBe(7);
  });

  it('works with an externally provided (shared) limiter', () => {
    const shared = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 5 });
    const nodeA = new VirtualNode(0, shared);
    const nodeB = new VirtualNode(1, shared);

    // Both nodes share the same limiter — total allowed should be 5
    nodeA.check('key'); // 1
    nodeB.check('key'); // 2
    nodeA.check('key'); // 3
    nodeB.check('key'); // 4
    nodeA.check('key'); // 5
    nodeB.check('key'); // rejected

    expect(nodeA.getMetrics().allowed).toBe(3);
    expect(nodeB.getMetrics().allowed).toBe(2);
    expect(nodeB.getMetrics().rejected).toBe(1);
  });

  it('setLimiter swaps the underlying limiter', () => {
    const limiter1 = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 2 });
    const limiter2 = new FixedWindowLimiter({ windowMs: 60_000, maxRequests: 100 });
    const node = new VirtualNode(0, limiter1);

    node.check('key');
    node.check('key');
    expect(node.check('key').allowed).toBe(false); // limiter1 exhausted

    node.setLimiter(limiter2);
    expect(node.check('key').allowed).toBe(true); // fresh limiter2
  });
});

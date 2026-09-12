/**
 * GET/POST /api/v1/simulation
 *
 * Control the distributed node simulation.
 * - GET:  returns current cluster metrics (per-node + aggregate)
 * - POST: fire requests, switch mode, change node count, or reset
 *
 * This is the API the dashboard (Phase 4) will poll to visualize
 * the "gym doors" problem in real time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCluster } from '@/lib/config/rate-limit-config';
import { apiError } from '@/lib/api/errors';
import type { AlgorithmType } from '@/lib/rate-limiter/types';
import type { ClusterMode } from '@/lib/simulation/types';

const VALID_MODES: ClusterMode[] = ['independent', 'coordinated'];
const VALID_ALGORITHMS: AlgorithmType[] = [
  'fixed-window',
  'sliding-window-log',
  'token-bucket',
  'sliding-window-counter',
];

export async function GET() {
  const cluster = getCluster();
  return NextResponse.json({
    ...cluster.getState(),
    ...cluster.getMetrics(),
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      apiError(400, 'invalid_request', 'Request body must be valid JSON.'),
      { status: 400 },
    );
  }

  const { action } = body;
  const cluster = getCluster();

  switch (action) {
    case 'fire': {
      const count = typeof body.count === 'number' ? Math.min(Math.max(1, body.count), 1000) : 50;
      const key = typeof body.key === 'string' ? body.key : 'sim-default';
      const results = cluster.fireRequests(key, count);
      return NextResponse.json({
        action: 'fire',
        requestsFired: results.length,
        allowed: results.filter((r) => r.allowed).length,
        rejected: results.filter((r) => !r.allowed).length,
        results: results.slice(0, 50), // Cap detail to first 50 for response size
        ...cluster.getMetrics(),
      });
    }

    case 'set-mode': {
      const mode = body.mode;
      if (typeof mode !== 'string' || !VALID_MODES.includes(mode as ClusterMode)) {
        return NextResponse.json(
          apiError(400, 'parameter_invalid', `Mode must be one of: ${VALID_MODES.join(', ')}`),
          { status: 400 },
        );
      }
      cluster.setMode(mode as ClusterMode);
      return NextResponse.json({
        action: 'set-mode',
        message: `Cluster switched to ${mode} mode`,
        ...cluster.getState(),
        ...cluster.getMetrics(),
      });
    }

    case 'set-nodes': {
      const count = body.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 10) {
        return NextResponse.json(
          apiError(400, 'parameter_invalid', 'Node count must be an integer between 1 and 10.'),
          { status: 400 },
        );
      }
      cluster.setNodeCount(count);
      return NextResponse.json({
        action: 'set-nodes',
        message: `Cluster resized to ${count} nodes`,
        ...cluster.getState(),
        ...cluster.getMetrics(),
      });
    }

    case 'set-algorithm': {
      const algo = body.algorithm;
      if (typeof algo !== 'string' || !VALID_ALGORITHMS.includes(algo as AlgorithmType)) {
        return NextResponse.json(
          apiError(400, 'parameter_invalid', `Algorithm must be one of: ${VALID_ALGORITHMS.join(', ')}`),
          { status: 400 },
        );
      }
      cluster.setAlgorithm(algo as AlgorithmType);
      return NextResponse.json({
        action: 'set-algorithm',
        message: `Cluster algorithm switched to ${algo}`,
        ...cluster.getState(),
        ...cluster.getMetrics(),
      });
    }

    case 'reset': {
      cluster.reset();
      return NextResponse.json({
        action: 'reset',
        message: 'Cluster state reset',
        ...cluster.getState(),
        ...cluster.getMetrics(),
      });
    }

    default:
      return NextResponse.json(
        apiError(400, 'invalid_action', 'Action must be one of: fire, set-mode, set-nodes, set-algorithm, reset'),
        { status: 400 },
      );
  }
}

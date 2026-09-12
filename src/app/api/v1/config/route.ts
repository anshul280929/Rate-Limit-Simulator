/**
 * GET/POST /api/v1/config
 *
 * Runtime configuration for the rate limiter.
 * - GET:  returns current algorithm and tier configs
 * - POST: switches the active algorithm (all new requests use it immediately)
 *
 * This is what the dashboard will use to switch algorithms live.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AlgorithmType } from '@/lib/rate-limiter/types';
import { getConfig, setAlgorithm } from '@/lib/config/rate-limit-config';
import { apiError } from '@/lib/api/errors';

const VALID_ALGORITHMS: AlgorithmType[] = [
  'fixed-window',
  'sliding-window-log',
  'token-bucket',
  'sliding-window-counter',
];

export async function GET() {
  return NextResponse.json(getConfig());
}

export async function POST(req: NextRequest) {
  let body: { algorithm?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      apiError(400, 'invalid_request', 'Request body must be valid JSON.'),
      { status: 400 },
    );
  }

  const { algorithm } = body;

  if (typeof algorithm !== 'string' || !VALID_ALGORITHMS.includes(algorithm as AlgorithmType)) {
    return NextResponse.json(
      apiError(
        400,
        'parameter_invalid',
        `Invalid algorithm. Must be one of: ${VALID_ALGORITHMS.join(', ')}`,
      ),
      { status: 400 },
    );
  }

  setAlgorithm(algorithm as AlgorithmType);

  return NextResponse.json({
    message: `Algorithm switched to ${algorithm}`,
    ...getConfig(),
  });
}

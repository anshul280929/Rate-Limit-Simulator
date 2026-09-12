/**
 * GET /api/v1/balance
 *
 * Returns mock account balance. Standard tier rate limit (100 req/min).
 * Mirrors Stripe's /v1/balance endpoint.
 */

import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { generateBalance } from '@/lib/api/mock-data';

async function handler() {
  return NextResponse.json(generateBalance());
}

export const GET = withRateLimit(handler, 'standard');

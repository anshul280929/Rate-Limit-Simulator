/**
 * GET /api/v1/transactions
 *
 * Returns paginated mock transaction history. Standard tier rate limit.
 * Query params: ?page=1&limit=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { generateTransactions } from '@/lib/api/mock-data';

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);

  const transactions = generateTransactions(
    isNaN(page) ? 1 : page,
    isNaN(limit) ? 10 : limit,
  );

  return NextResponse.json(transactions);
}

export const GET = withRateLimit(handler, 'standard');

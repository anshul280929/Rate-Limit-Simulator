/**
 * POST /api/v1/charges
 *
 * Creates a mock charge. Critical tier rate limit (20 req/min).
 * Payment operations get stricter protection — the same layered approach
 * that Stripe uses to ensure an actual charge never gets stuck behind
 * someone looping a list-transactions call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { generateCharge } from '@/lib/api/mock-data';
import { apiError } from '@/lib/api/errors';

async function handler(req: NextRequest) {
  let body: { amount?: unknown; currency?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      apiError(400, 'invalid_request', 'Request body must be valid JSON.'),
      { status: 400 },
    );
  }

  const { amount, currency } = body;

  // Validate amount
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json(
      apiError(400, 'parameter_invalid', 'Amount must be a positive integer (in smallest currency unit, e.g. cents).'),
      { status: 400 },
    );
  }

  // Validate currency
  if (typeof currency !== 'string' || !/^[a-zA-Z]{3}$/.test(currency)) {
    return NextResponse.json(
      apiError(400, 'parameter_invalid', 'Currency must be a 3-letter ISO currency code (e.g. "usd").'),
      { status: 400 },
    );
  }

  const charge = generateCharge(amount, currency);
  return NextResponse.json(charge, { status: 201 });
}

export const POST = withRateLimit(handler, 'critical');

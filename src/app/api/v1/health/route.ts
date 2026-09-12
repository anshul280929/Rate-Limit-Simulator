/**
 * GET /api/v1/health
 *
 * Health check endpoint. Exempt from rate limiting — monitoring tools
 * and load balancers need to hit this freely.
 */

import { NextResponse } from 'next/server';
import { getAlgorithm } from '@/lib/config/rate-limit-config';

const startTime = Date.now();

async function handler() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    algorithm: getAlgorithm(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
}

// Health is exempt — no rate limiting
export const GET = handler;

/**
 * Rate-limit middleware for Next.js API route handlers.
 *
 * Architecture: Higher-order function that wraps a route handler with
 * rate-limiting. Keeps rate-limit concerns completely separated from
 * business logic — the handler never knows it's being rate-limited.
 *
 * Usage in a route handler:
 *   export const GET = withRateLimit(handler, 'standard');
 *   export const POST = withRateLimit(handler, 'critical');
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitTier } from '@/lib/api/types';
import { getLimiter } from '@/lib/config/rate-limit-config';
import { rateLimitHeaders } from '@/lib/api/headers';
import { rateLimitError } from '@/lib/api/errors';

/**
 * Extract the rate-limit key from the request.
 *
 * Priority:
 * 1. `Authorization: Bearer <key>` header
 * 2. `x-api-key` header
 * 3. IP address fallback (from x-forwarded-for or connection)
 */
function extractKey(req: NextRequest): string {
  // Check Authorization: Bearer <key>
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Check x-api-key
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return apiKey;
  }

  // Fallback to IP
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return '127.0.0.1';
}

/**
 * Wrap a Next.js route handler with rate limiting.
 *
 * @param handler - The actual route handler function
 * @param tier - The rate-limit tier to enforce ('standard', 'critical', or 'exempt')
 * @returns A new handler that checks rate limits before calling the original
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse,
  tier: RateLimitTier,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Exempt endpoints skip rate limiting entirely
    const limiter = getLimiter(tier);
    if (!limiter) {
      const result = handler(req);
      return result instanceof Promise ? await result : result;
    }

    const key = extractKey(req);
    const checkResult = limiter.check(key);
    const headers = rateLimitHeaders(checkResult);

    if (!checkResult.allowed) {
      const retryAfterSec = Math.ceil((checkResult.retryAfterMs ?? 1000) / 1000);
      return NextResponse.json(rateLimitError(retryAfterSec), {
        status: 429,
        headers,
      });
    }

    // Request allowed — run the handler, then attach rate-limit headers
    const handlerResult = handler(req);
    const response = handlerResult instanceof Promise ? await handlerResult : handlerResult;

    // Clone response to add headers (NextResponse is immutable)
    const newHeaders = new Headers(response.headers);
    for (const [name, value] of Object.entries(headers)) {
      newHeaders.set(name, value);
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

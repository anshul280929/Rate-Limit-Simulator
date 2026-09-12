/**
 * Rate-limit header helpers.
 *
 * Translates a RateLimitResult into the standard HTTP headers that clients
 * expect. These follow the IETF draft (RateLimit header fields) and the
 * de-facto standard used by Stripe, GitHub, and most modern APIs:
 *
 *   X-RateLimit-Limit     — max requests allowed in the window
 *   X-RateLimit-Remaining — requests left in the current window
 *   X-RateLimit-Reset     — UTC epoch seconds when the window resets
 *   Retry-After           — seconds to wait (only on 429)
 */

import type { RateLimitResult } from '@/lib/rate-limiter/types';

/**
 * Build rate-limit headers from a limiter result.
 *
 * Always includes Limit, Remaining, and Reset.
 * Includes Retry-After only when the request was rejected.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)), // Unix epoch seconds
  };

  if (!result.allowed && result.retryAfterMs) {
    headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
  }

  return headers;
}

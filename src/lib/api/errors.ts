/**
 * Stripe-style error response builders.
 *
 * Stripe's error format is the industry standard for API error responses.
 * Every error has: type (category), code (machine-readable), message (human),
 * and the HTTP status. This makes errors parseable by machines and readable
 * by humans — exactly what a rate-limited client needs.
 */

import type { StripeErrorBody } from './types';

/**
 * Build a rate-limit exceeded error.
 *
 * @param retryAfterSec - Seconds until the client should retry
 */
export function rateLimitError(retryAfterSec: number): StripeErrorBody {
  return {
    error: {
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
      message: `Rate limit exceeded. Please retry after ${retryAfterSec} second${retryAfterSec !== 1 ? 's' : ''}.`,
      status: 429,
    },
  };
}

/**
 * Build a generic API error.
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  type: string = 'invalid_request_error',
): StripeErrorBody {
  return {
    error: {
      type,
      code,
      message,
      status,
    },
  };
}

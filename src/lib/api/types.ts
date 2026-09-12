/**
 * API-specific type definitions.
 *
 * Separates API-layer concerns (tiers, error shapes, response formats)
 * from the core rate-limiter types.
 */

// ---------------------------------------------------------------------------
// Rate-limit tiers
// ---------------------------------------------------------------------------

export type RateLimitTier = 'standard' | 'critical' | 'exempt';

export interface TierConfig {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window. */
  maxRequests: number;
}

/** Default tier configurations — matches Stripe's layered approach. */
export const DEFAULT_TIER_CONFIGS: Record<Exclude<RateLimitTier, 'exempt'>, TierConfig> = {
  standard: { windowMs: 60_000, maxRequests: 100 },
  critical: { windowMs: 60_000, maxRequests: 20 },
};

// ---------------------------------------------------------------------------
// Stripe-style error response
// ---------------------------------------------------------------------------

export interface StripeErrorBody {
  error: {
    type: string;
    code: string;
    message: string;
    status: number;
  };
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface BalanceAmount {
  amount: number;
  currency: string;
}

export interface BalanceResponse {
  object: 'balance';
  available: BalanceAmount[];
  pending: BalanceAmount[];
}

export interface ChargeResponse {
  id: string;
  object: 'charge';
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  created: number;
  description: string | null;
  metadata: Record<string, string>;
}

export interface TransactionResponse {
  id: string;
  object: 'balance_transaction';
  amount: number;
  currency: string;
  type: 'charge' | 'refund' | 'payout' | 'adjustment';
  status: 'available' | 'pending';
  created: number;
  description: string;
}

export interface PaginatedList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  total_count: number;
  url: string;
}

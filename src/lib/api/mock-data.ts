/**
 * Mock payment data generators.
 *
 * Produces realistic-looking Stripe-style response data without any
 * external dependencies or database. IDs are deterministic where possible
 * (based on input) to make testing easier.
 */

import type {
  BalanceResponse,
  ChargeResponse,
  TransactionResponse,
  PaginatedList,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a Stripe-style ID with a prefix. */
function stripeId(prefix: string, seed?: number): string {
  const rand = seed !== undefined
    ? seed.toString(36).padStart(14, '0')
    : Math.random().toString(36).slice(2, 16);
  return `${prefix}_${rand}`;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a mock account balance.
 * Static data — balances don't change between calls (no DB to track).
 */
export function generateBalance(): BalanceResponse {
  return {
    object: 'balance',
    available: [
      { amount: 125_000, currency: 'usd' },
      { amount: 42_300, currency: 'eur' },
    ],
    pending: [
      { amount: 4_500, currency: 'usd' },
    ],
  };
}

/**
 * Generate a mock charge response.
 *
 * @param amount - Charge amount in smallest currency unit (e.g. cents)
 * @param currency - 3-letter ISO currency code
 */
export function generateCharge(amount: number, currency: string): ChargeResponse {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: stripeId('ch', now),
    object: 'charge',
    amount,
    currency: currency.toLowerCase(),
    status: 'succeeded',
    created: now,
    description: null,
    metadata: {},
  };
}

/**
 * Pre-built mock transaction history.
 * 25 entries spanning various types — enough to demonstrate pagination.
 */
const MOCK_TRANSACTIONS: Omit<TransactionResponse, 'id'>[] = [
  { object: 'balance_transaction', amount: 5000, currency: 'usd', type: 'charge', status: 'available', created: 1704067200, description: 'Payment from customer' },
  { object: 'balance_transaction', amount: -1500, currency: 'usd', type: 'refund', status: 'available', created: 1704070800, description: 'Partial refund' },
  { object: 'balance_transaction', amount: 12000, currency: 'usd', type: 'charge', status: 'available', created: 1704153600, description: 'Subscription renewal' },
  { object: 'balance_transaction', amount: -50000, currency: 'usd', type: 'payout', status: 'available', created: 1704240000, description: 'Weekly payout' },
  { object: 'balance_transaction', amount: 7500, currency: 'usd', type: 'charge', status: 'available', created: 1704326400, description: 'One-time purchase' },
  { object: 'balance_transaction', amount: 3200, currency: 'eur', type: 'charge', status: 'available', created: 1704412800, description: 'EU customer payment' },
  { object: 'balance_transaction', amount: -3200, currency: 'eur', type: 'refund', status: 'available', created: 1704499200, description: 'Full refund (EU)' },
  { object: 'balance_transaction', amount: 25000, currency: 'usd', type: 'charge', status: 'available', created: 1704585600, description: 'Enterprise plan' },
  { object: 'balance_transaction', amount: 800, currency: 'usd', type: 'charge', status: 'pending', created: 1704672000, description: 'Micro-transaction' },
  { object: 'balance_transaction', amount: -200, currency: 'usd', type: 'adjustment', status: 'available', created: 1704758400, description: 'Dispute fee' },
  { object: 'balance_transaction', amount: 15000, currency: 'usd', type: 'charge', status: 'available', created: 1704844800, description: 'Annual plan upgrade' },
  { object: 'balance_transaction', amount: 4200, currency: 'usd', type: 'charge', status: 'available', created: 1704931200, description: 'Product purchase' },
  { object: 'balance_transaction', amount: -75000, currency: 'usd', type: 'payout', status: 'available', created: 1705017600, description: 'Bi-weekly payout' },
  { object: 'balance_transaction', amount: 9900, currency: 'usd', type: 'charge', status: 'available', created: 1705104000, description: 'Pro plan' },
  { object: 'balance_transaction', amount: 1800, currency: 'usd', type: 'charge', status: 'pending', created: 1705190400, description: 'Add-on purchase' },
  { object: 'balance_transaction', amount: 6400, currency: 'gbp', type: 'charge', status: 'available', created: 1705276800, description: 'UK customer payment' },
  { object: 'balance_transaction', amount: -500, currency: 'usd', type: 'adjustment', status: 'available', created: 1705363200, description: 'Processing fee' },
  { object: 'balance_transaction', amount: 30000, currency: 'usd', type: 'charge', status: 'available', created: 1705449600, description: 'Bulk order' },
  { object: 'balance_transaction', amount: -4000, currency: 'usd', type: 'refund', status: 'available', created: 1705536000, description: 'Partial refund (bulk)' },
  { object: 'balance_transaction', amount: 11000, currency: 'usd', type: 'charge', status: 'available', created: 1705622400, description: 'Team plan' },
  { object: 'balance_transaction', amount: -100000, currency: 'usd', type: 'payout', status: 'available', created: 1705708800, description: 'Monthly payout' },
  { object: 'balance_transaction', amount: 2200, currency: 'usd', type: 'charge', status: 'pending', created: 1705795200, description: 'Trial conversion' },
  { object: 'balance_transaction', amount: 45000, currency: 'usd', type: 'charge', status: 'available', created: 1705881600, description: 'Enterprise onboarding' },
  { object: 'balance_transaction', amount: -8000, currency: 'usd', type: 'refund', status: 'available', created: 1705968000, description: 'Service credit' },
  { object: 'balance_transaction', amount: 7700, currency: 'usd', type: 'charge', status: 'available', created: 1706054400, description: 'Consultation fee' },
];

/**
 * Generate a paginated transaction list.
 *
 * @param page - 1-indexed page number
 * @param limit - Items per page (max 100)
 */
export function generateTransactions(
  page: number = 1,
  limit: number = 10,
): PaginatedList<TransactionResponse> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const startIndex = (safePage - 1) * safeLimit;
  const endIndex = startIndex + safeLimit;
  const slice = MOCK_TRANSACTIONS.slice(startIndex, endIndex);

  const data: TransactionResponse[] = slice.map((tx, i) => ({
    ...tx,
    id: stripeId('txn', startIndex + i + 1000),
  }));

  return {
    object: 'list',
    data,
    has_more: endIndex < MOCK_TRANSACTIONS.length,
    total_count: MOCK_TRANSACTIONS.length,
    url: '/api/v1/transactions',
  };
}

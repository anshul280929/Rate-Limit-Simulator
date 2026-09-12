# PLAN — Phase 2: Mock Payment API & Rate Limit Middleware

## Overview

Build a Stripe-inspired mock payment API with four endpoints, wire up rate-limiting middleware that extracts API keys, enforces tiered limits (Standard / Critical), attaches standard `X-RateLimit-*` headers to every response, and returns Stripe-style 429 error JSON when limits are exceeded. Provide a runtime config API to switch algorithms on the fly.

This phase connects the Phase 1 rate-limiter core to real HTTP endpoints — turning abstract algorithms into observable behavior.

## Architecture

```text
Request flow:
  Client → Next.js Route Handler
              ↓
         rate-limit middleware (extracts API key, picks tier, checks limiter)
              ↓
         ├─ allowed → handler logic → 200 + rate-limit headers
         └─ rejected → 429 + Stripe-style error + Retry-After header

Tier resolution:
  /api/v1/charges  → Critical tier (20 req/min)
  /api/v1/balance  → Standard tier (100 req/min)
  /api/v1/transactions → Standard tier (100 req/min)
  /api/v1/health   → Exempt (no rate limiting)

Runtime config:
  GET  /api/v1/config      → current algorithm + tier limits
  POST /api/v1/config      → switch algorithm at runtime
```

## Directory Structure (new files)

```text
src/
├── app/api/v1/
│   ├── balance/route.ts          # GET  /api/v1/balance
│   ├── charges/route.ts          # POST /api/v1/charges
│   ├── transactions/route.ts     # GET  /api/v1/transactions
│   ├── health/route.ts           # GET  /api/v1/health
│   └── config/route.ts           # GET/POST /api/v1/config (runtime switch)
├── lib/
│   ├── rate-limiter/             # (existing from Phase 1)
│   ├── middleware/
│   │   └── rate-limit.ts         # Rate-limit middleware function
│   ├── api/
│   │   ├── errors.ts             # Stripe-style error builder
│   │   ├── headers.ts            # Rate-limit header helpers
│   │   ├── mock-data.ts          # Mock payment data generators
│   │   └── types.ts              # API-specific types (tiers, error shapes)
│   └── config/
│       └── rate-limit-config.ts  # Global rate-limit config (singleton)
└── __tests__/
    ├── api/
    │   ├── balance.test.ts
    │   ├── charges.test.ts
    │   ├── transactions.test.ts
    │   └── health.test.ts
    └── middleware/
        └── rate-limit.test.ts
```

---

## Tasks

### Task 1 — tracer: API Types + Error Builder + Headers + One Endpoint End-to-End
**Type:** tracer
**Files:** `src/lib/api/types.ts`, `src/lib/api/errors.ts`, `src/lib/api/headers.ts`, `src/lib/config/rate-limit-config.ts`, `src/lib/middleware/rate-limit.ts`, `src/app/api/v1/balance/route.ts`, `src/app/api/v1/health/route.ts`
**Requirements:** REQ-007, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014

**What:**
1. Define API types in `src/lib/api/types.ts`:
   ```typescript
   export type RateLimitTier = 'standard' | 'critical' | 'exempt';

   export interface TierConfig {
     windowMs: number;
     maxRequests: number;
   }

   export interface StripeError {
     error: {
       type: string;
       code: string;
       message: string;
       status: number;
     };
   }
   ```

2. Build `src/lib/api/errors.ts` — Stripe-style error response factory:
   ```typescript
   export function rateLimitError(retryAfterMs: number): StripeError
   export function apiError(status: number, code: string, message: string): StripeError
   ```

3. Build `src/lib/api/headers.ts` — helpers that take a `RateLimitResult` and return header entries:
   ```typescript
   export function rateLimitHeaders(result: RateLimitResult): Record<string, string>
   // Returns: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
   // Plus Retry-After when result.allowed === false
   ```

4. Build `src/lib/config/rate-limit-config.ts` — singleton managing the global rate-limit state:
   - Stores current `AlgorithmType` (default: `sliding-window-counter`)
   - Stores tier configs: `{ standard: { windowMs: 60000, maxRequests: 100 }, critical: { windowMs: 60000, maxRequests: 20 } }`
   - Provides `getLimiter(tier)` — returns (or lazily creates) a `RateLimiter` for the tier
   - Provides `setAlgorithm(algo)` — switches algorithm, recreates limiters
   - Provides `getConfig()` — returns current state for the config API

5. Build `src/lib/middleware/rate-limit.ts` — the core middleware function:
   ```typescript
   export function withRateLimit(
     handler: (req: NextRequest) => Promise<NextResponse>,
     tier: RateLimitTier
   ): (req: NextRequest) => Promise<NextResponse>
   ```
   - Extracts API key from `Authorization: Bearer <key>` or `x-api-key` header
   - Falls back to IP address from `x-forwarded-for` or connection if no key
   - If tier is `exempt`, skip rate limiting entirely
   - Calls `rateLimitConfig.getLimiter(tier).check(key)`
   - If allowed: run handler, attach rate-limit headers to response
   - If rejected: return 429 with Stripe error JSON + headers

6. Build `/api/v1/balance` (GET) — first rate-limited endpoint:
   - Returns mock balance: `{ data: { available: [{ amount: 125000, currency: "usd" }], pending: [{ amount: 4500, currency: "usd" }] } }`
   - Wrapped with `withRateLimit(handler, 'standard')`

7. Build `/api/v1/health` (GET) — exempt endpoint:
   - Returns `{ status: "ok", timestamp, algorithm, uptime }`
   - NOT rate-limited (tier: `exempt`)

**Verify:**
```bash
npm run build
# Manual: curl http://localhost:3000/api/v1/balance -H "x-api-key: test-key-1"
# Manual: curl http://localhost:3000/api/v1/health
```

---

### Task 2 — Mock Data + Remaining Endpoints
**Type:** implementation
**Files:** `src/lib/api/mock-data.ts`, `src/app/api/v1/charges/route.ts`, `src/app/api/v1/transactions/route.ts`
**Requirements:** REQ-008, REQ-009
**Depends on:** Task 1

**What:**
1. Build `src/lib/api/mock-data.ts` — deterministic mock data generators:
   ```typescript
   export function generateBalance(): BalanceResponse
   export function generateCharge(amount: number, currency: string): ChargeResponse
   export function generateTransactions(page: number, limit: number): TransactionListResponse
   ```
   - Charge responses include: `id` (ch_xxx), `amount`, `currency`, `status`, `created` timestamp
   - Transaction list has pagination: `{ data: [...], has_more, total_count }`
   - Use deterministic IDs based on timestamp for reproducibility

2. Build `/api/v1/charges` (POST) — Critical tier:
   - Accepts JSON body: `{ amount: number, currency: string }`
   - Validates amount > 0, currency is 3-letter code
   - Returns 400 with Stripe error on invalid input
   - Returns mock charge object on success
   - Wrapped with `withRateLimit(handler, 'critical')` — 20 req/min

3. Build `/api/v1/transactions` (GET) — Standard tier:
   - Query params: `?page=1&limit=10`
   - Returns paginated mock transaction history
   - Wrapped with `withRateLimit(handler, 'standard')` — 100 req/min

4. Refactor `/api/v1/balance` to use `mock-data.ts` instead of inline mock data

**Verify:**
```bash
npm run build
# Manual: curl -X POST http://localhost:3000/api/v1/charges -H "x-api-key: test-key-1" -H "Content-Type: application/json" -d '{"amount":5000,"currency":"usd"}'
# Manual: curl http://localhost:3000/api/v1/transactions?page=1&limit=5 -H "x-api-key: test-key-1"
```

---

### Task 3 — Runtime Config API
**Type:** implementation
**Files:** `src/app/api/v1/config/route.ts`
**Requirements:** REQ-015
**Depends on:** Task 1

**What:**
1. Build `/api/v1/config` route:
   - `GET` — returns current config:
     ```json
     {
       "algorithm": "sliding-window-counter",
       "tiers": {
         "standard": { "windowMs": 60000, "maxRequests": 100 },
         "critical": { "windowMs": 60000, "maxRequests": 20 }
       }
     }
     ```
   - `POST` — switches algorithm at runtime:
     - Accepts `{ algorithm: AlgorithmType }` in JSON body
     - Validates algorithm is one of the four known types
     - Calls `rateLimitConfig.setAlgorithm(algo)`
     - Returns updated config
     - Returns 400 with Stripe error on invalid algorithm

**Verify:**
```bash
npm run build
# Manual: curl http://localhost:3000/api/v1/config
# Manual: curl -X POST http://localhost:3000/api/v1/config -H "Content-Type: application/json" -d '{"algorithm":"token-bucket"}'
```

---

### Task 4 — Integration Tests
**Type:** verification
**Files:** `src/__tests__/middleware/rate-limit.test.ts`
**Requirements:** REQ-011, REQ-012, REQ-013, REQ-014
**Depends on:** Task 1, Task 2, Task 3

**What:**
1. Test rate-limit middleware directly (unit-level, no HTTP):
   - Allows requests up to limit, attaches correct headers
   - Returns 429 with Stripe-style error JSON when limit exceeded
   - `X-RateLimit-Limit` matches configured max
   - `X-RateLimit-Remaining` decrements correctly
   - `X-RateLimit-Reset` is a future Unix timestamp
   - `Retry-After` header present only on 429
   - Extracts API key from `Authorization: Bearer` header
   - Extracts API key from `x-api-key` header
   - Falls back to IP when no API key provided
   - Different API keys have independent rate limits
   - `exempt` tier skips rate limiting entirely
   - Standard vs. Critical tiers enforce different limits

2. Run full test suite (Phase 1 + Phase 2):
   ```bash
   npm test
   ```

**Verify:**
```bash
npm test
npm run build
```

---

## Verification Plan

### Automated Tests
```bash
npm test                    # All unit tests pass (Phase 1 + Phase 2)
npm run build               # TypeScript compiles with strict mode, zero errors
```

### Manual Verification
```bash
# Start dev server
npm run dev

# Test balance (standard tier)
curl -s http://localhost:3000/api/v1/balance -H "x-api-key: sk_test_123" | jq .

# Test charges (critical tier)  
curl -s -X POST http://localhost:3000/api/v1/charges \
  -H "x-api-key: sk_test_123" \
  -H "Content-Type: application/json" \
  -d '{"amount":2500,"currency":"usd"}' | jq .

# Test transactions (standard tier with pagination)
curl -s "http://localhost:3000/api/v1/transactions?page=1&limit=5" \
  -H "x-api-key: sk_test_123" | jq .

# Test health (exempt)
curl -s http://localhost:3000/api/v1/health | jq .

# Check rate-limit headers
curl -sI http://localhost:3000/api/v1/balance -H "x-api-key: sk_test_123"

# Switch algorithm at runtime
curl -s -X POST http://localhost:3000/api/v1/config \
  -H "Content-Type: application/json" \
  -d '{"algorithm":"token-bucket"}' | jq .

# Trigger 429 (hit balance 101 times in quick succession)
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:3000/api/v1/balance -H "x-api-key: sk_test_flood"
done
```

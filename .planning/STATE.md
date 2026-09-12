# STATE — RateGate

## Current Phase
Phase 3: Distributed Node Simulation

## Status
NOT_STARTED

## Phase History
- **Phase 1: Project Scaffold & Rate Limiter Core** — ✅ COMPLETE
  - Next.js 16 + TypeScript strict mode scaffold
  - 4 algorithms: Fixed Window, Sliding Window Log, Token Bucket, Sliding Window Counter
  - In-memory store with TTL + periodic cleanup
  - Algorithm factory with exhaustive type checking
  - 45 unit tests — all passing

- **Phase 2: Mock Payment API & Rate Limit Middleware** — ✅ COMPLETE
  - Stripe-style mock payment API (balance, charges, transactions, health)
  - Rate-limit middleware as HOF with API key extraction
  - Standard (100 req/min) and Critical (20 req/min) tiers
  - X-RateLimit-* headers on every response, Retry-After on 429
  - Runtime algorithm switching via /api/v1/config
  - 9 middleware tests (54 total — all passing)

## Decisions
- TypeScript strict mode throughout
- Next.js App Router with API routes
- In-memory rate limit store (self-contained, zero external deps)
- Four algorithms: Fixed Window, Sliding Window Log, Token Bucket, Sliding Window Counter
- Mock fintech API (Stripe-inspired) as the protected service
- Vanilla CSS for styling (no Tailwind)
- Dark-mode fintech aesthetic
- Jest + ts-jest for testing (jest.config.js to avoid ts-node dep)
- Strategy pattern for algorithms, factory for runtime selection
- withRateLimit() HOF middleware — clean separation from business logic
- Singleton config for global rate-limit state
- Stripe-style error format for all API errors

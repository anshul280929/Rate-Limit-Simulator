# PROJECT: RateGate — Distributed Rate Limiter Playground

## Vision

A production-quality distributed rate limiter that protects a mock fintech/payment API (inspired by Stripe), built as a single Next.js + TypeScript project. The project demonstrates senior-level understanding of distributed systems, algorithm trade-offs, and clean architecture — the kind of work that makes someone say *"this person has actually thought about this problem."*

The project is a companion piece to the blog post "The Hidden Math Problem Behind Every API Rate Limit" — turning its concepts into working, interactive code.

## Problem Statement

Rate limiting sounds trivial — "just add a counter." But the moment your system spans multiple nodes, counting correctly becomes one of the genuinely hard problems in distributed systems. This project makes that problem **tangible** by:

1. Implementing four real rate-limiting algorithms with proper abstractions
2. Simulating a distributed fleet (3–5 virtual nodes) to show the "gym doors" problem live
3. Wrapping it around a realistic mock payment API (not a toy)
4. Providing a real-time dashboard where you can fire requests, switch algorithms, and **watch** the math break (or hold)

## What Makes This Portfolio-Worthy

- **Architecture**: Strategy pattern for algorithms, clean middleware, proper separation of concerns
- **Algorithm Depth**: Four strategies (Fixed Window, Sliding Window Log, Token Bucket, Sliding Window Counter), each with different trade-off profiles
- **Distributed Simulation**: Virtual nodes with independent state demonstrate the blog's core insight — not just described, but running
- **Production Patterns**: Standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`), proper 429 responses, configurable per-tier limits
- **Clean Code**: TypeScript throughout, zero unnecessary dependencies, self-contained

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) | Single project — API routes for backend, React for frontend |
| Language | TypeScript | Type safety, production rigor, self-documenting interfaces |
| Rate Limiter Store | In-memory (simulated) | Zero external deps — clone → install → run |
| Real-time Updates | Server-Sent Events or polling | Dashboard updates without WebSocket complexity |
| Styling | Vanilla CSS (CSS custom properties) | No Tailwind — demonstrates raw CSS skill |

## Mock API Surface (Stripe-inspired)

| Endpoint | Tier | Description |
|----------|------|-------------|
| `GET /api/v1/balance` | Standard | Check account balance |
| `POST /api/v1/charges` | Critical | Create a charge (stricter limit) |
| `GET /api/v1/transactions` | Standard | List transactions |
| `GET /api/v1/health` | Exempt | Health check (no rate limit) |

Two tiers of rate limiting (inspired by Stripe's layered approach):
- **Standard**: Higher limit (e.g., 100 req/sec)
- **Critical**: Lower limit (e.g., 20 req/sec) — payment operations get stricter protection

## Rate Limiting Algorithms

### 1. Fixed Window Counter
The naive approach. Simple, fast, but suffers from the boundary problem — a burst at the end of one window and start of the next can allow 2x the limit. This is what breaks in distributed setups.

### 2. Sliding Window Log
Tracks every request timestamp. Perfectly accurate but memory-hungry — O(n) per client where n = requests in window. Shows the precision vs. resource trade-off.

### 3. Token Bucket
Tokens refill at a steady rate. Allows controlled bursts while maintaining average throughput. What AWS API Gateway uses. The industry workhorse.

### 4. Sliding Window Counter
Approximates a sliding window using weighted counters from current and previous fixed windows. Near-perfect accuracy with O(1) memory. What Cloudflare uses. The "hybrid" from the blog.

## Distributed Simulation

The dashboard simulates 3–5 virtual nodes, each maintaining independent rate-limiter state. Users can:

1. **See the "gym doors" problem**: Fire traffic and watch naive per-node limits let 3–5x through
2. **Toggle coordination**: Switch from independent nodes to a shared store
3. **Compare algorithms**: See how each algorithm behaves under the same traffic pattern
4. **Watch real-time metrics**: Allowed/rejected counts, effective vs. intended rate, per-node breakdowns

## Dashboard UX

- Clean, dark-mode fintech aesthetic (think Stripe Dashboard meets terminal)
- Real-time request flow visualization
- Algorithm switcher (live — no page reload)
- Node topology view showing independent vs. coordinated state
- Metrics panel: allowed/rejected/effective rate
- "Fire requests" button with configurable burst size
- Request log showing individual allow/reject decisions with timestamps

## Architecture Principles

1. **Strategy Pattern**: Each algorithm implements a common `RateLimiter` interface
2. **Store Abstraction**: `RateLimitStore` interface — in-memory impl ships, Redis impl is a clean extension point
3. **Middleware Composition**: Rate limiter is pure middleware, not tangled with business logic
4. **Configuration-Driven**: Limits, algorithms, node count — all configurable, not hardcoded
5. **Testable**: Each algorithm is a pure function of state → decision. No side effects in core logic.

## Non-Goals

- No real Redis / external dependencies (self-contained)
- No user authentication (mock API keys are fine)
- No persistent storage (in-memory is the point)
- No deployment infrastructure (local dev only)
- No heavy frontend framework beyond Next.js/React

## Project Code

`RGATE`

## Tags

`distributed-systems` `rate-limiting` `typescript` `next.js` `system-design` `portfolio`

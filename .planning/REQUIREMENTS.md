# REQUIREMENTS — RateGate

## v1 — Core (Ship This)

### Rate Limiter Core

- **REQ-001**: Implement Fixed Window Counter algorithm with configurable window size and max requests
- **REQ-002**: Implement Sliding Window Log algorithm that tracks per-request timestamps
- **REQ-003**: Implement Token Bucket algorithm with configurable bucket size and refill rate
- **REQ-004**: Implement Sliding Window Counter algorithm using weighted previous/current window counters
- **REQ-005**: All algorithms must implement a common `RateLimiter` interface (`isAllowed(key): { allowed, remaining, resetAt, retryAfter }`)
- **REQ-006**: Implement an in-memory `RateLimitStore` with per-key state isolation and automatic cleanup of expired entries

### Mock Payment API

- **REQ-007**: `GET /api/v1/balance` — returns mock account balance (Standard tier rate limit)
- **REQ-008**: `POST /api/v1/charges` — creates a mock charge with amount/currency (Critical tier rate limit)
- **REQ-009**: `GET /api/v1/transactions` — returns paginated mock transaction history (Standard tier rate limit)
- **REQ-010**: `GET /api/v1/health` — health check endpoint exempt from rate limiting
- **REQ-011**: API responses include standard rate-limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on 429)
- **REQ-012**: Rate-limited requests return HTTP 429 with JSON error body matching Stripe-style error format

### Rate Limiter Middleware

- **REQ-013**: Next.js API middleware that applies rate limiting based on API key (from `Authorization` header or `x-api-key`)
- **REQ-014**: Support two rate-limit tiers: Standard (100 req/min) and Critical (20 req/min)
- **REQ-015**: Rate limit algorithm is switchable at runtime via API or dashboard control

### Distributed Simulation

- **REQ-016**: Simulate 3–5 virtual rate-limiter nodes, each with independent in-memory state
- **REQ-017**: Each virtual node maintains its own counter/bucket state — demonstrating the "gym doors" problem from the blog
- **REQ-018**: Provide a "coordinated" mode where all virtual nodes share a single store — demonstrating the fix
- **REQ-019**: Expose per-node metrics (allowed count, rejected count, current window state) via API for dashboard consumption

### Dashboard

- **REQ-020**: Real-time dashboard showing requests flowing through the rate limiter
- **REQ-021**: Algorithm switcher — select between the four algorithms without page reload
- **REQ-022**: Node topology visualization — show virtual nodes with per-node allow/reject counts
- **REQ-023**: Toggle between "independent nodes" and "coordinated (shared store)" mode
- **REQ-024**: "Fire Requests" control — configurable burst size, fires requests against the mock API
- **REQ-025**: Metrics panel: total allowed, total rejected, effective rate vs. intended rate, per-algorithm comparison
- **REQ-026**: Request log — scrolling feed of individual request decisions (allowed/rejected, which node, timestamp)
- **REQ-027**: Dark-mode fintech aesthetic (think Stripe Dashboard)

### Developer Experience

- **REQ-028**: Clone → `npm install` → `npm run dev` — working app with zero external dependencies
- **REQ-029**: TypeScript throughout — strict mode, no `any` leaks in core rate limiter code
- **REQ-030**: README.md documenting architecture, algorithms, and how to run

## v2 — Stretch (Not Now)

- **REQ-V2-001**: Redis-backed `RateLimitStore` as optional adapter
- **REQ-V2-002**: WebSocket for real-time dashboard updates (replace polling/SSE)
- **REQ-V2-003**: Algorithm performance benchmarks with configurable load profiles
- **REQ-V2-004**: Export metrics to Prometheus format
- **REQ-V2-005**: Sliding window visualization — animated timeline showing window movement

## Out of Scope

- User authentication / session management
- Persistent database storage
- Production deployment (Docker, CI/CD)
- Mobile responsiveness (desktop dashboard is fine)
- Multi-tenant API key management

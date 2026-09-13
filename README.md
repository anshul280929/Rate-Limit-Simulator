# RateGate

**Distributed Rate Limiter Playground** — an interactive demonstration of why rate limiting breaks in distributed systems, and how to fix it.

Built as a production-grade TypeScript project showcasing four rate-limiting algorithms, a Stripe-inspired mock payment API, and a distributed node simulation that makes the problem tangible.

> *"You have a gym with 3 entrance doors. Each door has its own counter allowing 100 people per hour. You've just let in 300 people."*
>
> — [The Hidden Math Problem Behind Every API Rate Limit](the-hidden-math-problem-behind-every-api-rate-limit.md)

---

## The Problem

Every rate limiter works perfectly on a single server. Deploy it behind a load balancer with N nodes, and each node independently enforces the limit — effectively allowing **N× the intended throughput**.

RateGate simulates this with virtual nodes you can observe in real time:

| Mode | Nodes | Limit | Requests | Allowed | Effective Rate |
|------|-------|-------|----------|---------|---------------|
| Independent (broken) | 3 | 100/min | 300 | **300** | **3.0×** 🔴 |
| Coordinated (fixed) | 3 | 100/min | 300 | **100** | **1.0×** 🟢 |

---

## Quick Start

```bash
git clone https://github.com/anshul280929/RateGate.git
cd rategate
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — zero external dependencies, no Docker, no Redis.

---

## Architecture

```
src/
├── lib/
│   ├── rate-limiter/           # Core rate-limiting engine
│   │   ├── types.ts            # RateLimiter interface, RateLimitResult, RateLimitStore<T>
│   │   ├── algorithms/
│   │   │   ├── fixed-window.ts         # Fixed Window Counter
│   │   │   ├── sliding-window-log.ts   # Sliding Window Log
│   │   │   ├── token-bucket.ts         # Token Bucket (lazy refill)
│   │   │   └── sliding-window-counter.ts # Sliding Window Counter
│   │   ├── stores/
│   │   │   └── memory-store.ts         # In-memory store with TTL + cleanup
│   │   └── factory.ts                  # Algorithm factory (exhaustive switch)
│   │
│   ├── simulation/             # Distributed node simulation
│   │   ├── virtual-node.ts     # Node wrapper with per-node metrics
│   │   └── node-cluster.ts     # N-node cluster with independent/coordinated modes
│   │
│   ├── middleware/
│   │   └── rate-limit.ts       # withRateLimit() HOF middleware
│   │
│   ├── api/
│   │   ├── errors.ts           # Stripe-style error builders
│   │   ├── headers.ts          # X-RateLimit-* header helpers
│   │   ├── mock-data.ts        # Mock payment data generators
│   │   └── types.ts            # API types (tiers, error shapes)
│   │
│   └── config/
│       └── rate-limit-config.ts # Singleton config + cluster manager
│
└── app/api/v1/
    ├── balance/route.ts        # GET  — mock balance (standard tier)
    ├── charges/route.ts        # POST — mock charge (critical tier)
    ├── transactions/route.ts   # GET  — paginated history (standard tier)
    ├── health/route.ts         # GET  — health check (exempt)
    ├── config/route.ts         # GET/POST — runtime algorithm switch
    └── simulation/route.ts     # GET/POST — distributed simulation control
```

### Design Patterns

- **Strategy Pattern** — every algorithm implements the `RateLimiter` interface, making them interchangeable at runtime
- **Factory Pattern** — `createRateLimiter(algorithm, config)` with exhaustive TypeScript checking
- **Higher-Order Function Middleware** — `withRateLimit(handler, tier)` cleanly separates rate-limiting from business logic
- **Store Abstraction** — `RateLimitStore<T>` decouples storage from algorithm logic (in-memory now, Redis later)

---

## Algorithms

### Fixed Window Counter
Divides time into fixed windows and counts requests per window. Simple and fast, but suffers from the **boundary burst problem** — a client can double throughput by timing requests at window boundaries.

### Sliding Window Log
Tracks every request timestamp. Perfectly accurate — no boundary bursts — but uses **O(n) memory** per key. At high throughput this becomes expensive.

### Token Bucket
Tokens refill at a constant rate, each request consumes one. Allows controlled **bursts** up to bucket size while maintaining steady average throughput. **This is what AWS API Gateway uses.** Lazy refill — no background timers.

### Sliding Window Counter
Approximates a true sliding window using weighted counters from current and previous windows. **O(1) memory**, near-perfect accuracy. **This is what Cloudflare uses.**

---

## API Reference

### Mock Payment API

| Method | Endpoint | Tier | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/v1/balance` | Standard | 100 req/min | Mock account balance |
| `POST` | `/api/v1/charges` | Critical | 20 req/min | Create mock charge |
| `GET` | `/api/v1/transactions` | Standard | 100 req/min | Paginated transaction history |
| `GET` | `/api/v1/health` | Exempt | — | Health check |

Every rate-limited response includes:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1704067260
```

Rate-limited requests return `429` with Stripe-style error JSON:
```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Please retry after 12 seconds.",
    "status": 429
  }
}
```

### Runtime Configuration

```bash
# Get current config
curl http://localhost:3000/api/v1/config

# Switch algorithm at runtime
curl -X POST http://localhost:3000/api/v1/config \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "token-bucket"}'
```

### Simulation API

```bash
# Get cluster metrics
curl http://localhost:3000/api/v1/simulation

# Fire a burst of 150 requests
curl -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action": "fire", "count": 150}'

# Switch to coordinated mode (the fix)
curl -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action": "set-mode", "mode": "coordinated"}'

# Change node count
curl -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action": "set-nodes", "count": 5}'

# Reset all state
curl -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action": "reset"}'
```

---

## Testing

```bash
npm test              # Run all 79 tests
npm run test:watch    # Watch mode
```

Test coverage spans:
- **4 algorithm suites** — limit enforcement, window resets, key isolation, edge cases
- **Memory store** — CRUD, TTL expiry, cleanup sweeps, complex value types
- **Middleware** — header attachment, 429 responses, API key extraction, tier enforcement
- **Simulation** — independent mode overshoot, coordinated mode enforcement, round-robin distribution, all 4 algorithms × both modes

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | API routes + React in one project |
| Language | TypeScript (strict mode) | Production rigor, zero `any` in core |
| Testing | Jest + ts-jest | Fast, reliable, fake timers for time-dependent logic |
| Styling | Vanilla CSS | Maximum control, no build-step dependencies |
| External deps | **None** | Clone and run — no Redis, no Docker, no databases |

---

## License

MIT

# ROADMAP — RateGate

## Phase 1: Project Scaffold & Rate Limiter Core
**Goal:** Set up Next.js + TypeScript project structure and implement all four rate-limiting algorithms with a clean interface and in-memory store.
**Mode:** standard
**Requirements:** REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-028, REQ-029
**Success Criteria:**
1. Next.js project initializes with TypeScript strict mode, runs with `npm run dev`
2. All four algorithms pass unit tests with deterministic inputs
3. `RateLimiter` interface is clean — any new algorithm can be added by implementing one interface
4. In-memory store handles per-key isolation and expired entry cleanup
5. Old simulator files (`index.js`, existing `package.json`) are cleanly removed/replaced

---

## Phase 2: Mock Payment API & Rate Limit Middleware
**Goal:** Build the Stripe-inspired mock API endpoints and wire up rate-limiting middleware with tiered limits and standard headers.
**Requirements:** REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015
**Success Criteria:**
1. All four API endpoints return realistic mock data
2. Rate-limited requests return 429 with Stripe-style error JSON
3. Every response includes correct `X-RateLimit-*` headers
4. Standard and Critical tiers enforce different limits
5. Algorithm can be switched at runtime via API call

---

## Phase 3: Distributed Node Simulation
**Goal:** Implement virtual multi-node simulation that demonstrates the "gym doors" distributed rate limiting problem and the coordinated fix.
**Requirements:** REQ-016, REQ-017, REQ-018, REQ-019
**Success Criteria:**
1. 3–5 virtual nodes each maintain independent rate-limiter state
2. In "independent" mode, total allowed requests exceed intended limit by ~Nx (N = node count)
3. In "coordinated" mode, total allowed requests match intended limit regardless of node count
4. Per-node metrics (allowed, rejected, window state) are exposed via API endpoint

---

## Phase 4: Interactive Dashboard
**Goal:** Build the real-time dashboard with algorithm switcher, node topology, request controls, metrics, and request log.
**Requirements:** REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027
**UI hint:** yes
**Success Criteria:**
1. Dashboard loads at root URL, shows real-time request flow
2. Algorithm switcher changes active algorithm without page reload
3. Node topology view shows per-node metrics updating live
4. "Fire Requests" button sends configurable bursts and dashboard reflects results immediately
5. Metrics panel shows allowed/rejected/effective rate with correct calculations
6. Request log scrolls with new entries, showing node assignment and decision
7. Dark-mode fintech aesthetic — looks like it belongs in a Stripe engineering blog

---

## Phase 5: Documentation & Polish
**Goal:** Architecture README, code cleanup, and final polish pass.
**Requirements:** REQ-030
**Success Criteria:**
1. README documents architecture decisions, algorithm trade-offs, and usage
2. All code passes TypeScript strict mode with zero `any` in core
3. Project runs end-to-end: clone → install → dev → dashboard works
4. Architecture diagram in README showing component relationships

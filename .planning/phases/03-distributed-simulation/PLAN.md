# PLAN — Phase 3: Distributed Node Simulation

## Overview

Build the simulation engine that makes the blog's "gym doors" problem **tangible**. Create a virtual node cluster where each node maintains independent rate-limiter state, then provide a "coordinated" mode where all nodes share a single store. Expose per-node metrics via API so the dashboard (Phase 4) can visualize the problem in real time.

This is the phase that elevates the project from "nice API" to "this person understands distributed systems."

## Architecture

```text
NodeCluster (manages N virtual nodes)
├── mode: 'independent' | 'coordinated'
├── nodes: VirtualNode[]         ← each has its own RateLimiter instance
├── sharedLimiter: RateLimiter   ← used in coordinated mode (one for all)
│
├── routeRequest(key, tier)      ← round-robin assigns to a node, checks rate limit
├── getMetrics()                 ← per-node + aggregate metrics
├── reset()                      ← clear all state
└── setMode(mode)                ← switch between independent/coordinated

Independent mode:
  Node 0: [FixedWindow limit=100] ── allows 100
  Node 1: [FixedWindow limit=100] ── allows 100
  Node 2: [FixedWindow limit=100] ── allows 100
  Total allowed: ~300  ← 3x the intended limit! (the "gym doors" problem)

Coordinated mode:
  Shared: [FixedWindow limit=100] ── all nodes check this one
  Node 0 → shared ── allows until 100 total
  Node 1 → shared
  Node 2 → shared
  Total allowed: 100  ← correct! (the fix)
```

## Directory Structure (new files)

```text
src/
├── lib/
│   └── simulation/
│       ├── types.ts              # NodeMetrics, ClusterConfig, SimulationResult
│       ├── virtual-node.ts       # VirtualNode — wraps a RateLimiter with metrics tracking
│       ├── node-cluster.ts       # NodeCluster — manages N nodes, routing, mode switching
│       └── index.ts              # Barrel export
├── app/api/v1/
│   ├── simulation/
│   │   └── route.ts             # GET/POST — cluster state, fire requests, switch mode
│   └── config/route.ts          # (MODIFY) — add node count + mode to config response
└── __tests__/
    └── simulation/
        ├── virtual-node.test.ts
        └── node-cluster.test.ts
```

---

## Tasks

### Task 1 — tracer: Simulation Types + VirtualNode + NodeCluster Core
**Type:** tracer
**Files:** `src/lib/simulation/types.ts`, `src/lib/simulation/virtual-node.ts`, `src/lib/simulation/node-cluster.ts`, `src/lib/simulation/index.ts`, `src/__tests__/simulation/virtual-node.test.ts`, `src/__tests__/simulation/node-cluster.test.ts`
**Requirements:** REQ-016, REQ-017, REQ-018

**What:**

1. Define simulation types in `src/lib/simulation/types.ts`:
   ```typescript
   export type ClusterMode = 'independent' | 'coordinated';

   export interface NodeMetrics {
     nodeId: number;
     allowed: number;
     rejected: number;
     total: number;
   }

   export interface ClusterMetrics {
     mode: ClusterMode;
     nodeCount: number;
     nodes: NodeMetrics[];
     aggregate: {
       allowed: number;
       rejected: number;
       total: number;
       effectiveRate: number;   // allowed / intended limit
       intendedLimit: number;
     };
   }

   export interface SimulationResult {
     nodeId: number;
     allowed: boolean;
     remaining: number;
   }
   ```

2. Build `VirtualNode` — wraps a `RateLimiter` with metrics tracking:
   - Holds its own `RateLimiter` instance (for independent mode)
   - Tracks `allowed` / `rejected` counters
   - `check(key)` — delegates to its limiter, increments counters
   - `getMetrics()` — returns `NodeMetrics`
   - `reset()` — clears limiter state and counters
   - Can optionally be given an external limiter (for coordinated mode)

3. Build `NodeCluster` — the simulation engine:
   - Constructor: `(nodeCount, algorithm, tierConfig)`
   - Creates `nodeCount` VirtualNode instances, each with its own limiter
   - Also creates one `sharedLimiter` for coordinated mode
   - `routeRequest(key, tier)`:
     - Picks a node via round-robin (simulates load balancer)
     - In `independent` mode: node uses its own limiter
     - In `coordinated` mode: node uses the shared limiter
     - Returns `SimulationResult` with nodeId, allowed, remaining
   - `setMode(mode)` — switches between independent/coordinated, resets all state
   - `setAlgorithm(algo)` — recreates all limiters with the new algorithm
   - `getMetrics()` — returns `ClusterMetrics`
   - `reset()` — clears all node metrics and limiter state
   - `fireRequests(key, count)` — batch fire, returns array of results (for dashboard burst)

4. Tests for `VirtualNode`:
   - Tracks allowed/rejected counts correctly
   - Delegates to internal limiter
   - Reset clears counters and limiter state
   - Works with externally provided limiter

5. Tests for `NodeCluster`:
   - **Independent mode: N nodes allow ~N× the intended limit** (the key test)
   - **Coordinated mode: total allowed matches intended limit** (the fix)
   - Round-robin distributes requests across nodes
   - `setMode()` resets state
   - `setAlgorithm()` recreates limiters
   - `getMetrics()` returns correct per-node breakdowns
   - `fireRequests()` batch works correctly

**Verify:**
```bash
npm test -- --testPathPattern=simulation
npm run build
```

---

### Task 2 — Simulation API Endpoint
**Type:** implementation
**Files:** `src/app/api/v1/simulation/route.ts`, `src/lib/config/rate-limit-config.ts` (MODIFY)
**Requirements:** REQ-019
**Depends on:** Task 1

**What:**

1. Build `/api/v1/simulation` route:
   - `GET` — returns current cluster metrics:
     ```json
     {
       "mode": "independent",
       "nodeCount": 3,
       "algorithm": "fixed-window",
       "nodes": [
         { "nodeId": 0, "allowed": 42, "rejected": 8, "total": 50 },
         { "nodeId": 1, "allowed": 38, "rejected": 12, "total": 50 },
         { "nodeId": 2, "allowed": 40, "rejected": 10, "total": 50 }
       ],
       "aggregate": {
         "allowed": 120, "rejected": 30, "total": 150,
         "effectiveRate": 1.2, "intendedLimit": 100
       }
     }
     ```
   - `POST` — control the simulation:
     - `{ action: "fire", count: 50, key?: "test-key" }` — fire a burst of requests
     - `{ action: "set-mode", mode: "coordinated" | "independent" }` — switch mode
     - `{ action: "set-nodes", count: 3-5 }` — change node count
     - `{ action: "reset" }` — clear all metrics
     - Returns updated metrics after each action

2. Integrate with existing config: Update `rate-limit-config.ts` to expose the `NodeCluster` singleton so both the simulation API and config API can reference it. When algorithm changes via `/api/v1/config`, also update the cluster's algorithm.

3. Update `/api/v1/config` route:
   - Add `simulation` field to GET response showing mode + node count
   - POST algorithm change should also call `cluster.setAlgorithm(algo)`

**Verify:**
```bash
npm run build
# Manual:
# curl http://localhost:3000/api/v1/simulation
# curl -X POST http://localhost:3000/api/v1/simulation -H "Content-Type: application/json" -d '{"action":"fire","count":50}'
# curl -X POST http://localhost:3000/api/v1/simulation -H "Content-Type: application/json" -d '{"action":"set-mode","mode":"coordinated"}'
```

---

## Verification Plan

### Automated Tests
```bash
npm test                    # All tests pass (Phase 1 + 2 + 3)
npm run build               # TypeScript strict mode, zero errors
```

### Manual Verification
```bash
npm run dev

# 1. Check initial state (3 nodes, independent mode)
curl -s http://localhost:3000/api/v1/simulation | jq .

# 2. Fire 150 requests in independent mode — should allow ~300 (3x limit)
curl -s -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action":"fire","count":150}' | jq '.aggregate'

# 3. Reset and switch to coordinated mode
curl -s -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" -d '{"action":"reset"}'
curl -s -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action":"set-mode","mode":"coordinated"}'

# 4. Fire 150 requests in coordinated mode — should allow exactly 100
curl -s -X POST http://localhost:3000/api/v1/simulation \
  -H "Content-Type: application/json" \
  -d '{"action":"fire","count":150}' | jq '.aggregate'

# 5. Verify per-node metrics show the difference
curl -s http://localhost:3000/api/v1/simulation | jq '.nodes'
```

### Key Assertion
The **core test** that proves the blog's thesis:
- Independent mode + 3 nodes + 150 requests → **~300 allowed** (3x overshoot)
- Coordinated mode + 3 nodes + 150 requests → **100 allowed** (exact limit)

This single comparison is the entire point of the project.

# PLAN — Phase 1: Project Scaffold & Rate Limiter Core

## Overview

Set up a Next.js 15 + TypeScript project with strict mode, implement four rate-limiting algorithms behind a clean Strategy interface, and build an in-memory store with per-key isolation. Remove old simulator files. This phase produces the entire `src/lib/rate-limiter/` module — the architectural heart of the project — with unit tests proving correctness.

## Architecture Decision: Directory Structure

```text
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (Phase 2)
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard page (Phase 4)
│   └── globals.css               # Global styles
├── lib/
│   └── rate-limiter/
│       ├── types.ts              # Core interfaces (RateLimiter, RateLimitResult, RateLimitStore)
│       ├── algorithms/
│       │   ├── fixed-window.ts   # Fixed Window Counter
│       │   ├── sliding-window-log.ts  # Sliding Window Log
│       │   ├── token-bucket.ts   # Token Bucket
│       │   └── sliding-window-counter.ts  # Sliding Window Counter
│       ├── stores/
│       │   └── memory-store.ts   # In-memory store with TTL cleanup
│       ├── factory.ts            # Algorithm factory (strategy selection)
│       └── index.ts              # Public API barrel export
└── __tests__/
    └── rate-limiter/
        ├── fixed-window.test.ts
        ├── sliding-window-log.test.ts
        ├── token-bucket.test.ts
        ├── sliding-window-counter.test.ts
        └── memory-store.test.ts
```

---

## Tasks

### Task 1 — tracer: Next.js Project Setup & One Algorithm End-to-End
**Type:** tracer
**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/rate-limiter/types.ts`, `src/lib/rate-limiter/algorithms/fixed-window.ts`, `src/lib/rate-limiter/stores/memory-store.ts`, `src/lib/rate-limiter/factory.ts`, `src/lib/rate-limiter/index.ts`, `src/__tests__/rate-limiter/fixed-window.test.ts`, `jest.config.ts`
**Requirements:** REQ-005, REQ-006, REQ-001, REQ-028, REQ-029

**What:**
1. Initialize Next.js 15 project with TypeScript strict mode using `npx create-next-app@latest`
2. Remove old simulator files (`index.js`, existing `package.json` content, `rate-limit-diagram.png`, `the-hidden-math-problem-behind-every-api-rate-limit.md`, `README.md` — keep the blog post if user wants)
3. Define core interfaces in `types.ts`:
   ```typescript
   export type AlgorithmType = 'fixed-window' | 'sliding-window-log' | 'token-bucket' | 'sliding-window-counter';

   export interface RateLimitConfig {
     windowMs: number;        // Window duration in milliseconds
     maxRequests: number;     // Maximum requests allowed per window
   }

   export interface RateLimitResult {
     allowed: boolean;
     limit: number;           // Configured max requests
     remaining: number;       // Requests remaining in current window
     resetAt: number;         // Unix timestamp (ms) when window resets
     retryAfterMs?: number;   // Milliseconds to wait before retrying (only on rejection)
   }

   export interface RateLimiter {
     check(key: string): RateLimitResult;
     reset(key: string): void;
     readonly algorithm: AlgorithmType;
   }

   export interface RateLimitStore<T> {
     get(key: string): T | undefined;
     set(key: string, value: T, ttlMs: number): void;
     delete(key: string): void;
     clear(): void;
   }
   ```
4. Implement `MemoryStore<T>` with Map-backed storage, TTL-based expiry, and periodic cleanup (setInterval every 60s)
5. Implement `FixedWindowLimiter` — first algorithm end-to-end:
   - Divides time into fixed windows of `windowMs`
   - Each key gets a counter per window
   - Counter resets when window boundary is crossed
   - Returns `remaining = max - count` and `resetAt = windowEnd`
6. Implement `createRateLimiter(algorithm, config)` factory function
7. Set up Jest with `ts-jest`, write tests for FixedWindowLimiter:
   - Allows requests up to limit
   - Rejects requests beyond limit in same window
   - Resets count in new window
   - Handles multiple keys independently
8. Minimal `layout.tsx` and `page.tsx` (placeholder — dashboard comes in Phase 4)
9. Verify: `npm run dev` starts, `npm test` passes

**Verify:**
```bash
npm test -- --testPathPattern=fixed-window
npm run build
```

---

### Task 2 — Sliding Window Log Algorithm
**Type:** implementation
**Files:** `src/lib/rate-limiter/algorithms/sliding-window-log.ts`, `src/__tests__/rate-limiter/sliding-window-log.test.ts`
**Requirements:** REQ-002
**Depends on:** Task 1

**What:**
1. Implement `SlidingWindowLogLimiter`:
   - Stores an array of request timestamps per key
   - On each check, removes timestamps older than `windowMs` ago
   - Counts remaining timestamps — if count < maxRequests, allow
   - `remaining = maxRequests - activeTimestamps.length`
   - `resetAt = oldestTimestamp + windowMs` (when the oldest active request expires)
   - Key trade-off: precise but O(n) memory per key — this is the point
2. Tests:
   - Allows requests up to limit
   - Rejects beyond limit
   - Old timestamps expire and free up capacity (use fake timers)
   - Multiple keys isolated
   - Memory grows with request count (observe timestamp array length)

**Verify:**
```bash
npm test -- --testPathPattern=sliding-window-log
```

---

### Task 3 — Token Bucket Algorithm
**Type:** implementation
**Files:** `src/lib/rate-limiter/algorithms/token-bucket.ts`, `src/__tests__/rate-limiter/token-bucket.test.ts`
**Requirements:** REQ-003
**Depends on:** Task 1

**What:**
1. Implement `TokenBucketLimiter`:
   - Config extends base: `bucketSize` (max tokens), `refillRate` (tokens per second)
   - Map `maxRequests` → `bucketSize`, derive `refillRate` from `maxRequests / (windowMs / 1000)`
   - On each check: calculate elapsed time since last check, add `elapsed * refillRate` tokens (capped at bucketSize), then consume one token if available
   - No background timer — lazy refill on each check (standard pattern)
   - `remaining = floor(currentTokens)`
   - `resetAt = now + ((bucketSize - currentTokens) / refillRate) * 1000`
   - `retryAfterMs = (1 / refillRate) * 1000` when rejected (time until one token refills)
2. Tests:
   - Starts with full bucket, allows burst up to bucketSize
   - Rejects when bucket is empty
   - Tokens refill over time (advance fake clock)
   - Partial refill (advance less than full refill period)
   - Multiple keys isolated

**Verify:**
```bash
npm test -- --testPathPattern=token-bucket
```

---

### Task 4 — Sliding Window Counter Algorithm
**Type:** implementation
**Files:** `src/lib/rate-limiter/algorithms/sliding-window-counter.ts`, `src/__tests__/rate-limiter/sliding-window-counter.test.ts`
**Requirements:** REQ-004
**Depends on:** Task 1

**What:**
1. Implement `SlidingWindowCounterLimiter`:
   - Tracks count for current window AND previous window
   - Weighted estimate: `estimate = prevCount * (1 - elapsedRatio) + currentCount`
   - Where `elapsedRatio = (now - currentWindowStart) / windowMs`
   - Allow if `estimate < maxRequests`
   - `remaining = max(0, floor(maxRequests - estimate))`
   - `resetAt = currentWindowStart + windowMs`
   - This is the Cloudflare approach — O(1) memory, near-perfect accuracy
2. Tests:
   - Allows up to limit within single window
   - Rejects beyond limit
   - Properly weights previous window (set up counts in prev window, advance time partway into new window, verify weighted count)
   - Window rollover clears old data
   - Multiple keys isolated

**Verify:**
```bash
npm test -- --testPathPattern=sliding-window-counter
```

---

### Task 5 — Memory Store Tests & Factory Wire-Up
**Type:** implementation
**Files:** `src/__tests__/rate-limiter/memory-store.test.ts`, update `src/lib/rate-limiter/factory.ts`, update `src/lib/rate-limiter/index.ts`
**Requirements:** REQ-005, REQ-006
**Depends on:** Task 2, Task 3, Task 4

**What:**
1. Write `memory-store.test.ts`:
   - Set/get/delete operations
   - TTL expiry (advance fake clock past TTL, verify get returns undefined)
   - Per-key isolation
   - `clear()` removes all entries
   - Cleanup interval removes expired entries
2. Update factory to register all four algorithms:
   ```typescript
   export function createRateLimiter(
     algorithm: AlgorithmType,
     config: RateLimitConfig
   ): RateLimiter {
     switch (algorithm) {
       case 'fixed-window': return new FixedWindowLimiter(config);
       case 'sliding-window-log': return new SlidingWindowLogLimiter(config);
       case 'token-bucket': return new TokenBucketLimiter(config);
       case 'sliding-window-counter': return new SlidingWindowCounterLimiter(config);
     }
   }
   ```
3. Update barrel export `index.ts` to re-export all public types, algorithms, factory
4. Run full test suite — all algorithms + store pass

**Verify:**
```bash
npm test
npm run build
```

---

## Verification Plan

### Automated Tests
```bash
npm test                    # All unit tests pass
npm run build               # TypeScript compiles with strict mode, zero errors
npm run dev                 # Dev server starts on localhost:3000
```

### Manual Verification
- Confirm `npm run dev` serves the placeholder page at `http://localhost:3000`
- Confirm no `any` types in `src/lib/rate-limiter/**/*.ts`
- Confirm old simulator files (`index.js`) are removed

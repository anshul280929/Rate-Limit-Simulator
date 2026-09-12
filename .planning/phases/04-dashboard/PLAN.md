# PLAN — Phase 4: Interactive Dashboard

## Overview

Build the real-time interactive dashboard that visualizes the distributed rate-limiting problem. The dashboard is the project's showcase piece — what makes a reviewer say *"this person understands distributed systems and can build polished UIs."*

**Design language:** Dark fintech aesthetic (Stripe Dashboard meets Vercel's design). Glassmorphism cards, gradient accents, smooth micro-animations. No frameworks beyond React — vanilla CSS with CSS custom properties for theming.

## Layout

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  RateGate ─ Distributed Rate Limiter Playground           [health: ok] │
├──────────────────────────┬──────────────────────────────────────────────┤
│  CONTROL PANEL           │  NODE TOPOLOGY                              │
│  ┌──────────────────┐    │  ┌─────┐  ┌─────┐  ┌─────┐                │
│  │ Algorithm: [▼]   │    │  │ N-0 │  │ N-1 │  │ N-2 │                │
│  │ Mode: [toggle]   │    │  │ ✓58 │  │ ✓52 │  │ ✓50 │                │
│  │ Nodes: [3]       │    │  │ ✗12 │  │ ✗18 │  │ ✗20 │                │
│  │ Burst: [50] [🔥] │    │  └─────┘  └─────┘  └─────┘                │
│  │ [Reset]          │    │  mode: independent │ coordinated            │
│  └──────────────────┘    ├──────────────────────────────────────────────┤
├──────────────────────────┤  METRICS BAR                                │
│  REQUEST LOG             │  Allowed: 160  Rejected: 50                 │
│  ┌──────────────────┐    │  Effective: 1.6×  Intended: 100             │
│  │ #210 N-1 ✓ 3ms   │    │  ██████████████░░░░░░ 76% allowed          │
│  │ #209 N-0 ✗ 1ms   │    │                                            │
│  │ #208 N-2 ✓ 2ms   │    │                                            │
│  │ #207 N-1 ✓ 1ms   │    │                                            │
│  │ ...scrolling...   │    │                                            │
│  └──────────────────┘    │                                            │
└──────────────────────────┴──────────────────────────────────────────────┘
```

## Directory Structure (new/modified files)

```text
src/
├── app/
│   ├── page.tsx                    # [REPLACE] Full dashboard — client component
│   ├── globals.css                 # [REPLACE] Complete design system
│   └── layout.tsx                  # [MODIFY]  Add viewport meta, update title
├── components/
│   ├── Dashboard.tsx               # Main dashboard orchestrator
│   ├── ControlPanel.tsx            # Algorithm picker, mode toggle, burst controls
│   ├── NodeTopology.tsx            # Visual node grid with per-node metrics
│   ├── MetricsBar.tsx              # Aggregate stats + progress bar
│   └── RequestLog.tsx              # Scrolling request feed
└── hooks/
    └── useSimulation.ts            # Custom hook: API calls + state management
```

---

## Tasks

### Task 1 — tracer: Design System + Hook + Dashboard Shell
**Type:** tracer
**Files:** `src/app/globals.css`, `src/hooks/useSimulation.ts`, `src/components/Dashboard.tsx`, `src/app/page.tsx`
**Requirements:** REQ-020, REQ-027

**What:**

1. **globals.css** — Complete design system:
   - CSS custom properties: colors (dark palette with purple/indigo accent), spacing scale, radii, shadows
   - Dark background: `#0a0a0f` base, `#12121a` card surfaces, `#1a1a2e` elevated surfaces
   - Accent gradient: indigo `#6366f1` → violet `#8b5cf6` → purple `#a78bfa`
   - Success/danger colors for allowed/rejected states
   - Glass effect: `backdrop-filter: blur(12px)` with semi-transparent backgrounds
   - Typography: Geist Sans for UI, Geist Mono for data/numbers
   - Component classes for cards, buttons, badges, inputs, progress bars
   - Smooth transitions on all interactive elements
   - Responsive grid layout using CSS Grid

2. **useSimulation.ts** — Custom hook for simulation API:
   ```typescript
   export function useSimulation() {
     // State
     const [metrics, setMetrics] = useState<ClusterMetrics | null>(null)
     const [logs, setLogs] = useState<LogEntry[]>([])
     const [loading, setLoading] = useState(false)

     // Actions
     const fire = (count: number) => { POST /api/v1/simulation { action: 'fire', count } }
     const setMode = (mode: ClusterMode) => { POST ... { action: 'set-mode', mode } }
     const setAlgorithm = (algo: AlgorithmType) => { POST ... { action: 'set-algorithm', algo } }
     const setNodeCount = (count: number) => { POST ... { action: 'set-nodes', count } }
     const reset = () => { POST ... { action: 'reset' } }
     const refresh = () => { GET /api/v1/simulation }

     // Initial load
     useEffect(() => { refresh() }, [])

     return { metrics, logs, loading, fire, setMode, setAlgorithm, setNodeCount, reset }
   }
   ```

3. **Dashboard.tsx** — Orchestrator component:
   - Uses `useSimulation()` hook
   - Renders header bar with logo + health indicator
   - CSS Grid layout: control panel (left), topology (right), metrics (bottom-right), log (bottom-left)
   - Passes state + actions to child components

4. **page.tsx** — Replace placeholder with `'use client'` + `<Dashboard />`

**Verify:**
```bash
npm run build
npm run dev   # Visual check: dark dashboard shell loads with layout grid
```

---

### Task 2 — Control Panel + Algorithm Switcher
**Type:** implementation
**Files:** `src/components/ControlPanel.tsx`
**Requirements:** REQ-021, REQ-023, REQ-024
**Depends on:** Task 1

**What:**

1. **ControlPanel.tsx** — All simulation controls in one card:
   - **Algorithm selector**: styled `<select>` dropdown with all 4 algorithms
     - Shows human-readable labels: "Fixed Window", "Sliding Window Log", etc.
     - Changing selection calls `setAlgorithm()`
   - **Mode toggle**: independent ↔ coordinated
     - Styled toggle switch with labels
     - Visual indicator: red badge "BROKEN" for independent, green "FIXED" for coordinated
   - **Node count**: number input or stepper (1–10 range)
   - **Burst controls**: count input (1–500) + "Fire 🔥" button
     - Button shows loading spinner during request
     - Pulse animation on click
   - **Reset button**: clears all metrics
   - All controls fire API calls and update state via the hook

**Verify:**
```bash
npm run dev  # Click each control, verify API calls fire correctly
```

---

### Task 3 — Node Topology + Metrics Bar
**Type:** implementation
**Files:** `src/components/NodeTopology.tsx`, `src/components/MetricsBar.tsx`
**Requirements:** REQ-022, REQ-025
**Depends on:** Task 1

**What:**

1. **NodeTopology.tsx** — Visual node grid:
   - Renders N cards, one per virtual node
   - Each card shows: node ID, allowed count (green), rejected count (red), total
   - Cards have a subtle pulsing glow when receiving requests
   - Color intensity scales with traffic: more requests → brighter glow
   - Shows current mode label with visual distinction
   - Layout: horizontal flex, wraps on small screens

2. **MetricsBar.tsx** — Aggregate statistics:
   - Total allowed / rejected with color-coded numbers
   - Effective rate badge: `1.0×` (green) to `3.0×+` (red gradient)
   - Intended limit display
   - Ratio progress bar: (allowed / total) as a visual bar
     - Green for coordinated mode (effective rate ≈ 1.0)
     - Red-orange gradient for independent mode (overshoot)
   - Animate counter changes with CSS transitions

**Verify:**
```bash
npm run dev  # Fire bursts, verify per-node metrics update and aggregate calculates correctly
```

---

### Task 4 — Request Log + Polish
**Type:** implementation
**Files:** `src/components/RequestLog.tsx`, `src/app/layout.tsx`
**Requirements:** REQ-026, REQ-027
**Depends on:** Task 1, Task 2, Task 3

**What:**

1. **RequestLog.tsx** — Scrolling request feed:
   - Each entry: request number, assigned node ID, allowed/rejected badge, timestamp
   - Auto-scrolls to bottom on new entries
   - Max 200 entries (oldest drop off)
   - Alternating row colors for readability
   - Monospace font for data alignment
   - Allowed entries: green dot + "ALLOW", rejected: red dot + "DENY"
   - New entries slide in with a brief highlight animation

2. **Layout polish**:
   - Update `layout.tsx` metadata
   - Add viewport meta for responsive behavior
   - Ensure the dashboard looks premium at common viewport sizes (1280px+)

3. **Final visual polish pass**:
   - Verify all animations are smooth (60fps)
   - Ensure color contrast meets accessibility guidelines (4.5:1 minimum)
   - Check that mode toggle clearly communicates the problem/fix narrative
   - Add subtle gradient borders on cards
   - Test full flow: switch algorithm → change mode → fire burst → observe difference

**Verify:**
```bash
npm run build               # Build passes
npm run dev                 # Full visual test
# Flow: independent mode → fire 150 → see 300 allowed (3× red badge)
# Then: coordinated mode → fire 150 → see 100 allowed (1× green badge)
```

---

## Verification Plan

### Build & Type Check
```bash
npm test                    # All 79+ tests pass
npm run build               # Zero errors, clean build
```

### Visual Verification
```bash
npm run dev
```
1. Dashboard loads at root URL with dark fintech theme
2. Algorithm dropdown lists all 4 algorithms, switching works without reload
3. Mode toggle switches between independent/coordinated
4. Node topology shows 3 cards with per-node metrics
5. Fire 150 requests → metrics update immediately
6. Request log scrolls with per-request detail
7. **Key demo flow:**
   - Independent mode + 150 burst → effective rate shows ~3.0× (red)
   - Reset → coordinated mode + 150 burst → effective rate shows 1.0× (green)
   - This single comparison tells the entire story

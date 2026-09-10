#!/usr/bin/env node

/**
 * Distributed rate limiter simulator
 *
 * Replays the SAME simulated traffic through three different rate-limiting
 * strategies so you can see how each one behaves under identical load:
 *
 *   1. naive     - every node enforces the full limit independently
 *   2. central   - every node checks one shared counter before allowing a request
 *   3. hybrid    - each node caches a local slice of budget and resyncs periodically
 *
 * All three strategies see the exact same stream of incoming requests, so
 * the differences you see in the final report come purely from the
 * coordination strategy -- not from randomness. See README.md for the
 * reasoning behind each strategy.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { nodes: 3, limit: 100, demand: 400, seconds: 3 };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    const m = arg.match(/^--(nodes|limit|demand|seconds)=(\d+)$/);
    if (m) opts[m[1]] = parseInt(m[2], 10);
  }
  return opts;
}

function printHelp() {
  console.log(`
Distributed rate limiter simulator

Usage:
  node index.js [options]

Options:
  --nodes=<n>     Number of edge/API nodes sharing one logical limit (default: 3)
  --limit=<n>     The intended global limit, in requests/second (default: 100)
  --demand=<n>    Total incoming requests/second across all nodes (default: 400)
  --seconds=<n>   How many simulated seconds of traffic to run (default: 3)
  -h, --help      Show this help message
`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomLatencyMs() {
  // simulated network round-trip to a shared store, in ms
  return 4 + Math.random() * 8;
}

// Build one shared traffic timeline (tick = 1ms) that every strategy replays.
function generateTraffic(nodes, demandPerSecond, seconds) {
  const totalTicks = seconds * 1000;
  const perTickPerNodeProbability = (demandPerSecond / 1000) / nodes;
  const requests = [];
  for (let tick = 0; tick < totalTicks; tick++) {
    for (let node = 0; node < nodes; node++) {
      if (Math.random() < perTickPerNodeProbability) {
        requests.push({ tick, node });
      }
    }
  }
  return requests;
}

async function simulateNaive(requests, nodes, limit) {
  const counters = new Array(nodes).fill(0);
  const throttle = Math.max(1, Math.floor(requests.length / 25));
  let currentSecond = 0;
  let allowed = 0;
  let rejected = 0;

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const second = Math.floor(req.tick / 1000);
    if (second !== currentSecond) {
      currentSecond = second;
      counters.fill(0);
    }
    if (counters[req.node] < limit) {
      counters[req.node]++;
      allowed++;
    } else {
      rejected++;
    }
    if (i % throttle === 0) {
      process.stdout.write(`\r${DIM}  naive:      allowed ${allowed}, rejected ${rejected}${RESET}   `);
      await sleep(0);
    }
  }
  process.stdout.write(`\r${' '.repeat(60)}\r`);
  return { allowed, rejected, totalLatencyMs: allowed * 0.05 };
}

async function simulateCentral(requests, nodes, limit) {
  const throttle = Math.max(1, Math.floor(requests.length / 25));
  let globalCount = 0;
  let currentSecond = 0;
  let allowed = 0;
  let rejected = 0;
  let totalLatencyMs = 0;

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const second = Math.floor(req.tick / 1000);
    if (second !== currentSecond) {
      currentSecond = second;
      globalCount = 0;
    }
    totalLatencyMs += randomLatencyMs(); // every request pays the round trip
    if (globalCount < limit) {
      globalCount++;
      allowed++;
    } else {
      rejected++;
    }
    if (i % throttle === 0) {
      process.stdout.write(`\r${DIM}  central:    allowed ${allowed}, rejected ${rejected}${RESET}   `);
      await sleep(0);
    }
  }
  process.stdout.write(`\r${' '.repeat(60)}\r`);
  return { allowed, rejected, totalLatencyMs };
}

async function simulateHybrid(requests, nodes, limit, syncIntervalMs) {
  const throttle = Math.max(1, Math.floor(requests.length / 25));
  let globalUsed = 0;
  let currentSecond = 0;
  const localBudget = new Array(nodes).fill(0);
  const nextSyncTick = new Array(nodes).fill(0);
  let allowed = 0;
  let rejected = 0;
  let totalLatencyMs = 0;

  function syncNode(node, tick) {
    totalLatencyMs += randomLatencyMs(); // sync pays the round trip, requests don't
    const remaining = Math.max(0, limit - globalUsed);
    localBudget[node] = Math.floor(remaining / nodes);
    nextSyncTick[node] = tick + syncIntervalMs;
  }

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const second = Math.floor(req.tick / 1000);
    if (second !== currentSecond) {
      currentSecond = second;
      globalUsed = 0;
      localBudget.fill(0);
      nextSyncTick.fill(second * 1000);
    }
    if (req.tick >= nextSyncTick[req.node]) {
      syncNode(req.node, req.tick);
    }
    if (localBudget[req.node] > 0) {
      localBudget[req.node]--;
      globalUsed++;
      allowed++;
    } else {
      rejected++;
    }
    if (i % throttle === 0) {
      process.stdout.write(`\r${DIM}  hybrid:     allowed ${allowed}, rejected ${rejected}${RESET}   `);
      await sleep(0);
    }
  }
  process.stdout.write(`\r${' '.repeat(60)}\r`);
  return { allowed, rejected, totalLatencyMs };
}

function fmtMs(totalMs, count) {
  if (count === 0) return '0.00ms';
  return `${(totalMs / count).toFixed(2)}ms`;
}

function printReport(opts, results) {
  const trueLimit = opts.limit * opts.seconds;
  const rows = [
    { name: 'Naive (per-node counters)', color: RED, r: results.naive },
    { name: 'Centralized shared counter', color: GREEN, r: results.central },
    { name: 'Hybrid (cache + periodic sync)', color: CYAN, r: results.hybrid },
  ];

  console.log('');
  console.log(`${BOLD}Rate limiter comparison${RESET}`);
  console.log(`${DIM}${opts.nodes} nodes, intended limit ${opts.limit}/sec, incoming demand ~${opts.demand}/sec, ${opts.seconds}s simulated${RESET}`);
  console.log('');

  for (const row of rows) {
    const received = row.r.allowed + row.r.rejected;
    const overLimitFactor = row.r.allowed / trueLimit;
    console.log(`${row.color}${BOLD}${row.name}${RESET}`);
    console.log(`  requests received:     ${received}`);
    console.log(`  requests allowed:      ${row.r.allowed}`);
    console.log(`  requests rejected:     ${row.r.rejected}`);
    console.log(`  intended total limit:  ${trueLimit}`);
    console.log(`  effective vs intended: ${overLimitFactor.toFixed(2)}x`);
    console.log(`  avg added latency:     ${fmtMs(row.r.totalLatencyMs, received)}`);
    console.log('');
  }

  console.log(`${DIM}(numbers are from a simulation, not a live benchmark -- see README.md)${RESET}`);
  console.log('');
}

async function main() {
  const opts = parseArgs();
  const requests = generateTraffic(opts.nodes, opts.demand, opts.seconds);

  console.log(`\n${BOLD}Replaying ${requests.length} simulated requests through each strategy...${RESET}\n`);

  const naive = await simulateNaive(requests, opts.nodes, opts.limit);
  const central = await simulateCentral(requests, opts.nodes, opts.limit);
  const hybrid = await simulateHybrid(requests, opts.nodes, opts.limit, 100);

  printReport(opts, { naive, central, hybrid });
}

main();

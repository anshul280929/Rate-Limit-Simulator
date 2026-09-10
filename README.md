# Rate limit simulator

A small terminal simulation that shows why "100 requests per second" is much
harder to actually enforce than it sounds, the moment your API is spread
across more than one server. It replays the same simulated traffic through
three different rate-limiting strategies and prints a side-by-side report.

## The problem

When a platform promises a customer a rate limit, that's supposed to be one
number for their whole account — not one number per server that happens to
handle their traffic. But incoming requests get load-balanced across many
interchangeable nodes, and if each node just keeps its own private counter,
the math quietly breaks: an intended limit of 100/sec enforced independently
by 3 nodes can let roughly 300/sec through in total. Nobody misconfigured
anything — the limiter itself just stopped being global the moment the
system stopped being one machine.

Real platforms close this gap with strategies that trade off accuracy,
latency, and complexity differently. This simulator models three of them:

1. **Naive (per-node counters)** — every node enforces the full limit on its
   own, with zero visibility into what the other nodes are doing.
2. **Centralized shared counter** — every node checks and updates one shared
   counter before allowing a request, so there's a single source of truth.
   Accurate, but every request now pays a simulated network round trip.
3. **Hybrid (cache + periodic sync)** — each node caches a local slice of
   the remaining budget and only reconciles with the shared counter every
   100ms, instead of on every single request.

## What the demo does

`index.js` generates one shared stream of simulated incoming requests (each
tagged with which node it lands on) and replays that *exact same* stream
through all three strategies, so the differences you see in the final report
come purely from the coordination strategy, not from random chance.

For each strategy it tracks:

- how many requests were allowed vs. rejected
- the effective allowed rate compared to the intended limit
- the average latency the rate-limit check itself added per request

The default settings (3 nodes, a 100/sec intended limit, ~400/sec incoming
demand) are tuned so the naive strategy lands almost exactly at 3x the
intended limit — the same number used as the running example in the
accompanying blog post on this topic.

## Running it

Requires only Node.js (v14+). No dependencies to install.

```bash
node index.js
```

Optional flags:

```bash
node index.js --nodes=5 --limit=50 --demand=500 --seconds=2
```

```bash
node index.js --help
```

| Flag         | Meaning                                            | Default |
|--------------|-----------------------------------------------------|---------|
| `--nodes`    | Number of nodes sharing one logical limit           | 3       |
| `--limit`    | Intended limit, in requests/second                  | 100     |
| `--demand`   | Total incoming requests/second across all nodes     | 400     |
| `--seconds`  | How many simulated seconds of traffic to run        | 3       |

## Example output

```
Rate limiter comparison
3 nodes, intended limit 100/sec, incoming demand ~400/sec, 3s simulated

Naive (per-node counters)
  requests received:     1233
  requests allowed:      900
  requests rejected:     333
  intended total limit:  300
  effective vs intended: 3.00x
  avg added latency:     0.04ms

Centralized shared counter
  requests received:     1233
  requests allowed:      300
  requests rejected:     933
  intended total limit:  300
  effective vs intended: 1.00x
  avg added latency:     7.76ms

Hybrid (cache + periodic sync)
  requests received:     1233
  requests allowed:      294
  requests rejected:     939
  intended total limit:  300
  effective vs intended: 0.98x
  avg added latency:     0.59ms
```

The naive strategy lets roughly 3x the intended traffic through at almost no
added latency. The centralized strategy enforces the limit exactly, but pays
a real per-request latency cost. The hybrid strategy lands close to the true
limit at a fraction of the centralized strategy's latency — the same
trade-off real platforms lean on at global scale.

## Ideas for extending this

- Swap the simulated network latency and in-memory counters for a real Redis
  instance to see the centralized and hybrid strategies behave against an
  actual shared store.
- Model Stripe-style layered limiters by adding a second, stricter limit for
  a subset of "critical" request types.
- Sweep `--nodes` or `--demand` across a range of values and plot how the
  naive strategy's overshoot grows with fleet size.

# The Hidden Math Problem Behind Every API Rate Limit

Picture two front desks at the same gym, both enforcing "max 50 guests inside at once." Sounds airtight — until you realize neither desk knows what the other is counting. If 40 people walk in through door A and 40 more through door B, the gym now has 80 people inside, even though every single front desk did its job correctly by its own count.

That, almost exactly, is the problem every large-scale API runs into the moment it grows past a single server.

## The promise that quietly breaks

When a platform like Stripe or Cloudflare tells you "100 requests per second," that's supposed to be one number — a promise about your account, not about any particular machine. But your requests don't politely queue up and hit the same server every time. They get load-balanced across dozens, sometimes hundreds, of interchangeable servers spread across regions, chosen by whichever one happens to be free at that millisecond.

Here's the part that surprises a lot of people the first time they design a rate limiter: if each of those servers just keeps its own private counter — "I've let 100 through, that's my limit for the second" — the actual number your account can push through is 100 × however many servers happen to answer your traffic. Fifty servers, each innocently enforcing "100/sec," and your effective limit just became 5,000. Nobody lied, nobody misconfigured anything — the math just quietly stopped adding up the moment the system stopped being one machine.

That's exactly the failure mode a rate limiter exists to prevent — one bad actor, or one buggy retry loop, blowing past intended limits — except now the system itself is the accidental accomplice.

## What this actually looks like

![Diagram comparing naive per-server rate limiting, which lets roughly 300 requests through, against a shared counter approach that correctly enforces exactly 100 requests per second](./rate-limit-diagram.png)

On the left: three servers, each confidently enforcing its own 100/sec, with zero visibility into what the other two are doing. Add them up and you get roughly 300 requests slipping through — three times what was promised. On the right: the same three servers, but this time they all check in with one shared source of truth before letting a request pass. The result: exactly 100, no matter how many servers happen to be involved.

## How the big players actually close the gap

**A single, shared counter.** Instead of each server trusting its own memory, they all check and update one shared store — usually something like Redis — using atomic operations, so two servers can't both read "99" and both decide to let request #100 through at the same instant. It's a clean fix, but it comes with a cost: every request now needs a round trip to that shared store, adding latency you didn't have before.

**Layered limiters instead of one blunt cutoff.** Stripe's own engineering writing describes running several rate limiters at once, not just one: a plain per-second request limiter, a separate cap on how many requests you can have in flight simultaneously, and load-shedding rules that decide how much of total system capacity lower-priority traffic is even allowed to touch. Stack them right, and something like an actual payment charge never gets stuck behind someone looping a "list my past transactions" call.

**Cache locally, sync eventually.** The most latency-sensitive systems don't check the shared counter on every single request — that would be too slow at global scale. Instead, each server keeps an approximate local count and reconciles with the shared source every so often. Cloudflare's edge network works roughly this way: enforcing limits right at the edge, close to the user, while staying loosely synced with the global picture. You trade a sliver of short-term precision for a large amount of speed — and at the volumes these companies operate at, that trade is almost always worth it.

## Why this matters more than it sounds like it should

It's easy to treat rate limiting as a "just add a counter" problem — until you realize the counter is the entire reason your system can't be abused, and counting correctly across a fleet of machines that don't share memory turns out to be one of the genuinely hard problems in distributed systems. It touches consistency, latency, and cost all at once, and there's no single "correct" answer — just different trade-offs that companies like Stripe, Cloudflare, and AWS have each leaned into differently, depending on what they can least afford to get wrong.

So the next time an API hands you back a clean little `429 Too Many Requests`, there's a decent chance a surprisingly intricate piece of distributed coordination just quietly did its job.

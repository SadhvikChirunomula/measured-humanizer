# What a retry storm looks like from the inside

We took a downstream service offline for eleven minutes last Thursday, and the
outage wasn't caused by the bug we shipped that morning. It was caused by the
retry policy responding to the bug. Every client retried three times without
randomization, the retries landed inside the same 200ms window, and a dependency
that had been failing one endpoint intermittently started failing all of them
consistently.

The arithmetic is worth doing once.

Suppose a service handles two thousand requests per second and starts failing 5%
of them. With three immediate retries, a hundred failures become four hundred
additional requests, and they arrive coordinated rather than distributed across
the interval, because every client noticed the failure simultaneously. That load pushes
the error rate up, which produces more retries, which pushes it up further. We
measured 6800 requests per second at the peak against something provisioned
comfortably for 2500.

We dropped max-retries to 2 and added full jitter. The storm stopped.

### How do we tell a retry storm from a traffic spike?

A traffic spike scales up smoothly and its request mix stays roughly constant. A
retry storm arrives as a step function inside a single retry interval, and the mix
skews hard toward whichever endpoint failed first. Check the ratio of retried to
initial requests before anything else. Our client library instruments it as
retry-attempt on every outbound span, and during the incident it went from 0.02
to 0.71 in under four seconds.

Latency is the other tell. Retries queue behind the requests they're retrying, so
p99 climbs steeply while p50 barely moves at all.

## What we changed

1. Full jitter on every retry, never exponential backoff by itself.
2. A retry budget capped at 10% of outbound requests per client.
3. Retry only on 429 and 503, never on a 500.
4. A circuit breaker that opens at a 50% error rate measured over 10s.

The retry budget did the most work of those four. Backoff alone still lets every
client retry eventually, so the storm arrives later and smeared instead of never
arriving, and under sustained failure a budget is the only mechanism that
actually caps the amplification. The [AWS builders' library on timeouts and
backoff](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
documents the standard treatment.

```
retry_ratio = retries_sent / requests_sent
alert if retry_ratio > 0.10 sustained for 60s
```

We alert on that ratio now, and it's caught two smaller recurrences since.

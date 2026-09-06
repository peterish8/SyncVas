# 21 — Performance and Scalability

## Performance priorities

1. teacher pen latency
2. correct board delivery
3. reconnect correctness
4. teacher UI responsiveness
5. doubts/AI

## Board broadcast strategy

Avoid emitting every raw browser pointer event. Let Excalidraw produce scene updates; batch/throttle network broadcasts enough to reduce event volume while keeping perceived drawing live. Benchmark on real hardware before choosing final interval.

Viewport updates can be more aggressively throttled/coalesced because only the latest camera matters.

## Late join

A late joiner must not replay the entire history. Send current scene snapshot then subsequent updates.

## Convex

- indexed queries
- paginate class history
- avoid large board JSON in normal DB documents
- use storage for large blobs
- keep reactive queries narrow

## Socket scale progression

Stage 1: one instance.
Stage 2: load test and profile.
Stage 3: shared adapter/broker + multiple instances only when needed.

Do not introduce distributed realtime infrastructure before the single instance is proven insufficient.

## AI

AI is off the pen path. A slow model must never degrade drawing.

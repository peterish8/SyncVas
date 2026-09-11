# 20 — Deployment and Environment Specification

## Local development

Run three processes:
1. Next.js dev server
2. `npx convex dev`
3. Socket.IO Node server

Recommended ports:
- web: 3000
- socket: 4001

## Production

- Next.js: Vercel
- Convex: Convex deployment
- Socket.IO: persistent WebSocket-capable Node host

Do not assume ordinary request/response serverless functions are equivalent to owning a long-lived WebSocket process. Verify chosen host's Socket.IO/WebSocket deployment guidance before production.

## The relay runs at exactly one replica

This is a correctness constraint, not a capacity choice.

Every piece of relay state lives in process memory: the teacher writer lease
(`server.ts`), the hot scene and revocation tombstones (`board-hot-state.ts`),
the per-address connection counters, and the per-socket rate counters
(`rate-limit.ts`). Socket.IO requires **sticky sessions plus an adapter** to
span instances ([using multiple nodes](https://socket.io/docs/v4/using-multiple-nodes/));
this relay has neither.

At two or more replicas nothing throws. The classroom simply stops agreeing with
itself:

| State | Failure at 2 replicas |
| --- | --- |
| Teacher writer lease | Two teacher sockets, one per instance, both admitted as the sole writer |
| Hot board scene | Students on different instances see different boards |
| `board:current` | Returns an empty scene to anyone whose instance never saw an update |
| `/internal/revoke-room` | Evicts only the instance the request happened to reach; the rest keep relaying an ended class |

Because every one of those is silent, the deploy is the only place to catch it.
The relay therefore refuses to boot in production unless
`RELAY_SINGLE_INSTANCE=1` is set. **Pin replicas/min-instances/max-instances to
1 and disable autoscaling on the relay service.** Adding a Redis (or other)
Socket.IO adapter and sticky-session routing is the prerequisite for ever
raising that number.

## Relay behind a proxy

The relay applies a per-address concurrent-connection cap. Behind a load
balancer, every socket presents the balancer's address, so the cap must be told
where the real client address is:

- `RELAY_TRUST_PROXY=1` — the relay sits behind **exactly one** trusted proxy.
  The client address is read from the **last** `X-Forwarded-For` hop, which is
  the entry your own proxy appended; a client that forges the header only
  pollutes entries to its left.
- `RELAY_TRUST_PROXY=0` — clients connect to this process directly.

Production refuses to boot unless one of the two is set explicitly. Guessing
wrong fails in one of two silent ways: `0` behind a balancer collapses every
client onto a single address and throttles the whole service (one full classroom
already exceeds `maxSocketsPerIp`), while `1` without a proxy makes the cap
bypassable with a header. If more than one proxy hop sits in front of the relay,
the last-hop rule no longer identifies the client and this needs revisiting
before the cap can be trusted.

## Environments

- local
- preview/dev
- production

Use different Convex deployments and secrets.

## Secrets

Never expose server signing secret or AI API keys through `NEXT_PUBLIC_*`.

## CORS/origin

Socket service uses explicit allowed origins for known web deployments. Do not use permissive `*` with credentialed auth.

## Release checklist

- tests green
- Convex schema/indexes deployed
- production origins configured
- socket signing keys match issuer/verifier
- AI usage caps enabled
- license notices present
- final board persistence tested
- XP-Pen tested in production browser

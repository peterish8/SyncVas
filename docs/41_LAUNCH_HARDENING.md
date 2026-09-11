# 41 — Launch hardening

What was hardened for the public launch, why each item mattered, and the go-live
checklist. Companion to `27_DEPLOYMENT_RUNBOOK.md`, which covers the mechanics of
deploying; this document covers what makes a deploy *safe*.

## The three runtimes

| Runtime | Deployed as | Health |
| --- | --- | --- |
| Next.js app | Vercel (or any Node host) | the site itself |
| Convex | `npx convex deploy` | Convex dashboard |
| Socket.IO relay | container (`socket-server/Dockerfile`) | `GET /healthz` |

The relay is the only always-on process you operate yourself. It is also the only
one with unbounded in-memory state, so most of the work below is about it.

## What was fixed

### Transport ceiling matched the protocol ceiling

`shared/protocol/socket.ts` allows a board scene up to 900 KB plus binary files up
to 2 MB. Socket.IO's default `maxHttpBufferSize` is 1 MB, and a frame above it is
dropped **and the connection closed** before any validation runs. A lesson using
`/code` or `/math` blocks (which render to images) would have killed the teacher's
socket rather than reporting an oversized board.

The limits are now named exports (`MAX_BOARD_SCENE_BYTES`, `MAX_BOARD_FILES_BYTES`,
`MAX_BOARD_ENVELOPE_BYTES`) and the relay derives its buffer from them, so the two
cannot drift again. Asserted by `socket-server/test/hardening.test.ts`.

### The relay answered no HTTP request

Only `POST /internal/revoke-room` was handled; every other request — including a
platform health probe — received no response at all and hung until the client
timed out. There is now `GET /healthz` (and `/`) returning service status, and a
404 for anything else.

### Two unbounded maps

`revokedRooms` grew by one entry per class ended, forever. `rooms` held the full
scene (including binary files) for any room whose teacher simply closed the tab,
because only an explicit end called `clearHotScene`. Both are now swept on a
timer: idle rooms after 6 h, revocation tombstones after 1 h. A room whose
viewport is still moving counts as active, so a long lesson is never swept
mid-class.

### Hot-path logging

`board:update` and `teacher:viewport` each wrote a `console.info` per event —
at stroke and scroll frame rate. Now behind `SOCKET_DEBUG_EVENTS=1`.

### Amplification and flooding

`board:request-current` makes the relay serialize and send the whole scene, so one
small frame could pull megabytes repeatedly. It is now rate-limited per socket
(12/min), as is `board:update` (600/min). Rooms also cap student sockets at 400.

### Fail-fast configuration

The relay exits non-zero when `SOCKET_INTERNAL_SECRET` is missing or under 32
characters in production. Previously it would start, pass health checks, and
reject every classroom token — the worst possible failure shape.

The Next app runs `assertProductionEnv()` from `next.config.ts` during build and
start. On a real deploy (`VERCEL_ENV=production` or `SYNCVAS_ENFORCE_ENV=1`) a
missing `NEXT_PUBLIC_APP_URL`, a `localhost` value copied from a developer
machine, a set `ALLOW_DEV_TEACHER`, or a relay origin list that omits the site's
own origin all fail the build instead of shipping.

### Security headers

There was no `next.config` at all, so the app shipped with none. Now set:
HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, and a CSP. `poweredByHeader` is off. Classroom and auth
routes are `no-store`.

**The CSP ships Report-Only.** The policy is believed correct but has not been
exercised against an enforcing browser on every classroom path, and Excalidraw's
worker and font loading is the risk. Run a full lesson, watch the console for
violations, then set `CSP_ENFORCE=1` — no code change. That flag also adds
`upgrade-insecure-requests`, which is held back until then because browsers
ignore it in a report-only policy and log a console error for it on every
page load.

### Error and loading states

`app/error.tsx`, `app/global-error.tsx`, and `app/not-found.tsx` did not exist, so
an uncaught render error showed Next's raw error screen to a teacher mid-lesson.
They now render product copy through `lib/user-facing-errors.ts` and expose only
the error digest, never a message that could contain board or doubt text.
`loading.tsx` was added for the server-rendered student and join routes.

### Dev-only routes and backdoors

`/mockups/teacher-directions` was a public production route; it now 404s outside
development. Every `*AsLocalTeacher` Convex function is asserted to sit behind a
dev-only guard by `SEC-05` in `tests/security/permissions.test.ts`, so a new
variant added without one fails the suite rather than shipping an anonymous
teacher identity.

## Go-live checklist

### 1. Relay

```bash
docker build -f socket-server/Dockerfile -t syncvas-relay .
```

Set on the relay host:

- `NODE_ENV=production`
- `SOCKET_INTERNAL_SECRET` — 32+ random chars, identical to the Convex value
- `ALLOWED_WEB_ORIGINS` — the site's exact HTTPS origin, comma-separated, no `*`
- `SOCKET_PORT` — if the platform does not inject one

Confirm `GET /healthz` returns 200 before pointing the app at it.

### 2. Convex

```bash
npx convex deploy
```

Set on the deployment (`npx convex env set …`): `SOCKET_INTERNAL_SECRET`,
`SOCKET_SERVICE_INTERNAL_URL` (the relay's public URL — without it, ending a class
does not evict live sockets until their 5-minute tokens expire), and the auth
values. Confirm `ALLOW_DEV_TEACHER` is **not** set.

### 3. Next app

Set `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SOCKET_URL` (https), `NEXT_PUBLIC_APP_URL`
(canonical https origin), `SOCKET_INTERNAL_SECRET`, and `ALLOWED_WEB_ORIGINS`.
Do **not** set `ALLOW_DEV_TEACHER`, `ALLOW_PROOF_SOCKET`, or
`NEXT_PUBLIC_ENABLE_LOCAL_TEACHER` — the preflight rejects all three.

On a non-Vercel host, set `SYNCVAS_ENFORCE_ENV=1` so the preflight actually runs.

### 4. Verify after deploy

- `curl -sI https://<site>/ | grep -i strict-transport` returns the HSTS header
- `https://<site>/robots.txt` shows the real origin, not `localhost`
- `https://<site>/mockups/teacher-directions` returns 404
- `POST https://<site>/api/proof-socket-token` returns 403
- One teacher and two student tabs complete the full flow in `docs/25_ACCEPTANCE_TESTS.md`
- Console shows no CSP violations, then set `CSP_ENFORCE=1` and redeploy

## Known gaps at launch

- **CSP is Report-Only** until a full classroom run confirms no violations.
- **No error reporting sink.** `SENTRY_DSN` is in `.env.example` but nothing reads
  it; errors reach the platform log only.
- **No load evidence above the 100-viewer smoke** in `tests/load/viewers-100.test.ts`.
  The 400-socket room cap is a guardrail, not a measured limit.
- **Relay hot state is per-process.** Running more than one relay instance splits
  rooms across them; run exactly one, or add a shared adapter first.

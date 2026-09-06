# 30 — Implementation Backlog

## Epic A — Project foundation
- [ ] Create Next.js TypeScript App Router project
- [ ] Configure Tailwind/shadcn
- [ ] Initialize Convex
- [ ] Add `socket-server` Node/TypeScript package
- [ ] Shared runtime schemas/types
- [ ] CI commands: lint, typecheck, test

## Epic B — Teacher board
- [ ] Client-only Excalidraw wrapper
- [ ] Teacher editor route
- [ ] Verify XP-Pen
- [ ] Capture scene changes
- [ ] Board version counter

## Epic C — Realtime viewing
- [ ] Socket token issuer/verifier
- [ ] Session room middleware
- [ ] Teacher-only board update handler
- [ ] Student current-scene bootstrap
- [ ] Reconnect/resync

## Epic D — Session lifecycle
- [ ] Convex session schema/indexes
- [ ] Create/start/end mutations
- [ ] Join code generator
- [ ] QR join route
- [ ] Anonymous participant identity

## Epic E — Follow teacher
- [ ] Capture teacher viewport
- [ ] Throttle viewport events
- [ ] Follow state
- [ ] Manual navigation exits follow
- [ ] Return button

## Epic F — Doubts
- [ ] Convex doubt schema
- [ ] Submit mutation
- [ ] Rate limiter
- [ ] Teacher reactive queue
- [ ] Answer/dismiss
- [ ] Same-doubt vote

## Epic G — Moderation
- [ ] Deterministic filters
- [ ] AI adapter interface
- [ ] Strict moderation schema
- [ ] Async classification
- [ ] uncertain fallback

## Epic H — Persistence/export
- [ ] Snapshot serializer
- [ ] Convex storage path
- [ ] Finalization workflow
- [ ] Board export
- [ ] History page

## Epic I — Hardening
- [ ] Permission tests
- [ ] Three-browser E2E
- [ ] 100-viewer load test
- [ ] observability
- [ ] production environment

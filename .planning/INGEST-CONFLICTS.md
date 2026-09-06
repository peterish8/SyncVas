# Ingest Conflicts

### BLOCKERS (0)

None.

### WARNINGS (2)

1. **P0 final-save ordering** — `docs/03_MVP_SCOPE.md` requires a final board save before any P1 work, but `docs/22_ROADMAP_AND_MILESTONES.md` lists persistence after moderation. The executable roadmap resolves this by extracting minimal final-board persistence as Phase 6 (P0), then starting P1 moderation in Phase 7. Export/history/reconnect polish remains after moderation. Source documents are unchanged.
2. **External integration ordering** — the user explicitly requested API integrations last. The roadmap therefore keeps Convex and Socket.IO in their required core phases, but defers only the credentialed third-party AI provider connection to Phase 10. The existing AI adapter and safe fallback remain part of Phase 7 so the product never depends on that provider.

### INFO (4)

1. **Milestone 0 is verified** — Next.js, a local Convex health query, and Socket.IO ping respond; lint, typecheck, tests, and build passed. The roadmap starts at Foundation Close-out because the schema and full protocol contract remain incomplete.
2. **AI summary pipeline** (`docs/15`) is product-adjacent but MVP marks AI structured notes as P2 / Milestone 8 — classified as **v2 deferred**, not v1 phase work. End-class must still succeed if AI summary fails.
3. **P0 vs P1 gate** — `docs/03` says do not start P1 until all P0 acceptance tests pass in 2 student tabs + 1 teacher tab. The roadmap now encodes this after Phase 6, which includes the P0 final-save requirement.
4. **Visual reference is a constraint, not a feature** — the user-supplied tablet reference informs `docs/05` and `docs/06` only. Planning adopts its warm-neutral, contained-accent treatment without importing its dashboard information architecture.

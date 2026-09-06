# 31 — Coding Agent Kickoff Prompt

Paste the following into Codex/Claude Code after placing this docs pack in the repository:

```text
You are the implementation agent for this repository. Before writing code, read AGENTS.md and docs/00_START_HERE.md, then read docs/02_PRD.md, docs/03_MVP_SCOPE.md, docs/07_TRD.md, docs/08_SYSTEM_ARCHITECTURE.md, docs/09_CONVEX_DATA_MODEL.md, docs/11_REALTIME_SOCKET_PROTOCOL.md, docs/12_EXCALIDRAW_INTEGRATION.md, docs/22_ROADMAP_AND_MILESTONES.md, and docs/25_ACCEPTANCE_TESTS.md.

Implement only Milestone 0 first. Do not start later milestones until Milestone 0 is verified. Use current official documentation and installed package types as the source of truth for APIs. Do not add Yjs, Redis, microservices, student accounts, student editing, video/audio, or payments.

Architecture invariants:
- Convex is durable product/backend state.
- Socket.IO is ephemeral high-frequency board + teacher viewport transport.
- Only the teacher edits the board in MVP.
- Students are read-only and can independently pan/zoom.
- Do not stream raw pen points through Convex.
- Excalidraw runs client-side.
- Public Convex functions require validation and authorization.
- Socket role is derived from a server-issued signed token, never a client claim.

For the milestone: first show the files/commands you intend to change, then implement, then run lint/typecheck/tests, report exact results, and list any remaining TODOs. Keep the architecture simple and follow the docs when making tradeoffs.
```

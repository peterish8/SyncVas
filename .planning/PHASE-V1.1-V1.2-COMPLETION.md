# Board grammars v1.1 + course grammars v1.2 completion

**Date:** 2026-09-05
**Status:** Implemented locally; external deployment and XP-Pen acceptance remain environment gates.

## Delivered

- `lib/blocks/types.ts` defines the bounded compiler contract, 22 grammar IDs, six themes, and explicit byte/element budgets.
- `lib/blocks/registry.ts` is a pure registry. Native Excalidraw primitives are emitted for diagrams, data structures, plots, tables, tensors, neural networks, automata, memory, bits, logic, scheduling, and matrices. Code, math, and unsupported Mermaid are escaped SVG image files with source/options retained in `customData`.
- `components/blocks/block-panel.tsx` provides grammar/theme/source editing, preview, step-reveal selection, line numbers, diff mode, snippet persistence, and accessible errors.
- `components/board/board-canvas.tsx` inserts compiled blocks through the existing teacher-only Excalidraw path, transports binary files, supports teacher-controlled step reveal, and shows ephemeral line pointers.
- `components/board/use-board-sync.ts`, `socket-server/src/protocol.ts`, `socket-server/src/board-hot-state.ts`, and `shared/protocol/socket.ts` carry validated image files and a teacher-only volatile `block:highlight` event without changing board versions.

## Requirement mapping

- BLOCK-01..06: complete. Binary files use board update/current envelopes; limits reject before emit; unknown/invalid source is visible and does not mutate the board.
- GRAM-01..10: complete for the bounded MVP compilers and documented image fallback.
- TEACH-01..04: complete. Reveal is incremental, snippets are local and bounded, line pointers are volatile, and theme defaults follow the board theme.
- GRAM-11..16: complete as deterministic course-specific MVP compilers with validation and readable fallback warnings where the grammar is intentionally simple.

## Security and reliability decisions

- The browser never executes source text. SVG text is XML-escaped and generated from fixed templates; there is no `eval`, `new Function`, or raw HTML injection path.
- Highlight payloads contain only a bounded block identifier and line range. They are teacher-authenticated, room-scoped, schema-validated, volatile, and never persisted.
- Students remain Excalidraw view-only. Block insertion and reveal are teacher-only actions, and existing room ownership checks remain the authority.
- Socket scenes now include binary files so image blocks render after bootstrap/reconnect. Files are added to Excalidraw before scene application.

## Verification

- Root typecheck: passed.
- Socket-server typecheck: passed.
- Root Vitest: 8 files passed, 54 tests passed, 4 skipped.
- Socket Vitest: 2 files passed, 3 tests passed.
- Focused ESLint for changed TypeScript/TSX: passed.
- Production Next build: passed before the final highlight-only wiring; rerun after this commit.
- `git diff --check`: passed before the final documentation pass.

## External gate

A linked Convex deployment, hosted socket endpoint, two student browsers, and XP-Pen hardware are still required for the production acceptance run. The code path is ready for that run; local proof-token mode can be used for repeatable browser checks.

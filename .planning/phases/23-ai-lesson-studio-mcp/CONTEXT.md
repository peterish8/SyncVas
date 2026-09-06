# Phase 23 context — AI Lesson Studio & MCP

Read before planning implementation:

- `docs/34_AI_BOARD_AUTHORING.md`
- `docs/36_MCP_LESSON_AUTHORING.md`
- `docs/38_AI_LESSON_STUDIO_AND_MCP.md`
- `.planning/AI-LESSON-MCP-DECISIONS.md`
- `C:\Users\nithy\nk\apps\web\lib\mcp-server.ts`
- `C:\Users\nithy\nk\apps\web\lib\mcp-execution.ts`
- `C:\Users\nithy\nk\apps\web\lib\bearer-auth.ts`

The implementation must reuse SyncVas's provider-neutral AI adapter, Convex ownership checks, block compiler registry, prepared-board/template model, and quiz projections. Do not copy NotesKit's Mongo/domain layer or expose student data. The public endpoint must be hosted HTTPS for ChatGPT/Claude; local-only proof is not production acceptance.

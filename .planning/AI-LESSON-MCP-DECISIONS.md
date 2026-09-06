# AI lesson authoring + MCP planning decisions

**Decision date:** 2026-09-05

1. SyncVas has one `LessonAuthoringService`; the in-app AI adapter and remote MCP are thin callers.
2. The service accepts structured lesson intent and emits a teacher-owned `LessonDraft` containing grammar source, explanations, and quiz data. Models never emit Excalidraw element JSON or coordinates.
3. MCP is stateless at the request-processing layer. Durable drafts, OAuth grants, idempotency receipts, and audit records belong in Convex. Protocol lifecycle messages may still be handled for client interoperability.
4. Every external write is draft-only until the teacher explicitly publishes a prepared template. No MCP tool reaches a live room or student data.
5. ChatGPT custom apps and Claude remote MCP both require a public HTTPS endpoint in hosted use; availability of write actions depends on the client plan/workspace and must be tested per integration.
6. Security baseline follows the working NotesKit reference at `C:\Users\nithy\nk`: grant-derived identity, PKCE, protected-resource metadata, hashed tokens, revocation on every request, rate limits, confirmation, idempotency, sanitized errors, and no sensitive-content telemetry.
7. The current MCP Streamable HTTP specification is the compatibility baseline. Do not promise that a historical “2026-07-28 stateless” profile is universally supported; advertise and test the versions supported by the deployed SDK.

See `docs/38_AI_LESSON_STUDIO_AND_MCP.md`, `docs/34_AI_BOARD_AUTHORING.md`, and `docs/36_MCP_LESSON_AUTHORING.md`.

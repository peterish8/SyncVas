# 36 — MCP Lesson Authoring

Phase 16. Requirements MCP-01..06.

## Goal

A teacher connects SyncVas to Claude or ChatGPT, says "build me a lesson on completing the
square with a five-question quiz", and the AI writes it into their SyncVas account as a
reviewable draft. The teacher opens SyncVas, checks it, and starts class.

## Direction of travel

Two AI paths that must not be confused:

| | Phase 12 — AI Board Authoring | Phase 16 — MCP Lesson Authoring |
|---|---|---|
| Direction | SyncVas calls a provider | External AI clients call SyncVas |
| Trigger | Teacher clicks "draft this" in SyncVas | Teacher talks to Claude/ChatGPT |
| Credentials | Ours, server-only | Teacher's own AI subscription |
| Generation | Our adapter | The client's model |

Both write through the **same authoring core**. `draftLesson` / `commitDraft` are called by the
in-app adapter and by the MCP tool layer alike. Two real callers is what justifies the seam —
build the core once and both paths are thin.

Because the external client's own model does the generating, we never need MCP **Sampling** —
which is deprecated in the current spec anyway. Our server accepts structured content; it does
not ask the client to generate.

## Reference implementation

`C:\Users\nithy\nk` (NotesKit) has a working, secured, stateless MCP server. Copy its shape
rather than reinventing:

| Concern | NotesKit file |
|---------|---------------|
| Route entry | `apps/web/app/api/mcp/route.ts` |
| Protected-resource metadata | `apps/web/app/.well-known/oauth-protected-resource/api/mcp/route.ts` |
| Tool definitions + dispatch | `apps/web/lib/mcp-server.ts` |
| Policy pipeline | `apps/web/lib/mcp-execution.ts` |
| Auth resolution + rate limits | `apps/web/lib/bearer-auth.ts` |
| Grant + idempotency storage | `packages/db/src/repositories/mcp-grants.ts`, `mcp-idempotency.ts` |

## Protocol

The MCP request path is **stateless**: do not store an AI conversation or open MCP session in the server process. Use the current Streamable HTTP transport and advertise the protocol version supported by the deployed SDK.

- One public HTTPS endpoint supports POST and GET with JSON-RPC
- Handle initialization lifecycle messages when clients send them, while keeping no conversational session state
- Servers validate `Origin` and authenticate every request
- Protected-resource metadata points clients to the OAuth authorization server
- Keep durable drafts, grants, idempotency receipts, and audit records in Convex
- Do not assume a historical `2026-07-28` profile is supported by every client; test the deployed SDK against ChatGPT and Claude

**Consequence for SyncVas:** a remote MCP server is now an ordinary HTTP workload with no
session store. It fits either a Next.js route handler (as NotesKit does) or a Convex HTTP
action in `convex/http.ts`, which is currently an empty router. Prefer the Convex HTTP action:
authorization, teacher lookup and all writes already live there, so the tool layer calls
internal functions directly instead of crossing a network boundary again.

## Authorization

OAuth 2.1. Client ID Metadata Documents preferred; Dynamic Client Registration is deprecated
but kept for authorization servers that need it.

Serve `/.well-known/oauth-protected-resource/...` with `resource`, `authorization_servers` and
`scopes_supported`. On an unauthenticated request return 401 with:

```
WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/api/mcp"
```

That header is what makes Claude and ChatGPT start the OAuth flow instead of failing.

**The rule that matters:** never accept a teacher id from the request body. Resolve it from the
grant, exactly as NotesKit resolves `workspaceId` from the session or grant and never from
input. A tool argument naming a teacher is an attack, not a parameter.

Scopes:
- `lessons:read` — list and read the caller's own templates and drafts
- `lessons:write` — create and update drafts
- `offline_access` — refresh

There is deliberately **no student-data scope**. See the boundary below.

## The hard boundary

An external model can be prompt-injected by anything the teacher pasted into their chat. Two
rules follow, and neither is negotiable:

**1. No MCP tool touches a live classroom.** No tool starts a session, publishes to a board,
reveals a question, locks the room, or ends a class. Everything lands as a draft. The blast
radius of a hostile generation is a bad draft the teacher declines — never content appearing
in front of thirty students mid-lesson.

**2. No MCP tool reads student data.** No doubts, no participants, no display names, no
answers, no leaderboards, no session history with results. MCP is an authoring surface. If a
future tool needs student data, that is a new decision with its own review, not an extension of
this scope.

## Tools

Naming follows the reference: `noun.verb`, snake_case arguments.

| Tool | Scope | Notes |
|------|-------|-------|
| `templates.list` | read | The caller's own templates only |
| `templates.get` | read | Includes block sources, not element JSON |
| `lessons.begin` | write | Opens a draft, returns `draft_id` |
| `lessons.append_part` | write | Appends blocks; bounded per part, like NotesKit's `notes.append_part` |
| `lessons.finalize` | write | Closes the draft into a reviewable template |
| `quiz.add_questions` | write | MCQ / true-false against a draft |
| `grammar.list_capabilities` | read | What block grammars exist and their syntax |
| `grammar.agent_guide` | read | Call-me-first guide, as NotesKit does with `notescript.agent_guide` |

`grammar.agent_guide` is worth copying deliberately. NotesKit's tool descriptions instruct the
model on workflow ("call this first", "do not claim X is unavailable"). Tool descriptions are
prompt surface — write them as instructions to a model, not as API docs for a human.

Long lessons use the `begin` → `append_part` → `finalize` pattern rather than one large call.
It keeps individual payloads bounded and lets a partial generation resume.

## Policy pipeline

Port `executeMcpTool` in order — the order is the design:

1. Validate arguments against the tool's `inputSchema` (Zod, derived from the schema)
2. Scope check — `INSUFFICIENT_SCOPE` if missing
3. Confirmation gate for destructive tools — `CONFIRMATION_REQUIRED` unless `confirm: true`
4. Client-wide rate limit, then per-tool rate limit, so switching tools cannot bypass the quota
5. Idempotency lookup by `(clientId, tool, idempotency_key)` — return the stored result if present
6. Invoke
7. Store the idempotency result for write tools

Annotate every tool with `readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint: false`. ChatGPT builds its permission prompts from these — but they
**supplement, never replace, server-side scope checks**.

## Response hygiene

- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` on every response
- Cap request body size and reject oversized bodies before parsing
- Map internal errors to stable recovery codes. Never return raw database or network detail —
  NotesKit's generic `TOOL_FAILED` message is the model to follow
- Error codes: `-32000`–`-32019` is implementation-defined; `-32020`–`-32099` is reserved for
  the spec. Stay in the low range for our own codes
- Never log generated lesson content or tokens, matching the existing doubt-text rule

## Teacher-facing UI

A connections page listing active grants: which client, which scopes, when connected, last
used, and a revoke button. Revocation takes effect immediately — the grant lookup is on every
request, so deleting it is sufficient. NotesKit's `McpConnections.tsx` is the reference.

## Failure modes

| Case | Behavior |
|------|----------|
| No token | 401 with `WWW-Authenticate` pointing at resource metadata |
| Revoked or expired grant | 401 on the next request; no cached authority |
| Token from another teacher | Scoped to that teacher only; ours is unreachable |
| Tool argument naming a different teacher | Ignored — identity comes from the grant |
| Rate limit hit | `RATE_LIMITED` with `Retry-After` |
| Retried write with same idempotency key | Original result returned, no duplicate draft |
| Model emits element JSON | Rejected by schema; grammar source only |
| Model attempts to reach a live class | No such tool exists |

## Acceptance

1. `server/discover` returns supported versions, capabilities and identity
2. Teacher connects from Claude and from ChatGPT and authorizes against their own account
3. An external client creates a draft lesson with a diagram and a five-question quiz, then reads it back
4. The draft is visible in SyncVas for review and is not attached to any live session
5. No tool in `tools/list` can reach a live room or any student record — asserted by test over the tool table, not by inspection
6. Revoking the grant makes the next tool call fail
7. A repeated write with the same `idempotency_key` produces one draft, not two


## Unified AI lesson studio

This MCP surface is one caller of the shared AI lesson authoring contract. The in-app AI route and remote ChatGPT/Claude tools must emit the same teacher-owned `LessonDraft` containing grammar source, explanations, and quiz questions. See `docs/38_AI_LESSON_STUDIO_AND_MCP.md` for the canonical contract, teacher review flow, and current official interoperability references.

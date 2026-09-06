# 38 — AI Lesson Studio and MCP Interoperability

**Status:** planning contract for the next AI authoring implementation pass
**Scope:** SyncVas in-app AI, remote ChatGPT/Claude MCP clients, lesson plans, board grammars, quizzes, and teacher review.

## Product decision

SyncVas becomes an AI-first lesson studio. A teacher can describe a class in SyncVas or ask ChatGPT/Claude to create it. Both paths produce the same durable `LessonDraft` shape: lesson metadata, ordered teaching parts, grammar sources, quiz questions, explanations, and reserved writing zones. The teacher reviews and edits the draft, then explicitly publishes it as a prepared board/class plan. No model gets a live classroom write capability.

The AI is responsible for instructional content and grammar source. SyncVas remains responsible for schema validation, compilation, deterministic layout, quiz answer-key protection, authorization, persistence, and publishing. This keeps model output reviewable and prevents coordinates or raw Excalidraw JSON from becoming an unsafe contract.

## Two entry paths, one authoring core

```text
SyncVas AI UI ─┐
               ├─> LessonAuthoringService -> validate -> compile -> draft -> teacher review -> publish
ChatGPT/Claude ┘          (same LessonDraft schema and policy pipeline)
```

- **In-app AI:** server-only provider adapter. The UI sends topic, audience, duration, goals, language, difficulty, and desired quiz count. Provider failures degrade to an unavailable state and never block manual authoring or a live class.
- **Remote MCP:** HTTPS Streamable HTTP endpoint (`/api/mcp`) using OAuth grants. The external model calls narrowly scoped tools to begin, append, validate, and finalize a draft. MCP requests are stateless: do not keep model conversation state in the MCP process; durable draft, grant, idempotency, and audit records live in Convex.
- **ChatGPT:** package the endpoint as a custom MCP app/Apps SDK integration where the account/workspace supports custom write actions. ChatGPT asks for confirmation according to app permissions; SyncVas still enforces its own scopes and draft-only boundary.
- **Claude:** expose the same public MCP endpoint for Claude's remote MCP connector. Claude requires a publicly reachable HTTP endpoint for the connector; private local development can use a supported secure tunnel.

## Draft contract

```ts
type LessonDraft = {
  id: string;
  ownerTeacherId: string;       // resolved from session/grant, never input
  title: string;
  subject?: string;
  audience?: string;
  durationMinutes?: number;
  objectives: string[];
  parts: Array<{
    id: string;
    title: string;
    explanation?: string;
    blocks: Array<{
      grammar: BlockGrammarId | "text" | "quiz";
      source: string;
      options?: BlockOptions;
      writingZone?: string;
    }>;
  }>;
  quizzes: Array<{
    id: string;
    prompt: string;
    kind: "mcq" | "true_false";
    options?: string[];
    correctIndex: number;       // draft-only; withheld from student projections
    explanation?: string;
  }>;
  status: "draft" | "reviewed" | "published" | "discarded";
};
```

The model may return grammar source and structured quiz data only. It may not return Excalidraw elements, coordinates, Convex IDs, teacher IDs, student data, socket payloads, or commands to start/end a room. `correctIndex` is accepted only in the teacher-owned draft and is stripped by every student-facing projection.

## MCP tool surface

Keep the surface small and composable. Long generations use `lessons.begin` → `lessons.append_part` → `lessons.finalize`; every write accepts an `idempotency_key`.

| Tool | Scope | Purpose |
|---|---|---|
| `grammar.list_capabilities` | read | Return supported grammars, options, limits, and examples. |
| `grammar.agent_guide` | read | Tell the model to call capabilities first and emit source, not element JSON. |
| `lessons.begin` | write | Create an empty teacher-owned draft. |
| `lessons.append_part` | write | Add one bounded, validated teaching part. |
| `lessons.validate` | write | Compile blocks, check layout/writing zones, and return errors without publishing. |
| `quiz.add_questions` | write | Add MCQ/true-false questions to the draft; answer keys remain draft-only. |
| `lessons.finalize` | write | Close generation and mark the draft ready for teacher review. |
| `lessons.get` / `lessons.list` | read | Read only the caller's drafts/templates. |
| `lessons.publish` | write + confirmation | Teacher-approved conversion to a prepared template; never attaches to a live room directly. |

No MCP tool reads doubts, participants, display names, answers, leaderboards, or live session state. No MCP tool publishes directly to a live board, reveals a quiz, locks a room, or ends a class.

## Security contract

- OAuth 2.1 authorization code + PKCE, protected-resource metadata, exact HTTPS redirect URIs, short-lived access tokens, rotating refresh tokens, and immediate grant revocation.
- Resolve `teacherId`/workspace from the authenticated session or grant. Ignore any identity fields in tool arguments.
- Validate every tool input with Zod, cap body/source/part/lesson sizes, and reject unknown fields where practical.
- Apply scope check, confirmation gate, client-wide and per-tool rate limits, then idempotency lookup before invoking a write.
- Return stable sanitized error codes. Use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; never log tokens, prompts, raw lesson text, quiz answer keys, or student data.
- Validate `Origin` on Streamable HTTP to prevent DNS rebinding. Bind local development to `127.0.0.1`; production requires HTTPS.
- Store only hashes of bearer tokens. Revoke by durable grant row and check the grant on every request.
- AI provider credentials stay server-side behind the existing adapter. Provider outage, malformed output, prompt injection, or unsafe content yields a reviewable failure state, never a partial publish.

## Teacher UX

Add an **AI Lesson Studio** route with:

1. brief form (topic, audience, duration, objectives, language, quiz count, board style),
2. streaming progress by draft part, with cancel and retry,
3. compile/validation report showing unsupported grammar, overflow, empty writing zones, and quiz issues,
4. side-by-side lesson outline and board preview,
5. editable source for every block and editable quiz question/answer explanation,
6. explicit **Save draft**, **Publish template**, and **Discard** actions,
7. **Connections** panel listing ChatGPT/Claude grants, scopes, last use, and revoke.

The live classroom only consumes a published template or teacher-approved draft. If generation is interrupted, the partial draft remains resumable and cannot appear in a room automatically.

## Reference implementation to study

The working `C:\Users\nithy\nk` implementation establishes the shape to reuse, without copying its NotesKit domain model:

- `apps/web/app/api/mcp/route.ts` — Node runtime, dynamic GET/POST endpoint.
- `apps/web/lib/mcp-server.ts` — tool definitions, dispatch, legacy compatibility, and sanitized responses.
- `apps/web/lib/mcp-execution.ts` — schema validation, scopes, confirmation, rate limits, idempotency.
- `apps/web/lib/bearer-auth.ts` — session/grant resolution and constant-time legacy token comparison.
- `apps/web/app/.well-known/oauth-protected-resource/api/mcp/route.ts` — protected-resource metadata.
- `packages/db/src/repositories/mcp-grants.ts` and `mcp-idempotency.ts` — hashed grants, revocation, and retry safety.

SyncVas should map those boundaries onto Convex tables and internal functions, while keeping the current provider-neutral AI adapter and teacher-only classroom rules.

## Protocol compatibility decision

Use the current MCP Streamable HTTP transport as the interoperability baseline. The transport is one HTTP endpoint supporting POST/GET and JSON-RPC; clients may still send the protocol's initialization lifecycle messages even though SyncVas keeps no conversational session state. Support the exact protocol versions advertised by the deployed SDK and test both ChatGPT custom-app and Claude connector flows before calling the integration production-ready. Do not describe an implementation as “Anthropic-only” or assume every ChatGPT plan supports custom write actions.

## Acceptance gates

- In-app AI creates a validated draft with at least one diagram, one explanation, and a quiz; no provider means a clear unavailable state.
- ChatGPT and Claude can discover the public endpoint, complete OAuth, list capabilities, and create/read a draft in a teacher-owned account.
- Same prompt through either path produces the same schema and compiler behavior; no raw element JSON is accepted.
- A failed/partial generation is resumable and never publishes automatically.
- Student payloads omit answer keys and draft-only metadata.
- Revoking a grant blocks the next request; retrying a write with the same idempotency key creates one part.
- Tool inventory tests prove no MCP capability reaches live rooms or student records.
- Hosted HTTPS, origin validation, rate limits, audit logging, and provider/data-retention review pass before public listing.

## Official references

- [Anthropic remote MCP servers](https://platform.claude.com/docs/en/agents-and-tools/remote-mcp-servers)
- [Anthropic MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [OpenAI Apps SDK](https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk)
- [OpenAI developer mode and MCP apps](https://help.openai.com/en/articles/12584461)

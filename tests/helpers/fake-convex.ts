/**
 * Minimal in-memory stand-in for the Convex ctx used by handler unit tests.
 *
 * It is deliberately small: enough of `db`, `auth`, `scheduler` and `storage`
 * for the query shapes this codebase actually uses (`withIndex` + `.eq(...)`,
 * `order`, `take`, `unique`, `collect`, `paginate`). It is NOT a Convex emulator — it
 * does not enforce index existence or transaction semantics. Tests that need those
 * belong in a deploy-linked integration run.
 *
 * It also records every terminal read as `{ table, rows }` in `reads`. Phase 24 removed
 * a set of N+1 collects from reactive queries; asserting the *shape* of a handler's
 * reads is what stops them growing back, since a re-introduced collect still returns the
 * right answer and would pass a value-only test.
 */

export type FakeRow = Record<string, unknown> & { _id: string; _creationTime: number };

type IndexConstraint = [field: string, value: unknown];

type ScheduledCall = { delayMs: number; fn: unknown; args: unknown };

/** One terminal read: which table, and how many rows it returned. */
export type FakeRead = { table: string; rows: number };

function sortKey(row: FakeRow): number {
  const created = row.createdAt;
  return typeof created === "number" ? created : row._creationTime;
}

export function createFakeConvex(options?: {
  /** Seed rows per table; ids are assigned if absent. */
  seed?: Record<string, Array<Record<string, unknown>>>;
  /** Identity returned by ctx.auth.getUserIdentity(). */
  identity?: { subject: string } | null;
}) {
  const tables = new Map<string, FakeRow[]>();
  const reads: FakeRead[] = [];
  const scheduled: ScheduledCall[] = [];
  const mutations: Array<{ fn: unknown; args: unknown }> = [];
  const stored: Array<{ id: string; blob: unknown }> = [];
  let counter = 0;
  let clock = 1_000;

  function nextId(table: string): string {
    counter += 1;
    return `${table}:${counter}`;
  }

  function tableOf(name: string): FakeRow[] {
    let rows = tables.get(name);
    if (!rows) {
      rows = [];
      tables.set(name, rows);
    }
    return rows;
  }

  function tableForId(id: string): string {
    return id.split(":")[0] ?? "";
  }

  for (const [name, rows] of Object.entries(options?.seed ?? {})) {
    for (const row of rows) {
      clock += 1;
      const id = typeof row._id === "string" ? row._id : nextId(name);
      tableOf(name).push({ ...row, _id: id, _creationTime: clock } as FakeRow);
    }
  }

  const db = {
    async get(id: string): Promise<FakeRow | null> {
      if (typeof id !== "string") return null;
      return tableOf(tableForId(id)).find((row) => row._id === id) ?? null;
    },

    async insert(table: string, doc: Record<string, unknown>): Promise<string> {
      clock += 1;
      const id = nextId(table);
      tableOf(table).push({ ...doc, _id: id, _creationTime: clock } as FakeRow);
      return id;
    },

    async patch(id: string, partial: Record<string, unknown>): Promise<void> {
      const rows = tableOf(tableForId(id));
      const index = rows.findIndex((row) => row._id === id);
      if (index === -1) throw new Error(`fake-convex: no such document ${id}`);
      rows[index] = { ...rows[index], ...partial } as FakeRow;
    },

    async replace(id: string, doc: Record<string, unknown>): Promise<void> {
      const rows = tableOf(tableForId(id));
      const index = rows.findIndex((row) => row._id === id);
      if (index === -1) throw new Error(`fake-convex: no such document ${id}`);
      rows[index] = { ...doc, _id: id, _creationTime: rows[index]._creationTime } as FakeRow;
    },

    async delete(id: string): Promise<void> {
      const rows = tableOf(tableForId(id));
      const index = rows.findIndex((row) => row._id === id);
      if (index !== -1) rows.splice(index, 1);
    },

    query(table: string) {
      let constraints: IndexConstraint[] = [];
      let direction: "asc" | "desc" = "asc";

      const record = (rows: FakeRow[]): FakeRow[] => {
        reads.push({ table, rows: rows.length });
        return rows;
      };

      const matching = (): FakeRow[] => {
        const rows = tableOf(table).filter((row) =>
          constraints.every(([field, value]) => row[field] === value),
        );
        rows.sort((a, b) => sortKey(a) - sortKey(b));
        return direction === "desc" ? rows.reverse() : rows;
      };

      const builder = {
        withIndex(_indexName: string, build?: (q: IndexQuery) => IndexQuery) {
          if (build) {
            const collected: IndexConstraint[] = [];
            const indexQuery: IndexQuery = {
              eq(field: string, value: unknown) {
                collected.push([field, value]);
                return indexQuery;
              },
            };
            build(indexQuery);
            constraints = collected;
          }
          return builder;
        },
        order(next: "asc" | "desc") {
          direction = next;
          return builder;
        },
        async take(count: number) {
          return record(matching().slice(0, count));
        },
        async collect() {
          return record(matching());
        },
        async first() {
          const rows = matching().slice(0, 1);
          record(rows);
          return rows[0] ?? null;
        },
        async unique() {
          const rows = matching();
          if (rows.length > 1) throw new Error(`fake-convex: ${table} unique() matched ${rows.length} rows`);
          record(rows);
          return rows[0] ?? null;
        },
        /**
         * Offset-encoded cursor. Enough for the bounded batch walks in
         * `convex/internal/backfillCounts.ts`; it is not Convex's real cursor format
         * and carries no ordering guarantee beyond `matching()`.
         */
        async paginate({ cursor, numItems }: { cursor: string | null; numItems: number }) {
          const rows = matching();
          const offset = cursor ? Number(cursor) : 0;
          const page = rows.slice(offset, offset + numItems);
          record(page);
          const next = offset + page.length;
          return {
            page,
            isDone: next >= rows.length,
            continueCursor: String(next),
          };
        },
      };
      return builder;
    },
  };

  type IndexQuery = { eq(field: string, value: unknown): IndexQuery };

  /**
   * Convex Auth puts the user document id in the JWT subject as
   * `<userId>|<sessionId>`, and `getAuthUserId` reads it back by splitting on
   * that divider. Fixtures name a teacher by their logical `authSubject`
   * ("auth|owner"), so resolve it to the seeded user id and present the subject
   * the way production does. Without this, `getAuthUserId` returns the fragment
   * before the first `|` ("auth"), `ctx.db.get` misses, and every ownership
   * check fails as "A teacher account is required" before it can compare owners.
   *
   * Read lazily: rows may be inserted after the ctx is built.
   */
  function authSubjectClaim(subject: string): string {
    const user = tableOf("users").find((row) => row.authSubject === subject);
    return user ? `${user._id}|fake-session` : subject;
  }

  const ctx = {
    db,
    auth: {
      getUserIdentity: async () =>
        options?.identity
          ? { ...options.identity, subject: authSubjectClaim(options.identity.subject) }
          : null,
    },
    /** Actions reach mutations through this; record the call rather than running it. */
    runMutation: async (fn: unknown, args: unknown) => {
      mutations.push({ fn, args });
      return null;
    },
    scheduler: {
      runAfter: async (delayMs: number, fn: unknown, args: unknown) => {
        scheduled.push({ delayMs, fn, args });
      },
      runAt: async (_at: number, fn: unknown, args: unknown) => {
        scheduled.push({ delayMs: 0, fn, args });
      },
    },
    storage: {
      store: async (blob: unknown) => {
        const id = nextId("_storage");
        stored.push({ id, blob });
        return id;
      },
      getUrl: async (id: string) => `https://storage.test/${id}`,
    },
  };

  return {
    ctx: ctx as never,
    rows: (table: string) => tableOf(table),
    scheduled,
    /** Mutations an action asked to run, in order. */
    mutations,
    stored,
    /** Every terminal read since the last `resetReads()`, in order. */
    reads,
    resetReads: () => {
      reads.length = 0;
    },
    /** Reads against one table, for shape assertions. */
    readsOf: (table: string) => reads.filter((read) => read.table === table),
  };
}

/** Convex function objects expose the raw handler as `_handler` for unit tests. */
export function handlerOf<Args, Result>(fn: unknown): (ctx: unknown, args: Args) => Promise<Result> {
  const withHandler = fn as { _handler?: (ctx: unknown, args: Args) => Promise<Result> };
  if (typeof withHandler._handler !== "function") {
    throw new Error("Expected a Convex function object exposing _handler.");
  }
  return withHandler._handler;
}

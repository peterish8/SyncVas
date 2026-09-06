/**
 * @phase 11
 * Prepared boards and template library — PREP-01..05.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import {
  get,
  getStartingScene,
  list,
  remove,
  rename,
  save,
} from "@/convex/boardTemplates";
import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardCurrentSchema,
} from "@/shared/protocol/socket";
import { MAX_SCENE_JSON_BYTES } from "@/shared/board/scene";
import { clearHotScene } from "@/socket-server/src/board-hot-state";
import { createSocketServer } from "@/socket-server/src/server";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const SECRET = "phase-11-prepared-boards-secret-at-least-32";
process.env.SOCKET_INTERNAL_SECRET = SECRET;

const TEACHER = "users:owner";
const OTHER_TEACHER = "users:other";

const PREPARED_SCENE = JSON.stringify({
  elements: [
    { id: "title", type: "text", text: "Quadratic formula", x: 40, y: 40 },
    { id: "axes", type: "line", x: 40, y: 120 },
  ],
  appState: { viewBackgroundColor: "#ffffff" },
});

function world(identity = "auth|owner") {
  return createFakeConvex({
    identity: { subject: identity },
    seed: {
      users: [
        { _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 },
        { _id: OTHER_TEACHER, authSubject: "auth|other", role: "teacher", createdAt: 1 },
      ],
    },
  });
}

const saveTemplate = handlerOf<
  { title: string; subject?: string; sceneJson: string; origin?: string },
  { templateId: string; title: string }
>(save);
const listTemplates = handlerOf<Record<string, never>, Array<Record<string, unknown>>>(list);
const getTemplate = handlerOf<{ templateId: string }, Record<string, unknown>>(get);
const renameTemplate = handlerOf<{ templateId: string; title: string }, { title: string }>(rename);
const removeTemplate = handlerOf<{ templateId: string }, unknown>(remove);
const startingScene = handlerOf<{ templateId: string }, { sceneJson: string; title: string }>(getStartingScene);

describe("PREP-01 saving the current board as a template", () => {
  it("stores a named template owned by the calling teacher", async () => {
    const fake = world();
    const { templateId, title } = await saveTemplate(fake.ctx, {
      title: "  Quadratics   opener ",
      subject: " Maths ",
      sceneJson: PREPARED_SCENE,
    });

    expect(title).toBe("Quadratics opener");
    const row = fake.rows("boardTemplates")[0];
    expect(row.teacherId).toBe(TEACHER);
    expect(row.sceneJson).toBe(PREPARED_SCENE);
    expect(row.subject).toBe("Maths");
    expect(row.origin).toBe("authored");
    expect(templateId).toBe(row._id);
  });

  it("records an AI-assisted origin when the draft came from generation", async () => {
    const fake = world();
    await saveTemplate(fake.ctx, { title: "Generated", sceneJson: PREPARED_SCENE, origin: "ai-assisted" });
    expect(fake.rows("boardTemplates")[0].origin).toBe("ai-assisted");
  });

  it("refuses an unnamed template", async () => {
    const fake = world();
    for (const title of ["", "   "]) {
      await expect(saveTemplate(fake.ctx, { title, sceneJson: PREPARED_SCENE })).rejects.toThrow(/TITLE_REQUIRED/);
    }
    expect(fake.rows("boardTemplates")).toHaveLength(0);
  });

  it("refuses an overlong name", async () => {
    const fake = world();
    await expect(
      saveTemplate(fake.ctx, { title: "x".repeat(121), sceneJson: PREPARED_SCENE }),
    ).rejects.toThrow(/TITLE_TOO_LONG/);
  });

  it("refuses a scene that is not valid Excalidraw JSON", async () => {
    const fake = world();
    await expect(saveTemplate(fake.ctx, { title: "Broken", sceneJson: "{}" })).rejects.toThrow(/INVALID_SCENE/);
    await expect(saveTemplate(fake.ctx, { title: "Broken", sceneJson: "nope" })).rejects.toThrow(/INVALID_SCENE/);
  });

  it("refuses a scene beyond the durable document bound", async () => {
    const fake = world();
    const huge = JSON.stringify({ elements: [{ id: "x", pad: "y".repeat(MAX_SCENE_JSON_BYTES) }] });
    await expect(saveTemplate(fake.ctx, { title: "Huge", sceneJson: huge })).rejects.toThrow(/SCENE_TOO_LARGE/);
  });

  it("refuses an unauthenticated caller", async () => {
    const anonymous = createFakeConvex({ identity: null, seed: {} });
    await expect(
      saveTemplate(anonymous.ctx, { title: "Sneaky", sceneJson: PREPARED_SCENE }),
    ).rejects.toThrow(/Sign in to manage a classroom/);
  });
});

describe("PREP-02 the library is private to its owner", () => {
  async function libraryWithBothTeachers() {
    const fake = world();
    const mine = await saveTemplate(fake.ctx, { title: "Mine", sceneJson: PREPARED_SCENE });
    fake.rows("boardTemplates").push({
      _id: "boardTemplates:theirs",
      _creationTime: 50,
      teacherId: OTHER_TEACHER,
      title: "Theirs",
      sceneJson: PREPARED_SCENE,
      origin: "authored",
      createdAt: 50,
      updatedAt: 50,
    });
    return { fake, mine };
  }

  it("lists only the caller's own templates", async () => {
    const { fake, mine } = await libraryWithBothTeachers();
    const rows = await listTemplates(fake.ctx, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].templateId).toBe(mine.templateId);
  });

  it("omits the full scene from the library listing", async () => {
    const { fake } = await libraryWithBothTeachers();
    const [row] = await listTemplates(fake.ctx, {});
    expect(Object.keys(row)).not.toContain("sceneJson");
  });

  it("opens the caller's own template with its scene", async () => {
    const { fake, mine } = await libraryWithBothTeachers();
    const opened = await getTemplate(fake.ctx, { templateId: mine.templateId });
    expect(opened.sceneJson).toBe(PREPARED_SCENE);
    expect(opened.title).toBe("Mine");
  });

  it.each([
    ["open", (ctx: unknown) => getTemplate(ctx, { templateId: "boardTemplates:theirs" })],
    ["rename", (ctx: unknown) => renameTemplate(ctx, { templateId: "boardTemplates:theirs", title: "Hijacked" })],
    ["delete", (ctx: unknown) => removeTemplate(ctx, { templateId: "boardTemplates:theirs" })],
    ["start a class from", (ctx: unknown) => startingScene(ctx, { templateId: "boardTemplates:theirs" })],
  ])("refuses to %s another teacher's template", async (_label, call) => {
    const { fake } = await libraryWithBothTeachers();
    await expect(call(fake.ctx)).rejects.toThrow(/Template not found/);
  });

  it("does not delete another teacher's template while refusing", async () => {
    const { fake } = await libraryWithBothTeachers();
    await expect(removeTemplate(fake.ctx, { templateId: "boardTemplates:theirs" })).rejects.toThrow();
    expect(fake.rows("boardTemplates").some((row) => row._id === "boardTemplates:theirs")).toBe(true);
  });

  it("renames and deletes the caller's own template", async () => {
    const { fake, mine } = await libraryWithBothTeachers();

    const renamed = await renameTemplate(fake.ctx, { templateId: mine.templateId, title: "Week 2 opener" });
    expect(renamed.title).toBe("Week 2 opener");
    expect(fake.rows("boardTemplates").find((row) => row._id === mine.templateId)?.title).toBe("Week 2 opener");

    await removeTemplate(fake.ctx, { templateId: mine.templateId });
    expect(fake.rows("boardTemplates").some((row) => row._id === mine.templateId)).toBe(false);
  });

  it("refuses to rename a template to an empty name", async () => {
    const { fake, mine } = await libraryWithBothTeachers();
    await expect(renameTemplate(fake.ctx, { templateId: mine.templateId, title: "  " })).rejects.toThrow(
      /TITLE_REQUIRED/,
    );
  });
});

describe("PREP-03 starting a class from a template", () => {
  it("returns the exact prepared scene the class should open on", async () => {
    const fake = world();
    const { templateId } = await saveTemplate(fake.ctx, { title: "Opener", sceneJson: PREPARED_SCENE });

    const opening = await startingScene(fake.ctx, { templateId });
    expect(opening.sceneJson).toBe(PREPARED_SCENE);
    expect(opening.title).toBe("Opener");
  });

  it("keeps every prepared element editable rather than locking it", async () => {
    const fake = world();
    const { templateId } = await saveTemplate(fake.ctx, { title: "Opener", sceneJson: PREPARED_SCENE });
    const opening = await startingScene(fake.ctx, { templateId });

    // PREP-05: the scene round-trips verbatim, so nothing is frozen on the way through.
    const elements = (JSON.parse(opening.sceneJson) as { elements: Array<Record<string, unknown>> }).elements;
    expect(elements).toHaveLength(2);
    for (const element of elements) {
      expect(element.locked).toBeUndefined();
    }
    expect(JSON.parse(opening.sceneJson)).toEqual(JSON.parse(PREPARED_SCENE));
  });
});

describe("PREP-04 students receive a prepared board through the existing bootstrap", () => {
  const clients: ClientSocket[] = [];
  const servers: Array<{ close: () => Promise<void> }> = [];
  const sessionIds: string[] = [];

  function encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }

  function signedToken(sessionId: string, role: "teacher" | "student"): string {
    const header = encode({ alg: "HS256", typ: "SVRT1" });
    const payload = encode({
      v: 1,
      sessionId,
      role,
      subjectId: `${role}-1`,
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
    return `${header}.${payload}.${signature}`;
  }

  async function connect(url: string, sessionId: string, role: "teacher" | "student") {
    sessionIds.push(sessionId);
    const client = createClient(url, { auth: { token: signedToken(sessionId, role) }, transports: ["websocket"] });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("connect_error", reject);
    });
    return client;
  }

  function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.disconnect());
    await Promise.all(servers.splice(0).map((server) => server.close()));
    for (const sessionId of sessionIds.splice(0)) clearHotScene(sessionId);
  });

  it("bootstraps a late student with the prepared scene and no new event type", async () => {
    const httpServer = createServer();
    const io = createSocketServer(httpServer, ["http://localhost:3000"]);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address.");
    servers.push({ close: () => new Promise<void>((resolve) => io.close(() => httpServer.close(() => resolve()))) });
    const url = `http://127.0.0.1:${address.port}`;
    const sessionId = "prep-04-room";

    // The teacher opens the class on the template and publishes it as version 1.
    const teacher = await connect(url, sessionId, "teacher");
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      v: SOCKET_PROTOCOL_VERSION,
      sessionId,
      ts: Date.now(),
      boardVersion: 1,
      scene: JSON.parse(PREPARED_SCENE),
    });

    // A student who joins afterwards gets it through the ordinary bootstrap.
    const student = await connect(url, sessionId, "student");
    const current = waitForEvent<unknown>(student, SOCKET_EVENTS.boardCurrent);
    student.emit(SOCKET_EVENTS.boardRequestCurrent, { v: SOCKET_PROTOCOL_VERSION, sessionId, ts: Date.now() });

    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(1);
    expect(board.scene).toEqual(JSON.parse(PREPARED_SCENE));
  });
});

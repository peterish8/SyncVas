// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { BoardDraftPanel } from "@/components/ai/board-draft-panel";
import type { PreparedBoard } from "@/components/templates/template-library";

const mocks = vi.hoisted(() => ({ draft: vi.fn(), save: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => mocks.draft, useMutation: () => mocks.save }));
vi.mock("@excalidraw/excalidraw", () => ({ convertToExcalidrawElements: (elements: unknown) => elements }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.clearAllMocks(); });

async function generate(onUseDraft: (board: PreparedBoard) => void) {
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(BoardDraftPanel, { onUseDraft })));
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Algebra opener");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Draft board"))!.click());
}

it("hands the saved board ID, title and scene to the opening-board selection only after acceptance", async () => {
  mocks.draft.mockResolvedValue({ status: "ok", blocks: [{ grammar: "text", source: "Solve x + 2 = 5" }], writingZones: 1 });
  mocks.save.mockResolvedValue({ templateId: "saved-template", title: "Algebra opener" });
  const useDraft = vi.fn();
  await generate(useDraft);
  expect(useDraft).not.toHaveBeenCalled();
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Accept as prepared board"))!.click());
  expect(useDraft).toHaveBeenCalledOnce();
  const selected = useDraft.mock.calls[0][0];
  expect(selected).toMatchObject({ templateId: "saved-template", title: "Algebra opener" });
  expect(selected.scene).toEqual(JSON.parse(mocks.save.mock.calls[0][0].sceneJson));
});

it("keeps a failed save reviewable and never changes the opening board", async () => {
  mocks.draft.mockResolvedValue({ status: "ok", blocks: [{ grammar: "text", source: "A reviewable lesson" }], writingZones: 0 });
  mocks.save.mockRejectedValue(new Error("offline"));
  const useDraft = vi.fn();
  await generate(useDraft);
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Accept as prepared board"))!.click());
  expect(useDraft).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not be saved");
  expect(container.textContent).toContain("Accept as prepared board");
});

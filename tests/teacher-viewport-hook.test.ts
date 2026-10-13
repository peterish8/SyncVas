// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTeacherViewport } from "@/components/board/use-teacher-viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let current: ReturnType<typeof useTeacherViewport>;
let renders = 0;
async function mount(args: Parameters<typeof useTeacherViewport>[0]) {
  function Harness() { current = useTeacherViewport(args); renders += 1; return null; }
  root = createRoot(document.createElement("div"));
  await act(async () => root!.render(createElement(Harness)));
}
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; vi.useRealTimers(); renders = 0; });

describe("student follow gestures", () => {
  it("exits immediately during a remote apply and keeps future camera frames local", async () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    await mount({ role: "student", applyViewport: apply });
    await act(async () => current.handleRemoteViewport({ x: 1, y: 2, zoom: 1.2, ts: 1 }));
    await act(async () => current.followTeacher());
    expect(current.followEnabled).toBe(true);
    expect(current.isApplyingViewport()).toBe(true);
    await act(async () => current.onLocalPanZoom());
    expect(current.followEnabled).toBe(true); // programmatic callback
    await act(async () => current.onManualNavigation());
    expect(current.followEnabled).toBe(false);
    await act(async () => current.handleRemoteViewport({ x: 99, y: 99, zoom: 2, ts: 2 }));
    expect(apply).toHaveBeenCalledTimes(1);
    await act(async () => current.followTeacher());
    expect(apply).toHaveBeenLastCalledWith({ x: 99, y: 99, zoom: 2, ts: 2 });
  });

  it("stores the latest camera without rendering the whole board on every packet", async () => {
    const apply = vi.fn();
    await mount({ role: "student", applyViewport: apply });
    await act(async () => current.handleRemoteViewport({ x: 0, y: 0, zoom: 1, ts: 1 }));
    const initialRenders = renders;
    for (let ts = 2; ts < 20; ts += 1) await act(async () => current.handleRemoteViewport({ x: ts, y: 0, zoom: 1, ts }));
    expect(renders).toBe(initialRenders);
    await act(async () => current.handleRemoteViewport({ x: -1, y: 0, zoom: 1, ts: 2 }));
    await act(async () => current.followTeacher());
    expect(apply).toHaveBeenLastCalledWith({ x: 19, y: 0, zoom: 1, ts: 19 });
  });

  it("cleans up camera throttles and settling timers on unmount", async () => {
    vi.useFakeTimers();
    await mount({ role: "student", applyViewport: vi.fn() });
    await act(async () => current.handleRemoteViewport({ x: 0, y: 0, zoom: 1, ts: 1 }));
    await act(async () => current.followTeacher());
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => root!.unmount()); root = undefined;
    expect(vi.getTimerCount()).toBe(0);
    const emit = vi.fn();
    await mount({ role: "teacher", onEmitViewport: emit });
    await act(async () => { current.onTeacherCameraChange(0, 0, 1); current.onTeacherCameraChange(10, 10, 1); });
    await act(async () => root!.unmount()); root = undefined;
    await vi.runAllTimersAsync();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});

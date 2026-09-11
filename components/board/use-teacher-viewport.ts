/**
 * Teacher viewport stream + student follow
 *
 * Teacher: coalesce scrollX/scrollY/zoom → teacher:viewport.
 * Student: followEnabled applies remote viewport; pan/zoom sets followEnabled=false locally.
 * Return-to-teacher reapplies last teacher viewport. Never put camera in Convex.
 * Dropped packets must not corrupt board scene content.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TEACHER_VIEWPORT_MAX_HZ } from "@/shared/constants/limits";

export type TeacherViewportCoords = {
  x: number;
  y: number;
  zoom: number;
  ts?: number;
  pageId?: string;
};

const VIEWPORT_MIN_INTERVAL_MS = Math.ceil(1000 / TEACHER_VIEWPORT_MAX_HZ);
const APPLYING_VIEWPORT_SETTLE_MS = 120;

/** Prefer newer teacher viewport frames; equal ts is treated as apply-once latest. */
export function shouldApplyTeacherViewport(
  incomingTs: number,
  lastAppliedTs: number | null,
): boolean {
  if (lastAppliedTs === null) return true;
  return incomingTs >= lastAppliedTs;
}

export function useTeacherViewport(args: {
  role: "teacher" | "student";
  /** Teacher: coalesced viewport ready to emit on the shared board socket. */
  onEmitViewport?: (viewport: TeacherViewportCoords) => void;
  /** Student: apply camera to Excalidraw without mutating scene elements. */
  applyViewport?: (viewport: TeacherViewportCoords) => void | Promise<void>;
}) {
  const { role, onEmitViewport, applyViewport } = args;

  const [followEnabled, setFollowEnabledState] = useState(false);
  const [lastTeacherViewport, setLastTeacherViewport] = useState<TeacherViewportCoords | null>(
    null,
  );

  const followEnabledRef = useRef(false);
  const lastAppliedTsRef = useRef<number | null>(null);
  const lastTeacherViewportRef = useRef<TeacherViewportCoords | null>(null);
  const applyingViewportRef = useRef(false);
  const applyGenerationRef = useRef(0);

  const pendingTeacherRef = useRef<TeacherViewportCoords | null>(null);
  const throttleTimerRef = useRef<number | null>(null);
  const lastEmitAtRef = useRef(0);

  // Latest-callback refs are written after render, never during it.
  const onEmitViewportRef = useRef(onEmitViewport);
  const applyViewportRef = useRef(applyViewport);
  useEffect(() => {
    onEmitViewportRef.current = onEmitViewport;
    applyViewportRef.current = applyViewport;
  });

  const setFollowEnabled = useCallback((enabled: boolean) => {
    followEnabledRef.current = enabled;
    setFollowEnabledState(enabled);
  }, []);

  const flushTeacherViewport = useCallback(() => {
    const pending = pendingTeacherRef.current;
    if (!pending || role !== "teacher") return;
    pendingTeacherRef.current = null;
    lastEmitAtRef.current = Date.now();
    onEmitViewportRef.current?.(pending);
  }, [role]);

  /** Teacher camera changes — coalesce to ~TEACHER_VIEWPORT_MAX_HZ. */
  const onTeacherCameraChange = useCallback(
    (x: number, y: number, zoom: number) => {
      if (role !== "teacher") return;
      pendingTeacherRef.current = { x, y, zoom, ts: Date.now() };
      const elapsed = Date.now() - lastEmitAtRef.current;
      if (elapsed >= VIEWPORT_MIN_INTERVAL_MS) {
        if (throttleTimerRef.current !== null) {
          window.clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        flushTeacherViewport();
        return;
      }
      if (throttleTimerRef.current === null) {
        throttleTimerRef.current = window.setTimeout(() => {
          throttleTimerRef.current = null;
          flushTeacherViewport();
        }, VIEWPORT_MIN_INTERVAL_MS - elapsed);
      }
    },
    [flushTeacherViewport, role],
  );

  const applyIfFollowing = useCallback((viewport: TeacherViewportCoords) => {
    const generation = ++applyGenerationRef.current;
    applyingViewportRef.current = true;
    const result = applyViewportRef.current?.(viewport);
    if (result && typeof (result as PromiseLike<void>).then === "function") {
      void Promise.resolve(result).finally(() => {
        // Excalidraw may deliver the final onScrollChange on the next task
        // after updateScene resolves. Keep the guard alive through that
        // trailing event so a remote camera frame never looks like a local
        // student pan and accidentally exits follow mode.
        window.setTimeout(() => {
          if (applyGenerationRef.current === generation) {
            applyingViewportRef.current = false;
          }
        }, APPLYING_VIEWPORT_SETTLE_MS);
      });
      return;
    }
    window.setTimeout(() => {
      if (applyGenerationRef.current === generation) {
        applyingViewportRef.current = false;
      }
    }, 0);
  }, []);

  /** Student: validated remote teacher:viewport packet. */
  const handleRemoteViewport = useCallback(
    (viewport: TeacherViewportCoords) => {
      if (role !== "student") return;
      const ts = viewport.ts ?? 0;
      if (!shouldApplyTeacherViewport(ts, lastAppliedTsRef.current)) return;

      lastAppliedTsRef.current = ts;
      lastTeacherViewportRef.current = viewport;
      setLastTeacherViewport(viewport);

      if (followEnabledRef.current) {
        applyIfFollowing(viewport);
      }
    },
    [applyIfFollowing, role],
  );

  /** Student manual pan/zoom — exit follow locally; never emit camera. */
  const onLocalPanZoom = useCallback(() => {
    if (role !== "student") return;
    if (applyingViewportRef.current) return;
    if (!followEnabledRef.current) return;
    setFollowEnabled(false);
  }, [role, setFollowEnabled]);

  const followTeacher = useCallback(() => {
    if (role !== "student") return;
    setFollowEnabled(true);
    const latest = lastTeacherViewportRef.current;
    if (latest) applyIfFollowing(latest);
  }, [applyIfFollowing, role, setFollowEnabled]);

  const dispose = useCallback(() => {
    if (throttleTimerRef.current !== null) {
      window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    applyGenerationRef.current += 1;
    applyingViewportRef.current = false;
  }, []);

  return {
    followEnabled,
    setFollowEnabled,
    lastTeacherViewport,
    onLocalPanZoom,
    onTeacherCameraChange,
    handleRemoteViewport,
    followTeacher,
    isApplyingViewport: () => applyingViewportRef.current,
    dispose,
    viewportMinIntervalMs: VIEWPORT_MIN_INTERVAL_MS,
  };
}

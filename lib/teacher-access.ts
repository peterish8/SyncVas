/**
 * Which teacher identity the browser may act as.
 *
 * Convex exposes two families for every teacher operation: the authenticated
 * one (`requireTeacher`) and a `*AsLocalTeacher` twin that only resolves when
 * the Convex deployment sets ALLOW_DEV_TEACHER=1. Picking the wrong family does
 * not fail loudly — the local-dev queries return empty rather than throwing —
 * so a component wired to the dev twin looks healthy in development and
 * silently reports "nothing saved yet" in production.
 *
 * Every teacher surface resolves the family through `useTeacherAccess` so the
 * choice is made once, and `tests/teacher-access-gate.test.ts` fails the build
 * if a component reaches for a `*AsLocalTeacher` reference without it.
 */

"use client";

import { useConvexAuth } from "convex/react";

/**
 * Two-key opt-in, mirroring `isLocalDevTeacherAllowed` in convex/authBootstrap.
 * `lib/production-env.ts` rejects the public flag on a real deploy, so this is
 * statically false in any production bundle.
 */
export const LOCAL_TEACHER_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_TEACHER === "1";

export type TeacherAccess =
  /** Dev build with the anonymous local teacher enabled. */
  | "local"
  /** Convex Auth identity present; the authenticated function family applies. */
  | "authenticated"
  /** Convex Auth has answered and there is no teacher identity. */
  | "signed-out"
  /** Convex Auth has not answered yet; run no teacher query. */
  | "resolving";

export function useTeacherAccess(): TeacherAccess {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (LOCAL_TEACHER_ENABLED) return "local";
  if (isLoading) return "resolving";
  return isAuthenticated ? "authenticated" : "signed-out";
}

/** True once a teacher-scoped Convex function is allowed to run. */
export function canRunTeacherQuery(access: TeacherAccess): boolean {
  return access === "local" || access === "authenticated";
}

/**
 * Args for a teacher-scoped `useQuery`, or "skip".
 *
 * Convex `useQuery` rethrows a query error during render, so calling an
 * authenticated query while signed out takes the whole route to the error
 * boundary instead of showing a permission state.
 */
export function teacherQueryArgs<Args>(access: TeacherAccess, args: Args): Args | "skip" {
  return canRunTeacherQuery(access) ? args : "skip";
}

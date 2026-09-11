/** Client helpers for anonymous Convex local-teacher bootstrap (ALLOW_DEV_TEACHER). */

import { notifyStoredValue } from "@/lib/client-store";
import type { SessionStatus } from "@/shared/types/session";

export const LOCAL_TEACHER_STORAGE_KEY = "syncvas:local-teacher:v1";
export const ACTIVE_TEACHER_SESSION_STORAGE_KEY = "syncvas:teacher-session:v1";

export type LocalTeacherBootstrap = {
  teacherId: string;
  authSubject: string;
  bootstrappedAt: number;
};

export type ActiveTeacherSession = {
  sessionId: string;
  joinCode: string;
  status: SessionStatus;
};

export function parseActiveTeacherSession(raw: string | null): ActiveTeacherSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ActiveTeacherSession>;
    if (
      typeof value.sessionId !== "string" || value.sessionId.length === 0 ||
      typeof value.joinCode !== "string" || value.joinCode.length !== 6 ||
      !["draft", "live", "ending", "ended"].includes(value.status ?? "")
    ) return null;
    return value as ActiveTeacherSession;
  } catch {
    return null;
  }
}

export function writeActiveTeacherSession(value: ActiveTeacherSession): void {
  window.localStorage.setItem(ACTIVE_TEACHER_SESSION_STORAGE_KEY, JSON.stringify(value));
  notifyStoredValue();
}

export function clearActiveTeacherSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_TEACHER_SESSION_STORAGE_KEY);
  notifyStoredValue();
}

/** Parse a stored bootstrap record. Module-scope so it is a stable `useStoredValue` snapshot fn. */
export function parseLocalTeacherBootstrap(raw: string | null): LocalTeacherBootstrap | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalTeacherBootstrap>;
    if (
      typeof parsed.teacherId !== "string" ||
      typeof parsed.authSubject !== "string" ||
      typeof parsed.bootstrappedAt !== "number"
    ) {
      return null;
    }
    return {
      teacherId: parsed.teacherId,
      authSubject: parsed.authSubject,
      bootstrappedAt: parsed.bootstrappedAt,
    };
  } catch {
    return null;
  }
}

export function readLocalTeacherBootstrap(): LocalTeacherBootstrap | null {
  if (typeof window === "undefined") return null;
  try {
    return parseLocalTeacherBootstrap(window.localStorage.getItem(LOCAL_TEACHER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeLocalTeacherBootstrap(value: {
  teacherId: string;
  authSubject: string;
}): LocalTeacherBootstrap {
  const record: LocalTeacherBootstrap = {
    teacherId: value.teacherId,
    authSubject: value.authSubject,
    bootstrappedAt: Date.now(),
  };
  window.localStorage.setItem(LOCAL_TEACHER_STORAGE_KEY, JSON.stringify(record));
  notifyStoredValue();
  return record;
}

export function clearLocalTeacherBootstrap(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_TEACHER_STORAGE_KEY);
  notifyStoredValue();
}

export function roomTokenStorageKey(sessionId: string): string {
  return `syncvas:room-token:${sessionId}`;
}

export function participantStorageKey(sessionId: string): string {
  return `syncvas:participant:${sessionId}`;
}

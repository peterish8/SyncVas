/**
 * Web-storage values read as a React external store.
 *
 * localStorage/sessionStorage are external systems, so they are subscribed to
 * rather than copied into state inside an effect (react-hooks/set-state-in-effect).
 * Snapshots are cached against the raw string so `useSyncExternalStore` sees a
 * stable reference between renders and never loops.
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";

export type StorageArea = "local" | "session";

type Listener = () => void;

const listeners = new Set<Listener>();
const snapshotCache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Cross-tab writes; same-tab writes go through notifyStoredValue().
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Tell subscribed components that this tab just wrote to web storage. */
export function notifyStoredValue(): void {
  if (typeof window === "undefined") return;
  snapshotCache.clear();
  for (const listener of listeners) listener();
}

function areaFor(storage: StorageArea): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return storage === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // Private mode / blocked site data.
    return null;
  }
}

function readSnapshot<T>(
  storage: StorageArea,
  key: string,
  parse: (raw: string | null) => T,
): T {
  let raw: string | null = null;
  try {
    raw = areaFor(storage)?.getItem(key) ?? null;
  } catch {
    raw = null;
  }
  const cacheKey = `${storage}:${key}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.raw === raw) return cached.value as T;
  const value = parse(raw);
  snapshotCache.set(cacheKey, { raw, value });
  return value;
}

/**
 * Subscribe to one web-storage key.
 *
 * `parse` must be declared at module scope (a stable identity), and
 * `serverValue` is what renders on the server and during hydration.
 */
export function useStoredValue<T>(args: {
  storage: StorageArea;
  key: string;
  parse: (raw: string | null) => T;
  serverValue: T;
}): T {
  const { storage, key, parse, serverValue } = args;
  const getSnapshot = useCallback(
    () => readSnapshot(storage, key, parse),
    [storage, key, parse],
  );
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

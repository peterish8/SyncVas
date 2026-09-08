/**
 * SEC-06 — teacher identity is resolved at one seam, not per function.
 *
 * This file used to be an 89-line lint over source text. Convex exposed a
 * `*AsLocalTeacher` twin for every teacher operation — 30 of them — and the
 * twins failed quietly: the dev-only queries returned empty instead of
 * throwing, so a surface wired to one looked correct in a dev build and, in
 * production, reported an empty library and refused every write. The
 * prepared-board and AI-draft panels both shipped broken that way. The twins
 * had also silently diverged: the doubts queue pair ran different queries and
 * returned different rows.
 *
 * The dev identity now resolves inside `permissions.requireTeacher`, so each
 * operation has one body and one interface, and the whole class of bug is gone
 * rather than policed. What remains worth asserting is that it stays gone.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "_generated" || entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) found.push(full);
  }
  return found;
}

describe("SEC-06 one identity seam", () => {
  it("exports no dev-only twin from any Convex module", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "convex"))) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = line.match(/^export const (\w*AsLocalTeacher|getLocalTeacher\w*)\b/);
        if (match) offenders.push(`${path.relative(ROOT, file)}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("leaves no client surface referencing a dev-only twin", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/\bapi\.\w+\.(\w*AsLocalTeacher|getLocalTeacher\w*)\b/g)) {
          offenders.push(`${path.relative(ROOT, file)}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The gate itself is what keeps the dev identity out of production, so it must
   * stay a two-key opt-in and must not be re-derived beside the module that
   * exports it — seven surfaces had copied the expression inline.
   */
  it("declares the local-teacher gate in exactly one module", () => {
    const ALLOWED = new Set([
      // Owns the gate.
      "lib/teacher-access.ts",
      // Names the variable to *reject* it at deploy time; the backstop, not a
      // second gate.
      "lib/production-env.ts",
    ]);
    const offenders: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        const relative = path.relative(ROOT, file).split(path.sep).join("/");
        if (ALLOWED.has(relative)) continue;
        if (readFileSync(file, "utf8").includes("NEXT_PUBLIC_ENABLE_LOCAL_TEACHER")) {
          offenders.push(relative);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * @scaffold true
 * @phase 3
 * Shared session status types
 *
 * Mirror Convex session status union for UI without importing generated types into socket-server.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

export type SessionStatus = "draft" | "live" | "ending" | "ended";
export type ClassroomRole = "teacher" | "student";

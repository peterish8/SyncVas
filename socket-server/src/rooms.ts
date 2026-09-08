/**
 * Room naming for the relay.
 *
 * One definition, imported by both `server.ts` and `protocol.ts`. It was
 * previously declared identically in both files, so the relay's room keys and
 * its broadcast target agreed only by copy-paste.
 */

export function roomName(sessionId: string): string {
  return `session:${sessionId}`;
}

/**
 * @scaffold true
 * @phase 2
 * Re-export / wrap shared Zod validators
 *
 * All inbound events: safeParse shared schemas; emit protocol:error on failure.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

export {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardUpdateSchema,
  boardCurrentSchema,
  teacherViewportSchema,
  foundationPingSchema,
  foundationPongSchema,
  protocolErrorSchema,
} from "../../shared/protocol/socket.js";

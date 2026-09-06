/**
 * @scaffold true
 * @phase 10
 * Optional HTTP actions for provider webhooks (if needed)
 *
 * Prefer adapter invoked from internal actions over public HTTP.
 * If HTTP is required: auth webhooks, never expose secrets, never echo doubt text.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { httpRouter } from "convex/server";

const http = httpRouter();
// PHASE 10: register routes only if provider requires them.

export default http;

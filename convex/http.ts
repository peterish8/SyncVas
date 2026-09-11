/**
 * HTTP routes for Convex Auth OAuth callbacks.
 * Never log raw doubt text or secrets.
 */

import { httpRouter } from "convex/server";

import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;

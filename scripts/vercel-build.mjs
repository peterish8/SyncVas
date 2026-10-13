import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// A production release builds the website and deploys its matching Convex
// functions. Previews build against the configured database without publishing
// schema changes into production.
const production = process.env.VERCEL_ENV === "production";
if (production && !process.env.CONVEX_DEPLOY_KEY) {
  throw new Error("Configure the production Convex deploy key before releasing SyncVas.");
}
const entry = production
  ? "../node_modules/convex/bin/main.js"
  : "../node_modules/next/dist/bin/next";
const args = production
  ? ["deploy", "--cmd", "npm run build", "--cmd-url-env-var-name", "NEXT_PUBLIC_CONVEX_URL"]
  : ["build"];
const result = spawnSync(process.execPath, [fileURLToPath(new URL(entry, import.meta.url)), ...args], {
  stdio: "inherit",
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

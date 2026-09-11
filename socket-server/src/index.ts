import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { ConfigError, loadConfig } from "./config.js";
import { createSocketServer } from "./server.js";

/**
 * Next loads the root .env.local automatically, while a standalone Socket.IO
 * process does not. Hydrate only the local relay process and never replace an
 * explicitly supplied deployment variable. This makes `npm run dev:all` a
 * real classroom stack instead of a relay that accepts TCP connections but
 * rejects every signed room token.
 */
function loadLocalRelayEnvironment(): void {
  if (process.env.NODE_ENV === "production") return;

  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "..", ".env.local"),
    resolve(process.cwd(), "..", "..", ".env.local"),
  ];
  const source = candidates.find((candidate) => existsSync(candidate));
  if (!source) return;

  for (const line of readFileSync(source, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const quoted = rawValue.match(/^(["'])(.*)\1$/);
    process.env[key] = quoted ? quoted[2] : rawValue;
  }
}

loadLocalRelayEnvironment();

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    // Exit rather than boot: a relay with no usable secret answers health checks
    // happily while rejecting every classroom token, which reads as "deployed
    // and fine" right up until the first lesson fails.
    console.error(`[socket] configuration error: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const httpServer = createServer();
const io = createSocketServer(httpServer, config.allowedOrigins);

httpServer.listen(config.port, () => {
  console.info(
    `[socket] listening on :${config.port} (origins: ${config.allowedOrigins.join(", ")}, production: ${config.isProduction})`,
  );
});

let shuttingDown = false;

/**
 * Close new admissions first, then let in-flight frames drain, then force-exit.
 * Without this a deploy severs every live classroom mid-stroke.
 */
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[socket] ${signal} received, shutting down`);

  const forceExit = setTimeout(() => {
    console.warn("[socket] forced exit after shutdown timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref?.();

  io.close(() => {
    httpServer.close(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[socket] unhandled rejection", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[socket] uncaught exception", error);
  shutdown("uncaughtException");
});

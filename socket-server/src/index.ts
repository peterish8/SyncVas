import { createServer } from "node:http";

import { createSocketServer } from "./server.js";

const port = Number(process.env.SOCKET_PORT ?? 4001);
const allowedOrigins = (process.env.ALLOWED_WEB_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const httpServer = createServer();
createSocketServer(httpServer, allowedOrigins);

httpServer.listen(port, () => {
  console.info(`[socket] foundation service listening on :${port}`);
});

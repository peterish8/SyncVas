import { createHmac } from "node:crypto";
import { io } from "socket.io-client";

const SECRET = process.env.SOCKET_INTERNAL_SECRET ?? "syncvas-dev-socket-secret-min-32-chars";
const SESSION = process.env.PROOF_SESSION_ID ?? "proof-session";
const VERSION = Number(process.env.BOARD_VERSION ?? "1");

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(role) {
  const header = encode({ alg: "HS256", typ: "SVRT1" });
  const payload = encode({
    v: 1,
    sessionId: SESSION,
    role,
    subjectId: `${role}-script`,
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:4001", {
  auth: { token: token("teacher") },
  transports: ["websocket"],
});

await new Promise((resolve, reject) => {
  socket.once("connect", resolve);
  socket.once("connect_error", reject);
});

socket.emit("board:update", {
  v: 1,
  sessionId: SESSION,
  ts: Date.now(),
  boardVersion: VERSION,
  scene: {
    elements: [
      {
        id: "live-rect",
        type: "rectangle",
        x: 80,
        y: 80,
        width: 200,
        height: 120,
        strokeColor: "#1971c2",
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
      },
    ],
  },
});

console.log(`published boardVersion=${VERSION} to ${SESSION}`);
await new Promise((r) => setTimeout(r, 400));
socket.disconnect();
process.exit(0);
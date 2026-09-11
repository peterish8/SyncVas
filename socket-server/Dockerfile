# Build context is the REPOSITORY ROOT, not this directory:
#   docker build -f socket-server/Dockerfile -t syncvas-relay .
# The relay imports ../../shared/protocol, so the shared directory has to be in
# the context.
#
# DEPLOY CONSTRAINT: run this image at exactly ONE replica. All relay state (the
# teacher writer lease, hot board scenes, revocation tombstones, rate counters)
# is process memory, and Socket.IO needs sticky sessions plus an adapter to span
# instances. The process refuses to start in production unless
# RELAY_SINGLE_INSTANCE=1 acknowledges this, and RELAY_TRUST_PROXY is set to 1
# (behind exactly one proxy) or 0 (direct). See docs/20_DEPLOYMENT_ENVIRONMENT.md.

# ── build ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

# The root package.json declares socket-server as a workspace, so both manifests
# are needed before install.
COPY package.json package-lock.json ./
COPY socket-server/package.json ./socket-server/
RUN npm ci --workspace @syncvas/socket-server --include-workspace-root

COPY shared ./shared
COPY socket-server ./socket-server
RUN npm --prefix socket-server run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only; tsx and the test toolchain stay out of the image.
COPY package.json package-lock.json ./
COPY socket-server/package.json ./socket-server/
RUN npm ci --omit=dev --workspace @syncvas/socket-server --include-workspace-root \
    && npm cache clean --force

COPY --from=build /app/socket-server/dist ./socket-server/dist

# node:alpine ships an unprivileged `node` user; never run the public listener as root.
USER node

EXPOSE 4001
ENV SOCKET_PORT=4001

# The relay exits non-zero on bad configuration, so an orchestrator restart loop
# surfaces a misconfigured deploy instead of serving a service that rejects
# every classroom token.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.SOCKET_PORT||4001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "socket-server/dist/socket-server/src/index.js"]

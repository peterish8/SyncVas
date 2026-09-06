# 20 — Deployment and Environment Specification

## Local development

Run three processes:
1. Next.js dev server
2. `npx convex dev`
3. Socket.IO Node server

Recommended ports:
- web: 3000
- socket: 4001

## Production

- Next.js: Vercel
- Convex: Convex deployment
- Socket.IO: persistent WebSocket-capable Node host

Do not assume ordinary request/response serverless functions are equivalent to owning a long-lived WebSocket process. Verify chosen host's Socket.IO/WebSocket deployment guidance before production.

## Environments

- local
- preview/dev
- production

Use different Convex deployments and secrets.

## Secrets

Never expose server signing secret or AI API keys through `NEXT_PUBLIC_*`.

## CORS/origin

Socket service uses explicit allowed origins for known web deployments. Do not use permissive `*` with credentialed auth.

## Release checklist

- tests green
- Convex schema/indexes deployed
- production origins configured
- socket signing keys match issuer/verifier
- AI usage caps enabled
- license notices present
- final board persistence tested
- XP-Pen tested in production browser

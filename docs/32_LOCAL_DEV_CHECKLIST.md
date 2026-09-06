# 32 — Local Development Checklist

## Prerequisites
- Node.js version supported by current Next.js/Convex toolchain
- npm/pnpm selected once for repo
- Git
- Convex account/project
- actual XP-Pen hardware for P0 verification

## Boot
1. Copy `.env.example` -> `.env.local` where appropriate.
2. Install dependencies.
3. Run Convex development process.
4. Run socket server on port 4001.
5. Run Next.js on port 3000.
6. Open teacher page plus two separate/incognito student contexts.

## Smoke checks
- browser console has no hydration/window errors from Excalidraw
- Convex client connects
- socket client connects
- teacher can draw
- student A/B receive updates
- student pan stays local

## Before committing
- format
- lint
- typecheck
- tests
- no secrets committed
- no generated Convex internals edited manually

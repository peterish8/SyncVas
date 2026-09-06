# 23 — AI Coding Agent Execution Guide

## Working method

For each milestone:
1. restate relevant acceptance criteria
2. inspect existing code before editing
3. implement smallest vertical slice
4. run typecheck/lint/tests
5. manually test the user flow
6. update docs only when architecture truly changes

## Before installing a package

- verify it is needed
- check current official docs
- inspect license
- avoid duplicate libraries solving the same problem
- prefer maintained packages

## Excalidraw-specific agent note

Use the installed package's types/docs as source of truth. APIs can change. Start with the minimal client-only embed before adding custom controls/state.

## Convex-specific agent note

- schema + validators
- indexed access
- internal scheduled functions
- await promises
- keep external API calls in actions
- authorization on public functions

## Socket-specific agent note

Define shared event schemas/types before handlers. Never write anonymous ad-hoc event names across components.

## Prohibited “helpful” expansions

Do not add:
- Redis
- Kafka
- Yjs
- microservices
- Kubernetes
- student login
- student cursors
- video/audio
- payments
- complex org tenancy

unless explicitly requested or supported by measured need.

## Visual-reference rule

When a user supplies a visual reference, extract its palette, density, corner treatment, typography mood, and surface/elevation language into the relevant UI/UX and design-system documentation before applying it. Treat the reference's domain-specific layout, data labels, and unrelated workflow as non-binding. Preserve the classroom-first information architecture and all accessibility constraints.

## When blocked

Prefer a documented TODO and a working fallback over inventing an undocumented architecture.

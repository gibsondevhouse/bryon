# Phase 1 Kickoff Plan (Root Scaffold)

## Summary
- Complete **Phase 1 only** as the first checkpoint: scaffold and verify a runnable SvelteKit app in `/Users/gibdevlite/Dev/bryon`.
- Keep all existing `dev/` planning docs in place.
- Lock runtime to **Node 22 LTS** and set project default model to **`gemma3:4b`**.

## Key Changes
- Scaffold in-place with the current CLI (`sv`), not deprecated `create-svelte`, using a non-interactive path that supports a non-empty directory.
- Initialize baseline stack and tooling:
  - SvelteKit + TypeScript strict
  - `@sveltejs/adapter-node`
  - Tailwind CSS v4 via `@tailwindcss/vite`
  - Biome for lint/format (replacing ESLint/Prettier)
  - shadcn-svelte initialization plus required components: `button`, `input`, `textarea`, `dialog`, `card`, `scroll-area`, `separator`, `badge`, `dropdown-menu`, `tooltip`
- Establish app baseline files:
  - `src/app.html` and `src/app.css` with Bryon token variables from the design blueprint
  - strict TS config finalized for server/client/shared boundaries
- Align defaults:
  - Update project-facing default model references from `qwen3:4b` to `gemma3:4b` (config/docs/templates used by the app startup path)

## Public Interfaces / APIs
- No HTTP API endpoints are introduced in this phase.
- Developer-facing interface changes are limited to project scripts/config:
  - runtime requirement (Node 22)
  - lint/format commands via Biome
  - scaffolded test/build/dev scripts from SvelteKit setup

## Test Plan
1. Runtime checks:
   - Confirm active Node major is `22`
   - Confirm `pnpm` is available and dependencies install cleanly
2. Build/tooling checks:
   - `pnpm dev` starts without errors on `127.0.0.1:5174`
   - `pnpm build` succeeds
   - `pnpm lint` and `pnpm format` run successfully under Biome
3. UI/tooling smoke:
   - App loads with global CSS tokens applied
   - Imported shadcn components compile without unresolved deps

## Assumptions
- No git initialization/commit workflow is required in this milestone.
- Ollama is already reachable locally; `gemma3:4b` remains available for later streaming phases.
- DB/schema/services/routes are intentionally deferred to Phase 2+.

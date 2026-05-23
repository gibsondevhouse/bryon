# Bryon — Copilot Repository Instructions

## Project summary

Bryon is a single-user, single-machine local AI chat client. It is a full-stack
SvelteKit (Node adapter) application that proxies all LLM traffic to a locally
running Ollama instance. No cloud, no accounts. SQLite is the only persistence
layer. The product ships as a production-quality finished application — not a
prototype.

## Tech stack

- **Framework**: SvelteKit 5 with Svelte runes (`$state`, `$derived`, `$effect`)
- **Language**: TypeScript (strict; no `any`, no `@ts-ignore`)
- **Package manager**: pnpm 10
- **Database**: SQLite via `better-sqlite3` + Drizzle ORM
- **Validation**: Zod — all schemas live in `src/lib/shared/schemas.ts`
- **Styling**: Tailwind CSS v4 — tokens defined in `src/app.css`
- **Icons**: Lucide (already imported; do not add a new icon library)
- **Logging**: Pino JSON — server side only; no `console.log` in shipped code
- **Testing**: Vitest (unit) + Playwright (e2e); Ollama is stubbed via `e2e/stub-ollama.mjs`
- **Lint / format**: Biome

## Build, test, and lint commands

```sh
pnpm dev            # dev server → http://127.0.0.1:5174
pnpm build          # production build → build/
pnpm lint           # Biome lint (zero warnings required)
pnpm format         # Biome format
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright e2e tests
pnpm db:generate    # generate Drizzle migration from schema changes
pnpm db:migrate     # run pending migrations
```

Always run `pnpm lint` and `pnpm test` before considering a change complete.
Never bypass pre-commit hooks (`--no-verify`).

## Project layout

```text
src/
  app.css                     global styles + design token system (spacing, color, type)
  hooks.server.ts             boot entrypoint — DB init, migrations, Ollama ping
  lib/
    server/                   SERVER-ONLY — Vite enforces; never import from client side
      config.ts               loads ~/.config/bryon/config.toml
      logger.ts               Pino singleton
      db/
        client.ts             DB singleton (initializeDb / getDb / closeDb)
        schema.ts             Drizzle table definitions
        migrations/           SQL migrations (0000–present)
      llm/
        adapter.ts            OllamaAdapter
        router.ts             4-tier model router
      features/
        chat/                 ChatService
        personas/             PersonaService
        plans/                plan.ts, task.ts — plan/task CRUD + doctrine lifecycle
        streaming/            PromptBuilder, streaming pipeline
        projects/             ProjectService
    shared/                   shared between server and browser
      schemas.ts              Zod schemas — all API boundary validation lives here
      types.ts                TypeScript types
    ui/                       base UI primitives (buttons, inputs, dialogs)
    components/               shared Svelte component library
    features/                 feature-specific Svelte components (browser only)
  routes/
    api/                      SvelteKit server endpoints (JSON + SSE)
    chats/[id]/               chat page
    plans/                    plans board
    projects/                 projects page
    settings/                 settings page
```

## Hard architectural constraints

- **Browser never talks to Ollama directly.** All LLM calls go through `POST /api/chats/:id/stream`.
- **`src/lib/server/` is server-only.** Importing anything from it in a `.svelte` component or client-side store causes a Vite build error — do not do it.
- **DB singleton only.** Never open a new `better-sqlite3` connection. Always use `getDb()` from `src/lib/server/db/client.ts`.
- **Multi-step DB writes use transactions.** Wrap in `db.transaction(() => { … })`.
- **Validate at every API boundary.** Parse request bodies with the matching Zod schema from `src/lib/shared/schemas.ts` and return `400` on failure.
- **Messages are immutable.** No edit or delete on individual chat messages after creation.

## Coding conventions

- Return `201` for create, `204` for delete, `404` for missing, `409` for conflict, `503` when Ollama is unreachable.
- Throw structured errors `{ code, message, details? }` — never leak raw SQL or stack traces to the client.
- Every `try/catch` must re-throw, return a typed error response, or log at `error` level. Never swallow.
- Svelte components: design for all four states — loading (skeleton), empty, error, success.
- Use existing UI primitives from `src/lib/ui/` and components from `src/lib/components/`. Do not create one-off button or input styles.
- Respect `prefers-reduced-motion` in Svelte transitions.

## What to avoid

- Do not add `console.log`, `console.warn`, or `TODO` comments to shipped code.
- Do not import server-only modules (`better-sqlite3`, `pino`, Drizzle) outside `src/lib/server/`.
- Do not hand-edit migration SQL files — use `pnpm db:generate`.
- Do not add a new icon library; use Lucide icons already in the project.
- Do not create dead routes or UI stubs without a visible "Coming in Phase NNN" label.
- Do not leave raw error strings in the UI — surface errors via the toast/notification system.

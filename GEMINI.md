# Bryon: Local AI Chat Client

Bryon is a full-stack SvelteKit application designed for a single-user, single-machine experience. It communicates with a locally-running Ollama instance and uses SQLite (via `better-sqlite3` and `Drizzle ORM`) for persistence.

## Project Overview

- **Frontend**: Svelte 5 (runes), Tailwind CSS (v4), Lucide icons.
- **Backend**: SvelteKit (Node.js), better-sqlite3, Drizzle ORM, Pino (logging).
- **LLM**: Ollama (local), with optional server-side web lookup.
- **Key Concepts**:
    - **Chats**: Immutable message history.
    - **Projects/Plans**: Layered organization for chats, files, and "doctrine".
    - **Doctrine**: Military-inspired planning framework (OPORD, FRAGO, AAR, Mission Need, Commanders Intent).
    - **Memory**: Settings-managed "Remember" and "Never suggest" entries.

## Core Mandates & Constraints

- **Security**: Local-first. No cloud accounts. Protect `~/.config/bryon/` and `~/.local/share/bryon/`.
- **Architectural Boundary**: `src/lib/server/` is STRICTLY server-side. Vite enforces this; never import server-only modules (like `better-sqlite3` or `pino`) into client-side components.
- **Database**: Single connection opened in `hooks.server.ts`. Use the singleton from `src/lib/server/db/client.ts`.
- **Immutability**: Messages are immutable after creation.
- **Validation**: All API boundaries MUST be validated using Zod schemas from `src/lib/shared/schemas.ts`.

## Development Workflow

### Key Commands

```sh
pnpm install        # Install dependencies
pnpm dev            # Start dev server (default http://127.0.0.1:5174)
pnpm gate           # Quality gate: lint, check, test, build (RUN BEFORE PUSH)
pnpm test           # Run Vitest unit tests
pnpm test:e2e       # Run Playwright end-to-end tests
pnpm lint           # Run Biome lint
pnpm format         # Run Biome format
pnpm db:generate    # Generate Drizzle migrations
pnpm db:migrate     # Apply migrations
```

### Quality Standards

- **Backend**:
    - Use typed, structured errors. Never leak raw stack traces to the client.
    - Use DB transactions for multi-step operations.
    - No silent failures; log errors at `error` level with Pino.
    - No `any` or `@ts-ignore`.
- **Frontend**:
    - Design for every state: Loading (skeletons), Empty, Error, Success.
    - Optimistic updates for responsive UI where safe.
    - Strict adherence to accessibility (labels, ARIA, keyboard navigation).
    - Motion should be purposeful using Svelte transitions.
    - Responsive design down to 1024x720.

## Project Structure

- `src/lib/server/`: LLM adapters, DB client, services (Chat, Prompt, Persona), and server-only utilities.
- `src/lib/shared/`: Zod schemas and TypeScript types shared between client and server.
- `src/lib/ui/`: Base UI primitives (buttons, inputs, dialogs).
- `src/lib/features/`: Feature-specific Svelte components (ChatView, MessageList, Composer).
- `src/routes/`: SvelteKit routes (API endpoints and UI pages).
- `dev/`: Architecture documentation, build plans, and phase sequencing.

## Data Locations

- **Database**: `~/.local/share/bryon/bryon.db`
- **Config**: `~/.config/bryon/config.toml`
- **Logs**: `~/.local/share/bryon/bryon.log`

## SSE Streaming Format

The `/api/chats/:id/stream` endpoint uses `text/event-stream`.
Events: `token` (delta), `meta` (timing/tokens), `error` (code/message), `done` (stats).

## Prerequisites

Ensure Ollama is running and the required models are pulled:
```sh
ollama serve
ollama pull gemma4:e4b
```

# Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: none

---

## Bryon

Local AI chat client. Full-stack SvelteKit app that talks to a locally-running Ollama instance. Single-user, single-machine. No accounts required; optional free web lookup is server-side.

---

## Prerequisites

Ollama must be running before the app will work. v1 uses a chat model plus a vision model for photo uploads.

```sh
ollama serve
ollama pull gemma4:e4b         # Bryon v1 is locked to Gemma 4 (multimodal: chat + vision)
```

---

## Dev commands

```sh
pnpm dev            # start dev server on http://127.0.0.1:5174
pnpm build          # production build → build/
node build          # run production build
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright e2e tests
pnpm lint           # Biome lint
pnpm format         # Biome format
pnpm db:generate    # generate Drizzle migration from schema changes
pnpm db:migrate     # run pending migrations
```

---

## Project structure

```text
src/
  lib/
    server/         # server-only code — Vite enforces this boundary
      db/           # better-sqlite3 client, Drizzle schema, migrations
      llm/          # OllamaAdapter, token counter
      features/     # ChatService, PromptBuilder, TitleService, internal persona service
      uploads.ts    # image/document upload storage + document text extraction
      web-search.ts # explicit web lookup providers
      config.ts     # loads ~/.config/bryon/config.toml
      logger.ts     # pino JSON logger
    shared/         # shared between server and browser
      schemas.ts    # Zod schemas
      types.ts      # TypeScript types
    ui/             # Svelte components (browser only)
    stores/         # Svelte 5 rune-based state
  routes/
    api/            # SvelteKit server endpoints
    chats/[id]/     # chat page
    settings/       # settings page

dev/
  docs/             # architecture and design documentation
  plans/            # build plans and phase sequencing
```

---

## Key constraints

- **Browser never talks to Ollama directly.** All LLM calls go through `POST /api/chats/:id/stream`.
- **`lib/server/` is server-only.** Never import from the client side. Vite will error if you try.
- **DB opens once at boot** in `hooks.server.ts`. Never create new connections in endpoints — use the singleton from `db/client.ts`.
- **All API responses are JSON** except `/api/chats/:id/stream` (SSE / `text/event-stream`).
- **Messages are immutable** after creation. No edit or delete on individual messages.
- **Personas are live-injected** — fetched fresh on every turn, not snapshotted per chat.

---

## Data locations

| Resource | Path |
| --- | --- |
| Database | `~/.local/share/bryon/bryon.db` |
| Config | `~/.config/bryon/config.toml` |
| Logs | `~/.local/share/bryon/bryon.log` |

---

## Config file (default values)

V1 uses `[llm].model` for normal chat and `[llm].vision_model` for turns with image attachments. Web lookup and memory are explicit chat settings.

```toml
[app]
host     = "127.0.0.1"
port     = 5174
data_dir = "~/.local/share/bryon"

[llm]
backend      = "ollama"
base_url     = "http://127.0.0.1:11434"
model        = "gemma4:e4b"
vision_model = "gemma4:e4b"

[llm.params]
temperature    = 1.0
top_p          = 0.95
top_k          = 64
repeat_penalty = 1.1
num_ctx        = 16384
num_predict    = 1024
keep_alive     = "10m"

[web_search]
enabled     = true
searxng_url = "" # optional; DuckDuckGo Instant Answers is used as free fallback
max_results = 5

[memory]
enabled       = true
remember      = ""
never_suggest = ""
```

---

## Architecture docs

Read these before writing any code:

| Doc | What it covers |
| --- | --- |
| `dev/docs/stack/bryon-stack.md` | Full tech stack, file layout, DB schema, streaming design, API surface, boot sequence |
| `dev/docs/bryon_deepseek_style_blueprint.md` | UI design system — layout, tokens, component specs |
| `dev/docs/decisions.md` | 5 locked architectural decisions with rationale |
| `dev/docs/slash-commands.md` | Slash command registry and implementation notes |
| `dev/docs/perf-targets.md` | Minimum acceptable performance numbers |
| `dev/docs/failure-modes.md` | Every error state and how to handle it |
| `dev/docs/roadmap.md` | v1 rich-chat scope, v1.5 projects/prompt/memory scope, v2/v3 |
| `dev/docs/persona.md` | Default internal Bryon persona |
| `dev/docs/agent-foundations.md` | v1.5 Projects, prompt defaults, and richer memory editing |
| `dev/plans/build-phases.md` | Phased build sequence — follow this order |
| `dev/plans/docs-crosswalk.md` | Which docs to read before starting each phase — check this first |

---

## SSE streaming format

The `/api/chats/:id/stream` endpoint emits `text/event-stream`. Event types:

```text
event: token
data: {"delta":"Hel"}

event: meta
data: {"msToFirst":412,"tokensIn":287}

event: error
data: {"code":"MODEL_NOT_FOUND","model":"gemma4:e4b","message":"..."}

event: done
data: {"id":"01J...","tokensOut":58,"msTotal":1830}
```

A `ms_total = null` on a persisted assistant message means the stream was interrupted or cancelled.

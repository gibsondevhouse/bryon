# Bryon — Full-Stack SvelteKit Stack

Bryon is a local, single-user SvelteKit chat app that talks to Ollama through server endpoints. V1 is a rich chat assistant: streaming chat, image uploads, document uploads, explicit web lookup, search/history, title generation, and settings-managed memory.

The browser never talks to Ollama directly. No cloud service, accounts, or background agent loop is required.

---

## 1. Runtime Topology

```text
Browser on localhost
  Svelte 5 UI
  chat, composer, uploads, settings, history search
        |
        | same-origin HTTP/SSE
        v
SvelteKit server on Node 22
  API endpoints, SQLite services, prompt building, upload extraction
        |
        +--> better-sqlite3 bryon.db
        +--> Ollama /api/chat at 127.0.0.1:11434
        +--> optional SearXNG JSON endpoint or DuckDuckGo Instant Answers fallback
```

Default server bind: `127.0.0.1:5174`.

---

## 2. Locked Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | SvelteKit + Svelte 5 | Full-stack app with native server endpoints and streaming. |
| Language | TypeScript | Shared client/server types and validation. |
| Adapter | `@sveltejs/adapter-node` | Long-running local server with SQLite and SSE. |
| DB | SQLite via `better-sqlite3` | Single-user local database, fast and low-ceremony. |
| Migrations | Drizzle | Typed schema plus SQL migrations. |
| Validation | Zod | Request/response schemas. |
| LLM | Direct fetch to Ollama `/api/chat` | Small API surface, no SDK lock-in. |
| UI | Svelte components + Tailwind/shadcn-svelte pieces | Fast local UI with accessible primitives. |
| Tests | Vitest + Playwright | Unit and local browser coverage. |
| Lint/format | Biome | One fast tool. |

---

## 3. Project Layout

```text
src/
  hooks.server.ts
  lib/
    server/
      db/              # better-sqlite3 client, Drizzle schema, migrations
      features/        # chat, streaming, personas/default prompt services
      llm/             # adapter interface, Ollama adapter, token counting
      config.ts        # ~/.config/bryon/config.toml + env overrides
      uploads.ts       # image/document upload storage and text extraction
      web-search.ts    # explicit web lookup provider adapter
      logger.ts
    shared/            # Zod schemas, stream events, types, slash commands
    features/          # browser feature modules and Svelte components
    ui/                # local UI primitives
  routes/
    api/
      chats/           # chat CRUD, messages, uploads, streaming, title
      health/          # Ollama/model readiness
      kb/              # disabled in v1, reserved for projects v1.5
      personas/        # disabled in v1, default persona remains internal
      search/          # local message history search
      settings/        # settings TOML read/write
    chats/[id]/
    settings/

dev/
  docs/
  plans/
```

`lib/server/` is server-only. Browser code may use `lib/shared/`, UI components, and feature modules that do not import server code.

---

## 4. Data Model

Active v1 concepts:

- `personas`: retained for the internal default Bryon system prompt and DB compatibility. Public persona switching is disabled in v1.
- `chats`: title, optional per-chat model pin, params, archive state, and legacy `persona_id` compatibility.
- `messages`: immutable user/assistant/system rows, metrics, summaries, and `attachments_json` for per-turn uploads.
- `settings`: persisted TOML-backed app settings.
- FTS/search: message history search filters to user/assistant rows.

Legacy v1.5-era columns/tables may remain in the DB for compatibility. Do not destructively drop them during the v1 scope reset.

---

## 5. Streaming Contract

Endpoint: `POST /api/chats/:id/stream`.

Request body:

```ts
{
  content: string;
  attachments?: Attachment[];
  webSearch?: boolean;
  paramsOverride?: Partial<LLMParams>;
}
```

Response: `text/event-stream` with only these v1 events:

```text
event: token
data: {"delta":"Hel"}

event: meta
data: {"msToFirst":412,"tokensIn":287}

event: error
data: {"code":"MODEL_NOT_FOUND","model":"gemma3:4b","message":"..."}

event: done
data: {"id":"01J...","tokensOut":58,"msTotal":1830}
```

No model-controlled `tool_call`, `tool_result`, or `tool_error` events are part of v1.

---

## 6. Stream Flow

1. Validate request with Zod.
2. Validate attachment references from the upload endpoint.
3. If image attachments exist, route the turn to `[llm].vision_model` and return a clear missing-model error if unavailable.
4. If `webSearch` is true, run explicit server-side web lookup before prompt assembly.
5. Persist the immutable user message with `attachments_json`.
6. Build the system prompt from the default Bryon prompt, settings-managed memory, and optional web context.
7. Build message history with `PromptBuilder`, including image bytes and extracted document text for the relevant user turn.
8. Stream Ollama NDJSON as SSE token/meta/done/error events.
9. Persist the assistant message with timing/token metrics, or `ms_total = null` if cancelled/interrupted.
10. Queue title generation after the first turn.

---

## 7. Uploads

V1 upload support is explicit chat context, not an agent tool.

Supported images:

- PNG
- JPEG
- WebP

Supported documents:

- PDF
- TXT
- MD
- HTML
- DOCX
- XLSX
- PPTX

Limits:

- 25 MB per file.
- 100 MB per message.
- Extracted document text is truncated before prompt injection to protect context budget.

Storage path: `~/.local/share/bryon/uploads/<chatId>/` by default.

Document extraction happens server-side. The extracted text path is stored in attachment metadata and injected only for the turn where the user attached the file.

---

## 8. Web Lookup

Web lookup is an explicit composer control. The model does not choose to search.

Provider behavior:

1. If `[web_search].searxng_url` is configured, call its SearXNG-compatible JSON search API.
2. If no SearXNG endpoint is configured, or SearXNG fails, use DuckDuckGo Instant Answers as a limited no-key fallback.
3. If lookup is disabled, return a clear disabled/error state.

Search context is appended to the system prompt for that turn with source URLs and a warning when results are limited.

---

## 9. Memory

V1 memory is manually edited in Settings:

- `Remember`
- `Never suggest`

When enabled, both fields are injected into every chat prompt. There is no auto-memory in v1. V1.5 may add richer editing, scope, archive state, and origin audit fields.

---

## 10. Configuration

```toml
[app]
host     = "127.0.0.1"
port     = 5174
data_dir = "~/.local/share/bryon"

[llm]
backend      = "ollama"
base_url     = "http://127.0.0.1:11434"
model        = "gemma3:4b"
vision_model = "gemma4:e4b"

[llm.params]
temperature    = 0.6
top_p          = 0.9
top_k          = 40
repeat_penalty = 1.1
num_ctx        = 8192
num_predict    = 1024
keep_alive     = "10m"

[web_search]
enabled     = true
searxng_url = ""
max_results = 5

[memory]
enabled       = true
remember      = ""
never_suggest = ""
```

Important env overrides:

- `BRYON_LLM_MODEL`
- `BRYON_LLM_VISION_MODEL`
- `BRYON_WEB_SEARCH_ENABLED`
- `BRYON_SEARXNG_URL`
- `BRYON_WEB_SEARCH_MAX_RESULTS`
- `BRYON_MEMORY_ENABLED`
- `BRYON_MEMORY_REMEMBER`
- `BRYON_MEMORY_NEVER_SUGGEST`

---

## 11. API Surface

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/chats` | List chats. |
| POST | `/api/chats` | Create chat. |
| GET | `/api/chats/:id` | Get chat metadata. |
| PATCH | `/api/chats/:id` | Rename, archive, change model or params. |
| DELETE | `/api/chats/:id` | Delete chat. |
| GET | `/api/chats/:id/messages` | Paged history. |
| POST | `/api/chats/:id/uploads` | Upload images/documents for a chat turn. |
| GET | `/api/chats/image` | Serve stored image attachments. |
| POST | `/api/chats/:id/stream` | SSE generation. |
| POST | `/api/chats/:id/title` | Regenerate title. |
| GET / PATCH | `/api/settings` | Read/write global settings. |
| GET | `/api/search` | Search user/assistant message history. |
| GET | `/api/health` | DB/Ollama/model readiness. |
| any | `/api/personas/*` | Disabled in v1; returns `PERSONAS_NOT_IN_V1`. |
| any | `/api/kb/*` | Disabled in v1; returns `PROJECTS_NOT_IN_V1`. |

All responses are JSON except `/api/chats/:id/stream`.

---

## 12. V1.5 Direction

V1.5 adds Projects, not agent sprawl:

- Project-scoped chats and uploaded files.
- Project prompt defaults and reusable prompt presets.
- Global/project memory editing, enable/disable, archive, and eventual origin audit.
- Project knowledge search and optional RAG after explicit project-file attachment works.

Keep this separation strict: v1 is rich global chat; v1.5 is the organizing layer around projects, prompts, memory, and reusable knowledge.

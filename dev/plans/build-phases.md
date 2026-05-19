# Bryon Build Phases

This plan reflects the revised scope: rich chat in v1, Projects in v1.5. Follow phases in order and keep each phase shippable.

## V1 — Rich Global Chat

### Phase 1 — Project Baseline

- SvelteKit + TypeScript + pnpm setup.
- Biome, Vitest, Playwright, adapter-node.
- Basic app shell and route layout.

### Phase 2 — Data and Config

- SQLite/Drizzle client and migrations.
- `~/.config/bryon/config.toml` loader with env overrides.
- App, LLM, web lookup, and memory config defaults.

### Phase 3 — Server Boot

- Open DB once at boot.
- Run migrations/readiness checks.
- Seed the internal default Bryon persona for prompt compatibility.
- Ping Ollama and report clear health state.

### Phase 4 — Chat CRUD and History

- Create/list/get/update/delete chats.
- Immutable messages.
- Message history pagination.
- Local message search over user/assistant rows.

### Phase 5 — Streaming Chat

- `POST /api/chats/:id/stream` SSE.
- Events: `token`, `meta`, `error`, `done`.
- Cancellation and retry.
- Title generation.
- PromptBuilder context budgeting/summarization.

### Phase 6 — Chat UI

- Sidebar, chat page, virtualized message list, composer.
- Markdown/code rendering.
- Streamed assistant preview.
- Error rows and retry affordance.

### Phase 7 — Slash Commands

- `/help`
- `/new`
- `/clear`
- `/model`
- `/export`

Do not ship `/persona` or `/tools` in v1.

### Phase 8 — Uploads

- Image uploads: PNG, JPEG, WebP.
- Route image turns to `[llm].vision_model`.
- Clear missing vision-model error.
- Document uploads: PDF, TXT, MD, HTML, DOCX, XLSX, PPTX.
- Extract document text and include it only in that turn's prompt.
- Enforce per-file and per-message limits.

### Phase 9 — Web Lookup

- Explicit composer toggle.
- SearXNG-compatible JSON provider when configured.
- DuckDuckGo Instant Answers fallback when no SearXNG URL exists.
- Disabled/error states.
- Source URLs injected into prompt context for the turn.

### Phase 10 — Settings and Manual Memory

- Settings UI for chat model, vision model, generation params, web lookup config.
- Manual memory fields: `Remember`, `Never suggest`.
- Enable/disable memory injection.
- Atomic TOML writes.

### Phase 11 — V1 Hardening

- Unit and e2e coverage for streaming, cancel/retry, title generation, settings, search, history.
- Upload coverage for supported image/document types and limits.
- Web lookup provider/disabled/error coverage.
- Memory injection coverage.
- Docs updated so v1 means rich chat, not agent foundations.

## V1.5 — Projects, Prompts, Memory Editing

### Phase 12 — Projects Schema and API

- Add `projects` table.
- Add nullable `chats.project_id`.
- Project CRUD endpoints.
- Assign/unassign chats.
- Non-destructive migrations only.

### Phase 13 — Project UI

- Project list/create/rename/archive.
- Project-scoped chat list.
- Move chats between global and project scope.

### Phase 14 — Project Files

- Upload reusable files to a project.
- Extract text and store file metadata.
- Explicitly attach selected project files to a chat turn.
- No silent retrieval.

### Phase 15 — Prompt Library

- Edit default Bryon prompt.
- Create reusable prompt presets.
- Apply presets to current draft or project override.
- Project-specific prompt override.

### Phase 16 — Richer Memory Editing

- Global/project memory scopes.
- Enable/disable per scope.
- Archive-ready memory representation.
- Origin metadata if auto-memory is later added.

### Phase 17 — Project Knowledge Search

- Search extracted project-file text.
- Optional embeddings/RAG only after explicit project-file selection and text search work.

### Phase 18 — V1.5 Hardening

- Migration compatibility.
- Project-scoped API/e2e coverage.
- Prompt/memory regression coverage.
- Performance checks for large project file lists and long chats.

# Bryon — Roadmap

This document defines the product boundary after the scope reset: V1 is rich single-chat assistance; V1.5 is projects, prompt management, and deeper memory editing.

---

## v1 — Rich Chat

V1 is a focused chat app, not a general agent workspace.

### Core chat

- [x] SvelteKit 2 + Svelte 5 full-stack app
- [x] SQLite via Drizzle/better-sqlite3
- [x] Local Ollama streaming through `POST /api/chats/:id/stream`
- [x] Chat history, sidebar, message search, markdown/code rendering, export
- [x] Settings for chat model and generation params
- [x] Health checks for Ollama and configured models

### Rich context inputs

- [x] Photo upload in chat; image turns route to `[llm].vision_model`
- [x] Document upload in chat; PDF, TXT, MD, HTML, DOCX, XLSX, PPTX are extracted and injected into that turn
- [x] Explicit web lookup toggle in the composer
- [x] Free lookup path: configured SearXNG endpoint when present, DuckDuckGo Instant Answers fallback otherwise
- [x] Manual memory in Settings: `Remember` and `Never suggest`

### Explicitly not in v1

- Projects
- Domain personas
- Model-controlled tools/tool loops
- Reusable knowledge-base libraries or RAG indexing
- Prompt library/editing UI
- Automatic memory extraction

---

## v1.5 — Projects, Prompts, Memory Editing

V1.5 adds organization and editable context management on top of the v1 chat foundation.

- Project-scoped chats and uploaded files
- Project-level prompt defaults
- Reusable prompt presets/library
- Rich memory editing: enable/disable, edit, archive, project/global scope
- Reusable project knowledge search/RAG
- Optional provenance/audit metadata for memories if auto-memory is introduced later

---

## v2 — Quality and Depth

- Chat pinning
- Chat folders/groups outside project mode if still useful
- Export UI beyond slash command
- Model management UI for installed Ollama models
- Thinking block display for models that emit think tags
- Dark mode
- Chat branching

---

## v3 — Desktop App

- Tauri 2 packaging
- Auto-updater
- Native file drag-and-drop
- Windows/Linux builds

---

## Non-goals

- Multi-user accounts
- Cloud sync as a required product dependency
- Native mobile app
- Voice input/output

# Current Implementation Inventory

This inventory records what exists before the full course-correction buildout.
Use it to avoid duplicating partial features and to identify consolidation work.

## Chat Foundation

- `src/routes/api/chats/*` implements chat CRUD, message history, uploads, title
  generation, and SSE streaming.
- `src/lib/server/features/streaming/*` builds prompts, handles context
  summarization, streams Ollama responses, and persists assistant messages.
- Chat already supports image/document attachments, explicit web lookup, project
  file attachment, thinking blocks, markdown/code rendering, and stream metrics.

## Planning

- `src/lib/server/features/plans/plan.ts` and `/api/plans` provide simple plan
  CRUD.
- `src/routes/planning/+page.svelte` provides a lifecycle board, but it uses the
  old `ideation/definition/execution/maintenance` vocabulary and does not yet
  model 10-series cards.

## Projects, Files, Prompts, Memory

- `src/lib/server/features/projects/project.ts` provides project CRUD, project
  file indexing/search, prompt presets, and memory entries.
- `project_files` and `project_file_chunks` already support explicit project
  knowledge search.
- Projects are not yet children of plans and still use old status vocabulary.

## Knowledge Base and Tools

- `src/lib/server/kb/*` provides collection/document ingestion and retrieval.
- `src/lib/server/tools/*` defines a server-side tool registry and built-ins.
- These pieces should be reused only where they support plan/project workflows;
  avoid making model-controlled tool loops the primary product surface.

## Settings and Runtime

- `src/lib/server/config.ts` currently loads a single Ollama chat model and
  vision model.
- `src/lib/server/llm/readiness.ts` checks only chat and vision model presence.
- Runtime readiness includes additive compatibility repairs and migration drift
  reporting.

## UI Shell

- The sidebar already lists chats, projects, and planning.
- The home page is still chat-first and should become Home / Command Centre.
- Settings contains model, web lookup, prompt library, and memory controls, but
  not tiered model/privacy/workspace sections.

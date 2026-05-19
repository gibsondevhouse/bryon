# Bryon — Project Foundations (v1.5)

This document replaces the earlier v1.5 agent/persona/tool-loop plan. Bryon v1 is a rich single-user chat assistant with explicit uploads, explicit web lookup, and settings-managed memory. Bryon v1.5 adds the project layer: project-scoped chats, files, prompt defaults, and richer memory controls.

Nothing in v1.5 should reintroduce model-controlled tool loops or domain-persona sprawl. The user decides when to attach files, run web lookup, or manage memory.

---

## 1. Scope Boundary

| Version | Scope | Non-goals |
| --- | --- | --- |
| v1 | Rich global chat: text streaming, image uploads, document uploads, explicit web lookup, manual memory in settings. | Projects, prompt libraries, reusable document libraries, RAG indexing. |
| v1.5 | Projects: scoped chats/files, prompt defaults, project memory rules, prompt preset/library UI. | Autonomous agents, model-selected tools, domain persona switching. |
| v2+ | Optional retrieval, automations, or advanced workflows if the project layer proves useful. | Premature agent framework work. |

---

## 2. Project Model

Projects are containers around context, not separate accounts or cloud workspaces.

A project owns:

- Project metadata: name, description, archived state, timestamps.
- Project chats: chats can be global or assigned to a project.
- Project files: uploaded once, reusable across chats in that project.
- Project prompt defaults: optional override layered on top of the default Bryon prompt.
- Project memory rules: project-scoped remember / never-suggest text.

Global chat remains the default. Creating or using a project should be explicit and reversible.

---

## 3. Suggested Schema

Preserve existing v1 and legacy v1.5 tables. Add migrations instead of destructive drops.

```text
projects
  id text primary key
  name text not null
  description text
  prompt_override text
  memory_enabled integer not null default 1
  remember text not null default ''
  never_suggest text not null default ''
  archived_at integer
  created_at integer not null
  updated_at integer not null

chats
  add project_id text references projects(id)

project_files
  id text primary key
  project_id text not null references projects(id)
  name text not null
  mime text not null
  path text not null
  text_path text
  size_bytes integer not null
  created_at integer not null

prompt_presets
  id text primary key
  name text not null
  body text not null
  created_at integer not null
  updated_at integer not null
```

Keep message attachments immutable. Project files are reusable context objects; message uploads remain per-turn attachments.

---

## 4. Prompt Composition

Prompt order for v1.5:

1. Default Bryon system prompt.
2. Optional project prompt override.
3. Global manual memory when enabled.
4. Project memory rules when enabled.
5. Explicit per-turn context: attached message files, selected project files, web lookup results.
6. Conversation history.

Project prompt overrides should not replace safety or operational instructions unless the user explicitly edits the default prompt in the prompt library.

---

## 5. Prompt Library

v1.5 should expose prompt editing without creating persona switching.

Required UI:

- Edit default Bryon prompt.
- Create reusable prompt presets.
- Apply a preset to a chat draft or project override.
- Set or clear a project-specific prompt override.

Avoid domain persona cards. A prompt preset is just reusable text; it does not imply a separate model, tool allowlist, or hidden behavior profile.

---

## 6. Memory Editing

v1 has two settings fields: `Remember` and `Never suggest`.

v1.5 expands memory management:

- Enable or disable global memory injection.
- Enable or disable project memory injection.
- Edit global and project memory text.
- Archive memory entries if memory later becomes itemized.
- Track origin metadata if auto-memory is added later: user-entered, imported, or model-suggested.

Auto-memory is not part of v1.5 unless explicitly scoped later. Manual user control remains the default.

---

## 7. Project Files and Retrieval

v1.5 can add reusable document libraries before adding embeddings.

Phase order:

1. Store project files and extracted text.
2. Let the user explicitly attach selected project files to a chat turn.
3. Add project file search over extracted text.
4. Add embeddings/RAG only after the explicit flow works and has tests.

Do not make the model silently search project files. Retrieval should be a visible, user-controlled capability until there is a clear UX reason to automate it.

---

## 8. Deferred Agent Work

The following are intentionally out of v1.5:

- Model-controlled tool loops.
- Domain persona switching.
- Per-persona tool allowlists.
- Shell execution tools.
- Autonomous background tasks.
- Hidden project-file retrieval.

If these return later, they should be scoped as separate features on top of Projects, not as prerequisites for clean chat UX.

# Features Required for a Polished Release

This document enumerates the capabilities that must be present for Bryon to qualify as an out‑of‑the‑box prosumer‑grade application.  These are not presented in chronological order; rather, they represent the **feature completeness** required before a polished launch.  Each item describes what needs to be in place and how it should behave.

## Intake & Classification

* **Folder selection UI** allowing users to pick directories to watch or scan.
* **Robust file scanning** with progress indicators, the ability to pause/cancel and graceful handling of large directories.
* **Local classification engine** (local Gemma 4 via Ollama) that:
  - Categorises common file types with high confidence.
  - Flags potentially sensitive files (medical, financial, legal) for local‑only processing.
  - Can handle unknown formats by labelling them “Other/Unknown.”
* **Proposed plan/project generation** based on classification results, with meaningful default names and descriptions.
* **User review interface** for including/excluding files, renaming/merging categories, setting local‑only flags and confirming the organisation action.
* **Move/copy options** to organise files into the workspace while preserving originals if desired.
* **Undo/redo** for the entire organisation step.

## Plan Model

* Support for the **10‑series structure**, including adding, editing, reordering and deleting cards in each series.
* **Lifecycle states** for plans (Proposed, Drafting, Active, Archived) with UI indicators and drag‑and‑drop transitions.
* **Context inheritance** from plans to projects and tasks, including weight controls for always/conditionally injected context.
* **Plan editor** with rich text editing, markdown support, side‑by‑side preview and templated inserts.
* **Downstream impact analysis** when editing or deleting cards.
* **Plan import/export** via `.bryon` and JSON for sharing across workspaces (optional but desirable).

## Project & Task Management

* Ability to **create projects** manually or from intake suggestions, with one‑sentence descriptions.
* **Project expansion** into summaries, task lists and docs using plan context. The router picks a tier based on task size: local Gemma 4 31B by default, escalating to Gemini Flash via Ollama Cloud (or Pro via direct API, if enabled) when needed.
* **Task list management** with statuses (Proposed, Planned, In Progress, Blocked, Completed, Archived), due dates, assignees and ordering.
* **Task expansion** into subtasks and detailed outlines when requested.
* **Attachment of files and docs** to projects and tasks, with previews and categories.
* **Recording and viewing decisions** tied to projects and tasks.
* **Project statuses** independent of plan status.

## `.bryon` Workspace & CLI

* Creation of a **human‑readable `.bryon` folder** storing plan, project and state files.
* **Workspace Sync view** showing last checkpoint, changed files, stale docs and missing agent files.
* **CLI commands** (`sync`, `checkpoint`, `audit`) that operate safely on the workspace and produce clear output.
* **Checkpoint creation** capturing description, plan/project snapshot, open tasks and diff of changes.
* **Document generation and refresh** integrated into sync operations.
* **Agent instruction generation** for `.github`, `.claude`, `.gemini` etc. based on current plan context.
* **Diff and audit reporting** of outdated plan sections, rule violations and context gaps.

## Model Integration & Privacy

* **Local Ollama — Gemma 4 (small)** for classification, sensitivity detection and light summarisation. The default daily driver.
* **Local Ollama — Gemma 4 31B** for deep summarisation, plan section generation, project expansion and agent‑instruction generation when local hardware is sufficient.
* **Gemini 3 Flash Preview via Ollama Cloud** for tasks neither local tier can comfortably handle. Reached through the same Ollama client; no separate API key.
* **Optional direct Gemini API (Pro)** for power users who want top‑end quality. Off by default; opt‑in via API key in Settings.
* **Model router** that picks a tier per task type (classification stays local; summarisation/planning escalates as needed) and respects local‑only privacy rules.
* **Settings UI** for configuring the Ollama base URL, per‑tier model tags, generation parameters, the optional Gemini API key, local‑only categories, preview requirements and cost limits.
* **Preview before remote send** functionality that shows the user exactly what content will leave the machine for Tier 3/4 calls and allows redaction.
* **Token usage tracking** per provider with budget alerts.
* **Extensibility hooks** for adding new providers in the future.

## User Interface & Experience

* **App shell** with sidebar, top bar, keyboard navigation and responsive layout.
* **Home/Command Centre** summarising active plans, proposed plans, recent checkpoints and model status, with quick actions.
* **Plan Dashboard** with lifecycle columns, drag‑and‑drop transitions and health indicators.
* **Plan Workspace** with horizontal 10‑series, card editing, context weight toggles and downstream impact display.
* **Project Detail Page** with inherited context panel, task management, files/docs, decisions and checkpoints.
* **Folder Intake Review** with category grouping, file previews, local‑only toggles, renaming and bulk actions.
* **Workspace Sync view** showing checkpoint history, diffs, stale docs and agent file status, with actionable buttons.
* **Chat Surface** integrated across the app, context aware, with saved prompts, history and privacy indicators.
* **Settings page** covering workspace paths, model connections, privacy rules, appearance and advanced options.
* **Dark/light theme** support and custom accent colours.
* **Accessibility** features: proper labels, focus order, high contrast mode, screen reader compatibility.

## Performance & Stability

* Application starts quickly and remains responsive when managing hundreds of plans, projects and files.
* Long‑running operations (classification, summarisation) provide progress feedback and can be cancelled.
* Errors (e.g. model failures, filesystem issues) are presented clearly with options to retry or fallback.
* All actions that modify plans, projects or files are undoable or confirmable before permanent effects.

## Security & Privacy

* Sensitive data identified by the local model is never sent to cloud providers.
* Users can mark categories and individual files as local‑only.
* All outgoing requests to cloud models are encrypted and authenticated.
* API keys are stored securely using the OS keychain or encrypted files.
* The `.bryon` folder is excluded from unintended sharing and respects `.gitignore` if within a git repo.

## Summary

This checklist represents the functional scope of a polished Bryon release.  While implementation details may vary, users should be able to install the app, connect optional cloud models, organise their files into plans and projects, keep their workspace synchronised and enjoy a responsive, privacy‑respecting experience.  Anything less risks shipping an incomplete or frustrating product to prosumers who expect professional‑quality tooling.
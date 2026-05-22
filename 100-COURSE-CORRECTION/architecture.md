# Architecture

This document describes the high‑level architecture of Bryon and the flow of data from messy files to organised plans, projects and tasks.  Understanding these components and their interactions is critical to building a polished, stable product.

## Components

Bryon is composed of several cooperating modules.  Each module has a clear responsibility and communicates through well‑defined interfaces.

### 1. **Intake & Classification**

* **Folder Watchers** –  Bryon can watch user‑selected folders (e.g. **Downloads**, **Desktop**, project directories).  When a new file appears or the user triggers a scan, the watcher notifies the classification engine.
* **Local Classification Engine** –  The small local Gemma 4 model (via Ollama, Tier 1) analyses file names and contents to classify them into broad categories (e.g. work correspondence, medical documents, invoices, lectures, code, photos).  It also flags sensitive categories (medical, legal, personal) for local‑only processing.  The classification results are stored locally and used to propose plans and projects.  No remote calls are made at this stage.
* **Folder Intake UI** –  A review surface where the user sees detected categories, proposed plans/projects and file lists.  The user can approve, rename or exclude items, mark sensitive categories as local‑only and decide where files should be organised.  Only after approval are files moved or copied into their new workspace directories.

### 2. **Plan Builder & Summarisation**

* **Plan Builder** –  Once the user approves a set of files or manually creates a plan, Bryon assembles an initial plan structure.  It populates upstream sections (purpose, context, goals) using the local classification metadata and any user‑provided descriptions.
* **Heavy‑lift Summarisation** –  For deep summaries, roadmaps and documentation Bryon escalates through the model stack: first to **local Gemma 4 31B** (Tier 2, still on the user's machine via Ollama), and only if that tier cannot comfortably handle the task to **Gemini 3 Flash Preview via Ollama Cloud** (Tier 3) or, if the user has opted in, **Gemini Pro via the direct Gemini API** (Tier 4).  Before any tier‑3/4 call, Bryon applies the user's privacy rules: local‑only categories never escalate beyond the local tiers, and only the necessary context is sent.  The selected model returns structured text to populate downstream plan sections (rules, standards, workflows), expand projects, write documentation and generate agent instructions.  All remote calls are scoped and logged.

### 3. **Plan & Project Store**

* **Database** –  A local SQLite database stores metadata about plans, projects, files, classification results and user actions.  This ensures that the UI can be responsive even when large numbers of items exist, and allows undo/redo of organisational actions.
* **`.bryon` Folder** –  Every plan or project has a corresponding directory in the workspace.  Within this directory, Bryon maintains persistent context:
  - `plan/` – Contains markdown files for each 10‑series section (100‑purpose.md, 200‑context.md, etc.).
  - `projects/` – Each project has its own folder with a summary, tasks, files and documentation.
  - `state/` – Tracks the current stage, decisions, known gaps and a changelog of checkpoints.
  - `agents/` – Holds agent instruction files for different models (.github/, .claude/, .gemini/ etc.).
  - `docs/` – Summaries and indexes of user‑facing and developer‑facing documentation.
  - `prompts/` – Stored prompt templates for common operations (e.g. generating a new issue, updating agent files).

### 4. **User Interface**

The UI is built with SvelteKit and designed to run as a local desktop application.  Major surfaces include:

* **Home / Command Centre** –  Provides an overview of active and proposed plans, recent checkpoints, connected models and quick actions (scan folder, create plan, sync workspace).
* **Plan Dashboard** –  Organises plans by lifecycle (e.g. proposed, drafting, active, archived).  Each plan card shows key metadata and health indicators.
* **Plan Workspace** –  A horizontal 10‑series layout where users can edit purpose, context, goals, rules, standards, tools, workflows, projects, actions and reviews.  Cards in downstream sections reference upstream context and show their inheritance trail.
* **Project Detail Page** –  Shows project summary, inherited plan context, tasks, files, docs, decisions and associated chat history.  Projects can be expanded from a one‑sentence description into a full plan when requested.
* **Folder Intake Review** –  Presents classification results, proposed plans/projects and file lists.  Users can approve, rename, exclude or mark items as sensitive before files are organised.
* **Workspace Sync View** –  Displays the state of the `.bryon` workspace (last checkpoint, changed files, stale docs, detected agent files) and offers actions like create checkpoint, refresh docs or audit agents.
* **Chat Surface** –  An assistant that uses the current plan/project context to answer questions, summarise sections, generate documentation and perform quick tasks.  Chat is treated as an execution surface rather than the primary way to organise work.
* **Settings** –  Allows users to configure the Ollama connection and per‑tier model tags (Gemma 4 small, Gemma 4 31B, Gemini 3 Flash via Ollama Cloud), optionally enable the direct Gemini API tier with a Pro key, set privacy rules (local‑only categories, folder permissions, tier‑3 disable switch) and customise general preferences.

### 5. **Command‑Line Interface**

Developers can invoke Bryon through a CLI to perform operations on the `.bryon` workspace without opening the UI.  Typical commands include:

* `bryon sync` –  Analyses the repository, updates documentation and agent files, refreshes indexes and writes a checkpoint.
* `bryon checkpoint "description"` –  Creates a named checkpoint capturing current plan/project state, decisions and context.
* `bryon audit` –  Scans for stale or conflicting context, unused files and missing agent instructions.

The CLI reads the same configuration and `.bryon` directory as the UI, ensuring consistency between the graphical and terminal workflows.

### 6. **Models & Providers**

Bryon uses a four‑tier stack. Tiers 1–3 share a single transport (the Ollama HTTP client); Tier 4 is an optional direct Gemini API integration.

* **Tier 1 — Gemma 4 (local, via Ollama)** –  Daily driver for classification, sensitivity detection and light summarisation. Never leaves the machine.
* **Tier 2 — Gemma 4 31B (local, via Ollama)** –  Heavier reasoning for plan section generation, project expansion and deep summarisation. Same Ollama instance as Tier 1; assumes the user has the hardware. Also never leaves the machine.
* **Tier 3 — Gemini 3 Flash Preview (via Ollama Cloud)** –  Reached through the Ollama client, but the request **does** leave the machine. Used when Tier 2 cannot comfortably handle the task. Available out‑of‑the‑box; no separate API key required.
* **Tier 4 — Gemini Pro (direct Gemini API, optional)** –  Off by default. Power users can paste a Gemini API key to unlock Pro for top‑end summarisation and plan generation.
* **Model Router** –  A thin abstraction that picks a tier per task based on task type, configured size caps and the user’s privacy settings. Local‑only categories never escalate beyond Tier 2. Additional providers can be plugged in via the same interface.

## Data Flow Summary

1. **User selects folders to watch or triggers a manual scan.**
2. **Folder Watcher** picks up new files and passes them to the **Local Classification Engine**.
3. The engine uses **local Gemma 4 (Tier 1)** to classify files and detect sensitive categories.  Classification results are stored and displayed in the **Folder Intake Review** UI.
4. The user reviews proposed plans and projects, approves or excludes items and decides how to organise the files.
5. Approved files are copied or moved into the workspace and assigned to plans/projects.  If summarisation or planning is requested, the **router** picks a tier: **local Gemma 4 31B (Tier 2)** by default, escalating to **Gemini 3 Flash via Ollama Cloud (Tier 3)** or **Gemini Pro via direct API (Tier 4, if enabled)** when the local tier cannot comfortably handle the task.  Local‑only categories never escalate beyond Tier 2.
6. The **Plan Builder** populates the 10‑series structure with available context.  Projects inherit from the plan and can be expanded into tasks.
7. The resulting plan/project context is saved to the **database** and written into the **`.bryon` folder**.  The UI and CLI read from these sources to present a consistent view.
8. Users can interact through the **Plan Workspace**, **Project pages**, the **Chat surface** or the **CLI**.  When changes occur, Bryon updates both the database and the `.bryon` files.
9. Periodically or after significant work, users run `bryon sync` or create a checkpoint to refresh documentation, update agent files and record progress.

This architecture ensures that Bryon remains responsive and privacy‑conscious while providing a coherent structure for human and AI collaboration.
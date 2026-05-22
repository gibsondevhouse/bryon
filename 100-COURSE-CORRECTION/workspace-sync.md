# Workspace Sync & `.bryon`

Bryon’s goal is not only to organise files and plans in the UI, but also to keep the underlying workspace on disk consistent and up to date.  This is accomplished through the **`.bryon` folder** and a small set of **command‑line utilities**.  This document explains the purpose of `.bryon`, the workspace sync view and the CLI commands that help maintain a healthy project.

## What is `.bryon`?

`/.bryon` is a hidden folder created in each Bryon workspace (for example, alongside your code repository).  It stores the persistent context, documentation, decisions and generated artifacts that make Bryon more than just a note‑taking tool.  Having this data on disk makes it easy to version control, review and share context with AI agents or other tools.

### Typical structure

```
.bryon/
├── plan/
│   ├── 100-purpose.md
│   ├── 200-context.md
│   ├── 300-goals.md
│   ├── 400-rules.md
│   ├── 500-standards.md
│   ├── 600-tools.md
│   ├── 700-workflows.md
│   ├── 800-projects.md (index of projects)
│   ├── 900-actions.md
│   └── 1000-review.md
├── projects/
│   ├── <project-name>/
│   │   ├── summary.md
│   │   ├── tasks.md
│   │   ├── decisions.md
│   │   ├── files/
│   │   └── docs/
│   └── ...
├── state/
│   ├── current-stage.md
│   ├── active-decisions.md
│   ├── known-gaps.md
│   ├── risks.md
│   └── changelog.md
├── agents/
│   ├── .github/
│   ├── .claude/
│   ├── .gemini/
│   ├── AGENTS.md
│   └── README.md
├── docs/
│   ├── user-docs-index.md
│   ├── dev-docs-index.md
│   └── stale-docs.md
├── workflows/
│   ├── post-phase-sync.md
│   ├── release-prep.md
│   ├── code-review.md
│   └── doc-refresh.md
├── prompts/
│   ├── generate-next-issue.md
│   ├── update-agent-files.md
│   ├── summarize-stage.md
│   └── run-doc-audit.md
└── checkpoints/
    ├── 2026-05-01T10-23-44Z.md
    ├── 2026-05-12T08-55-31Z.md
    └── ...
```

The `.bryon` folder is **human‑readable**.  Markdown files can be opened in any editor.  Agents working on the project will use these files to understand the current context and update their behaviour accordingly.

## Workspace Sync view

In the Bryon UI, the **Workspace Sync** view provides a dashboard for the `.bryon` folder.  It shows:

* **Last checkpoint** –  Timestamp and description of the last checkpoint created via the CLI or UI.
* **Changed files since last checkpoint** –  New, modified or deleted files in the workspace (including code, docs and `.bryon` contents).
* **Docs needing refresh** –  Lists of files that have changed but for which the corresponding documentation (e.g. user docs, dev docs, API refs) has not been regenerated.
* **Detected agent files** –  Presence of directories like `.github/`, `.claude/`, `.gemini/` and prompt files.  If required agent instructions are missing, the UI suggests generating them.
* **Stale context warnings** –  Cards highlighting outdated plan sections, rules that have been violated or decisions that conflict with current practice.

From this view, users can run common maintenance tasks (described below) via the UI.  These tasks update both the database and the `.bryon` folder.

## Command‑Line Interface

While the UI provides a polished experience for most users, developers and power users may prefer to run Bryon operations directly from the terminal.  The CLI uses the same underlying code as the UI.  In the polished release, at least the following commands must exist:

### `bryon sync`

Analyse the repository and `.bryon` folder, update documentation and agent files, refresh indexes and record a checkpoint.  Typical actions performed:

* Parse changed code and documentation files to update `docs/user-docs-index.md` and `docs/dev-docs-index.md`.
* Run summarisation through the router (local Gemma tiers, escalating to Gemini Flash via Ollama Cloud or Gemini Pro via direct API as needed) to refresh any changed plan or project sections.
* Regenerate agent instruction files in `agents/` based on the current plan context and provider requirements.
* Write or update `.bryon/state/changelog.md` with a summary of changes.

### `bryon checkpoint "<description>"`

Create a new checkpoint file under `.bryon/checkpoints/` containing:

* A human‑readable description supplied by the user.
* A snapshot of the current plan and project structure.
* A list of open tasks and decisions.
* A diff of changed files since the last checkpoint (optional).

Checkpoints enable developers to roll back changes, compare progress over time and feed a summary to AI agents before the next work session.

### `bryon audit`

Scan the workspace for potential issues and generate a report.  This may include:

* Outdated plan sections (e.g. goals past due dates).
* Rules that have been violated (e.g. a file escalated to a remote tier despite a “local‑only” rule).
* Documents that reference missing or moved files.
* Agent instruction files that are no longer aligned with the plan.

The audit command can be run automatically by CI pipelines or invoked manually.  It returns findings in both human‑readable and machine‑parseable formats.

## Required polish

To deliver a prosumer‑grade experience, the `.bryon` and workspace sync features must be:

* **Reliable** –  Commands should not corrupt the workspace, even if cancelled mid‑run.  Use temp files and backups.
* **Fast enough** –  Synchronising a large repository with hundreds of docs should complete within reasonable time.  Provide progress indicators.
* **Integratable** –  Expose CLI commands with predictable output so developers can hook them into scripts or CI pipelines.
* **Visually clear** –  The Workspace Sync view in the UI should present information in digestible sections, with clearly labeled actions and statuses.
* **Respectful of privacy** –  Show exactly which files and plan sections will be sent to a remote tier (Gemini Flash via Ollama Cloud or Gemini Pro via direct API) during sync.  Honour the user’s privacy settings.

## Summary

The `.bryon` folder and workspace sync functionality ensure that the structure Bryon creates is durable and usable outside the app.  They bridge the gap between plans/projects and the actual files and code on disk.  A polished release must treat this as a first‑class feature: easy to understand, safe to run and flexible enough for both casual users and power users.
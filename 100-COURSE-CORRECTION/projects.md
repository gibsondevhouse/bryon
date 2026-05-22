# Projects

Within a Bryon plan, **projects** represent discrete initiatives or work streams that contribute to the plan’s overall objectives.  Projects take the high‑level intent captured in the plan and break it down into actionable roadmaps, tasks and documentation.  This document explains how projects work, how they inherit context and how they should behave in a polished Bryon release.

## Purpose of projects

Projects answer the question: *“What pieces of work need to happen to achieve this plan’s goals?”*  They serve as intermediate containers between the broad goals of a plan and the granular tasks/actions tracked in the 900‑series.  Projects help users group related tasks, files and documentation, and provide a convenient unit for delegation or progress tracking.

## Creating a project

Projects can be created in several ways:

1. **From the Plan Workspace** –  Users click “Add Project” in the 800‑series and enter a one‑sentence description.  The description should be phrased as a desired outcome rather than a detailed specification (e.g. *“Design and implement the Planning UI”*).
2. **From Folder Intake** –  When scanning a folder, Bryon may detect a collection of files that warrant their own project (e.g. a set of lectures might become a “Study Plan” project).  These are proposed to the user along with the plan.
3. **From Chat** –  In the chat surface, the user might instruct Bryon to “create a project for API integration,” and the system will populate the plan’s 800‑series accordingly.

After a project is created, Bryon can expand it automatically (when requested) using the plan’s context. The router picks a tier based on task size: local **Gemma 4 31B** by default, escalating to **Gemini 3 Flash via Ollama Cloud** (or **Gemini Pro via direct API**, if enabled) only when the local tier cannot comfortably handle it.  The expansion produces a project summary, an ordered list of tasks and any initial documentation that the AI can infer from the plan and available files.

## Project structure

A project has its own internal structure, stored both in the database and in the `.bryon` folder.  Typical elements include:

* **Summary** –  A brief description of the project’s objective and how it relates to the plan’s goals.  This is displayed at the top of the Project Detail Page.
* **Inherited context** –  A snapshot of the plan’s relevant sections (purpose, goals, rules, standards, tools) at the time of project creation.  Bryon links these rather than copying them, so updates to the plan propagate downstream.
* **Tasks / Actions** –  A list of work items.  Each task can include a description, assignees (human or agent), due dates, status and references to upstream context.  Tasks live in the plan’s 900‑series but are grouped here for convenience.
* **Files** –  Files attached to the project.  These might be source documents, design assets, code, specifications or outputs produced during the project.
* **Documentation** –  Generated or hand‑written documents (e.g. technical specs, design docs, user guides).  Bryon can prompt the router‑selected tier to draft these from the context and existing files.
* **Decisions** –  Key decisions made during the project, including trade‑offs, selected architectures and reasons for choosing one option over another.  Recording decisions prevents re‑litigation and helps future agents understand why things were done a certain way.
* **Checkpoints** –  Links to checkpoints created via the CLI or UI, showing the state of the `.bryon` workspace at significant milestones.
* **Chat history** –  Conversations related to the project.  Chat messages are stored and summarised to keep project participants aligned.

In the `.bryon` folder, a project lives under `projects/<project-name>/`.  It has files like `summary.md`, `tasks.md`, `decisions.md`, and subdirectories for `files/` and `docs/`.

## Inheritance and updates

Projects inherit context from their parent plan.  This means that when generating prompts, writing code, drafting documentation or making decisions, the system uses the plan’s purpose, goals, rules, standards and tools as part of the input.  If the plan’s context changes (e.g. a new rule is added), Bryon flags the project and highlights the impacted tasks.  Users can then adjust tasks, documentation or future AI calls accordingly.

Projects also push information back to the plan.  When a project produces a decision or a lesson learned, it should contribute to the 1000 Review section of the plan.  When a project completes, its outcomes may update the plan’s goals or spawn follow‑on projects.

## Task expansion

Tasks can start as simple bullet points.  When deeper context is needed, Bryon can expand a task into a fuller outline with subtasks, estimated effort, dependencies and required resources.  For example:

```
Task: Build local document scrubber

Expanded subtasks:
1. Determine file formats to support (PDF, DOCX, TXT).
2. Write extractors for each format.
3. Integrate extractors into the classification pipeline.
4. Add tests for edge cases and large files.
5. Document the scrubber’s usage and limitations.
```

The expansion uses the plan context to enforce rules (e.g. “do not escalate sensitive content beyond the local Ollama tiers”) and standards (e.g. code style).  Users can accept, edit or discard expanded tasks.

## Project statuses

Projects can have statuses independent of their parent plan.  Suggested statuses include:

* **Proposed** –  Detected from folder intake but not yet approved.
* **Planned** –  Confirmed and outlined but no tasks started.
* **In Progress** –  Work is underway; tasks may be open or completed.
* **Blocked** –  Awaiting information, decisions or resources.
* **Completed** –  All tasks finished and deliverables produced.
* **Archived** –  No further work expected; retained for reference.

The UI should allow filtering and sorting projects by status.  Task and project statuses should roll up into the plan’s overall health indicators.

## Best practices

* **Keep projects focused** –  If a project becomes too large or diverse, split it into multiple projects.  Clear boundaries help the AI reason about context and make progress more tractable.
* **Write descriptive summaries** –  A strong project summary helps future readers (human or AI) quickly understand the objective and constraints.
* **Record decisions as you go** –  Don’t rely on memory.  Document important choices and their rationale as soon as they happen.
* **Use checkpoints** –  After major milestones, create a checkpoint to snapshot the current state.  This makes it easy to compare progress, roll back changes and generate after‑action reports.

## Summary

Projects are the workhorse of Bryon.  They give form to the broad goals of a plan and organise tasks, files and documentation into manageable units.  By enforcing context inheritance and encouraging clear documentation, Bryon’s project model reduces overhead and helps AI agents operate at a high level of accuracy.  A polished release must support creating and expanding projects, managing task lists, attaching files and docs, tracking decisions and statuses and keeping everything synced with the `.bryon` workspace.
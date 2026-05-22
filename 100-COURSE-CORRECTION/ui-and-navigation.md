# UI & Navigation

The user interface is where Bryon delivers its value to prosumers and teams.  A polished UI must be easy to navigate, visually appealing, responsive and provide clear feedback.  This document outlines the major surfaces in Bryon’s UI, describes typical user flows and notes the behaviour expected for each section.

## Application shell

Bryon runs as a desktop application, built with SvelteKit and packaged via Electron (or a similar framework).  The app shell provides:

* **Sidebar** –  Lists major sections (Home, Plans, Folder Intake, Workspace Sync, Settings).  It also displays the current workspace name and per‑tier model status (e.g. “Ollama: online · Gemma 4: ready · Gemma 4 31B: ready · Flash: reachable”, plus “Gemini Pro: connected” when the optional direct API tier is enabled).
* **Top bar / Command bar** –  Shows breadcrumbs for the current location (e.g. *Plans > Marketing Launch > Plan Workspace*), search, quick actions and a user menu.
* **Main content area** –  Hosts the currently active view (dashboard, plan workspace, project page, etc.).

Navigation should be keyboard accessible (e.g. Tab, arrow keys) and maintain state when switching between sections.

## Home / Command Centre

The home view provides an at‑a‑glance overview of Bryon’s current state:

* **Active plans** –  Cards or a list summarising each active plan with plan name, number of projects and tasks, health indicators (e.g. missing context, overdue actions).
* **Proposed plans** –  A list of plans awaiting user review.  Each entry should show its source (folder intake, chat command), a short description and an “Accept / Reject” button.
* **Recent checkpoints** –  A timeline or list of the most recent checkpoints created via the CLI or UI.
* **Model status & quick actions** –  Shows the health of each tier (local Ollama + Gemma models, Ollama Cloud Flash, optional Gemini Pro) and any recent errors.  Quick actions include “Scan folder,” “Create plan,” “Sync workspace,” “Open chat.”

This view is ideal for daily check‑ins: users can decide what to work on next or see where attention is needed.

## Plan Dashboard

This view organises all plans into columns by lifecycle state: **Proposed**, **Drafting**, **Active**, **Archived**.  Each plan card displays:

* The plan name and description.
* A progress indicator (e.g. number of completed projects vs. total).
* The number of projects, tasks and attached files.
* Indicators for missing context (e.g. if no rules are defined) or conflicting decisions.
* A last updated timestamp.

Users can drag plans between columns to change their state.  Clicking a plan opens its Plan Workspace.

## Plan Workspace

The heart of Bryon is the Plan Workspace.  It presents the plan’s 10‑series as horizontal columns.  Each column displays cards representing items in that series.  Key behaviours:

* **Scrolling** –  The workspace should scroll horizontally when there are more series than fit on the screen.  Vertical scrolling within a column should be independent so users can focus on a particular section.
* **Editing cards** –  Clicking a card opens an editor with the full text, metadata (e.g. applies to projects) and actions (lock, delete, duplicate).  Rich text editing and markdown preview should be supported.
* **Adding cards** –  At the bottom of each column, a call‑to‑action (e.g. “Add Goal”) prompts the user to add a new item.  Bryon can suggest content based on existing context or templates.
* **Downstream impact indicator** –  When editing or deleting a card, Bryon shows which projects and tasks will be affected.  Users can choose to propagate changes automatically or handle them manually.
* **Context weight toggles** –  For each card, users can specify whether it is always injected into prompts, conditionally injected (e.g. only for writing tasks) or never injected.  This helps control prompt size and relevance.

At the top of the workspace, breadcrumbs indicate the plan name and allow returning to the Plan Dashboard.

## Project Detail Page

Selecting a project from the 800‑series or from other navigation points opens the Project Detail Page.  Components include:

* **Header** –  Project name, description, status (Proposed, Planned, In Progress, Blocked, Completed, Archived) and quick actions (Edit, Archive, Delete).
* **Inherited context panel** –  Shows the relevant cards from the parent plan.  Users can click to view the full text or modify the context weights.
* **Tasks list** –  A list or Kanban board of tasks associated with the project.  Tasks display their description, status, assignee, due date and context injection status.  Users can add, edit, reorder or complete tasks here.
* **Files panel** –  Shows attached files with previews, categories and actions to open, download or detach.
* **Documentation panel** –  Lists generated docs (e.g. design specs, user guides) and supports editing or regenerating them via the AI.
* **Decisions & Checkpoints** –  Displays recorded decisions and links to checkpoints relevant to this project.
* **Chat context** –  A context summary used by the chat model when the user asks questions about the project.  This helps reduce prompt length.

## Folder Intake Review

The Folder Intake view appears when the user selects a directory to scan.  It should:

* Display detected categories and sensitivity flags as collapsible sections.
* Show proposed plans and projects in a list with editable names and descriptions.
* List files under each category with checkboxes.  Users can bulk select/deselect files or expand an individual file to see a preview (e.g. first page of a PDF).
* Provide toggles to mark categories or individual files as local‑only.
* Offer actions to rename or merge categories and plan suggestions.
* Show a summary of the chosen actions (e.g. “Create 2 plans, 5 projects, 42 files to organise”) and a confirmation button that triggers the organisation.

## Workspace Sync

In the Workspace Sync view, users see the status of the `.bryon` folder:

* A timeline of checkpoints with descriptions and timestamps.
* A diff or summary of changes since the last checkpoint.
* A list of stale documentation and missing agent files.
* Buttons to run `sync`, `checkpoint`, or `audit` operations.  Running these operations updates the view in real time.

This view also provides links to open the `.bryon` folder in a file manager or the terminal.

## Chat Surface

The chat interface is accessible from anywhere via a floating button or a dedicated sidebar tab.  Chat is an execution surface: the AI assistant can answer questions, generate summaries, create or update plan sections, draft documentation, expand tasks and suggest actions.  Behaviour:

* **Context awareness** –  When opened from a plan or project page, the chat model automatically receives the relevant context.  Users can see what context is injected in a side panel and toggle specific parts on or off.
* **History** –  Chat history is stored per plan/project.  Summaries of past conversations are available for reference.
* **Prompt library** –  Frequently used prompts (e.g. “Create after‑action report”) can be saved and inserted with one click.
* **Privacy indicator** –  If a reply requires escalating to a remote tier (Gemini Flash via Ollama Cloud, or Gemini Pro via the direct API), an icon or message warns the user.  Clicking it reveals the content that will be sent and asks for confirmation.

## Settings

The settings page groups configuration into logical sections:

* **Workspace** –  Choose the root folder, specify which folders are watched, manage `.bryon` location.
* **Models** –  Configure the Ollama base URL and per‑tier model tags (Gemma 4 small, Gemma 4 31B, Gemini 3 Flash via Ollama Cloud), optionally enable the direct Gemini API tier with a Pro key, and tune routing preferences and usage caps.
* **Privacy** –  Define local‑only categories, default preview and confirmation behaviour for tier‑3/4 (remote) calls, a tier‑3 disable switch for fully air‑gapped operation, and encryption preferences.
* **Appearance** –  Dark/light mode, accent colour, font size.
* **Advanced** –  CLI integration, file size limits, developer mode.

Changing model or privacy settings should immediately affect the behaviour of intake, plan building and AI calls.

## Polished UX considerations

A prosumer‑grade UI must go beyond basic functionality.  Ensure:

* **Performance** –  Lists and boards should virtualise content to handle hundreds of items without lag.
* **Feedback** –  Long operations (classification, summarisation) need progress indicators, estimated time remaining and the ability to cancel.
* **Undo/redo** –  Most actions in Bryon should be reversible.  Provide an undo stack for edits, moves and deletes.
* **Responsive layout** –  Support different screen sizes and allow resizing of panels.  Avoid content jumping unexpectedly.
* **Accessibility** –  Label elements properly, provide keyboard shortcuts and ensure contrast ratios meet WCAG standards.
* **Theme customisation** –  Allow users to choose dark/light mode and accent colours.  Respect system preferences by default.

## Summary

The UI is the face of Bryon.  A polished release requires a cohesive design across all views, consistent navigation patterns, clear feedback and responsiveness.  The surfaces described here—Home, Plan Dashboard, Plan Workspace, Project pages, Folder Intake, Workspace Sync, Chat and Settings—must work together seamlessly to support the product’s core value: turning messy work into organised plans and projects that humans and AI can act on.
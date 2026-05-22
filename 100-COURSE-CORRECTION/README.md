# Bryon: Local‑First Planning and Organization Workspace

Bryon is a **local‑first planning and organization workspace** that turns scattered files, notes, emails and project materials into clear plans, projects, documentation and tasks.  It is designed for prosumers and small teams who want AI‑powered organization without surrendering their data to an opaque cloud.  Bryon runs a tiered Ollama stack — local Gemma 4 (small) for private classification, local Gemma 4 31B for heavier reasoning, and Gemini 3 Flash Preview via Ollama Cloud when the local tiers cannot handle a task — with an optional direct Gemini API tier for power users who want top‑end quality.  The result is a polished, out‑of‑the‑box application that helps people and their AI agents operate from a shared context.

Unlike traditional “chat‑first” assistants, Bryon’s core value is **structured context**.  Plans define the organisation’s intent, rules and standards; projects inherit that context and break work into actionable units; a local `.bryon` folder keeps documentation and agent instructions in sync with the code and files on disk.  Chat is still present as an execution surface, but it sits downstream of a robust planning and organization system rather than replacing it.

## Who is Bryon for?

* **Prosumers** who juggle multiple personal or freelance projects and want to keep their files and tasks organised without hours of manual sorting.
* **Team leads** who need a shared planning surface that captures goals, rules and resources and keeps everyone (human or AI) aligned.
* **Developer power users** who want to integrate AI into their workflows while preserving offline privacy and controlling when context goes to the cloud.

## What makes Bryon polished?

Bryon is designed to be **prosumer‑grade**: it installs easily, feels reliable and polished, and provides meaningful value on day one.  At a high level, a polished Bryon release must include:

1. **Robust file intake and classification** – The app can watch local folders (e.g. Downloads, Desktop, project directories), use a local model to categorise files by theme and sensitivity and suggest corresponding plans and projects.  Users review and approve suggested items, keeping control over what gets organised and what stays private.

2. **Structured plans with downstream inheritance** – Plans capture purpose, context, goals, rules, standards, tools, workflows, projects, actions and reviews using a 10‑series structure.  Downstream projects and tasks automatically inherit the relevant context, so AI models and humans always operate from the same intent.

3. **Projects and tasks that expand from a single sentence** – Within a plan, users can create a project with a short description and Bryon will, when requested, expand it into a fuller roadmap, tasks and documentation using the plan’s upstream context.

4. **A living `.bryon` workspace** – Each plan and project writes context, decisions, documentation and agent instructions into a local `.bryon` folder.  Command‑line tools allow developers to sync documentation, create checkpoints, audit stale context and refresh agent files after each significant milestone.

5. **Thoughtful model integration** – Bryon routes through a tiered Ollama stack: **Gemma 4 (local)** for private scanning and classification, **Gemma 4 31B (local)** for deep summarisation and plan generation, and **Gemini 3 Flash Preview via Ollama Cloud** when neither local tier can handle the task.  Power users can optionally add a direct **Gemini API** key for the Pro model.  Clear privacy settings let users mark categories as local‑only so they never escalate beyond the local tiers.

6. **Comprehensive UI surfaces** – A polished release includes a Home/Command centre, a Plan dashboard with lifecycle columns, an individual Plan workspace with a horizontal 10‑series layout, a Project detail page, a Folder Intake review flow, a Workspace Sync view and settings for model connections and privacy.

7. **Stability, performance and UX polish** – The app must start quickly, handle large numbers of files without crashing, provide clear status indicators, support keyboard navigation and feel responsive across major desktop platforms.

The remainder of this documentation suite elaborates on each of these areas in detail.  It is intended as a guide for developers and contributors building the polished Bryon product.

## Documentation contents

* **`architecture.md`** – High‑level architecture and data flow for Bryon.
* **`plans.md`** – Definition of the plan structure, lifecycle and inheritance.
* **`projects.md`** – How projects and tasks work inside plans.
* **`folder-intake.md`** – How Bryon scans local folders, classifies files and proposes plans.
* **`workspace-sync.md`** – The `.bryon` folder, command‑line interface and workspace maintenance.
* **`model-settings.md`** – The four‑tier model stack (Gemma local, Gemma 31B local, Gemini Flash via Ollama Cloud, optional Gemini Pro via direct API), router policy, and privacy considerations.
* **`ui-and-navigation.md`** – A description of each major UI surface and user flow.
* **`features-polished.md`** – A checklist of capabilities required for an out‑of‑the‑box prosumer release.

Refer to these documents for deeper information on how Bryon is structured and what must be implemented before shipping a polished version.
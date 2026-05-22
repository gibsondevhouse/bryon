# Plans

A **plan** in Bryon is more than a list of tasks – it is a persistent container for organisational intent.  Plans capture the upstream context (purpose, goals, rules, standards and resources) that downstream projects and tasks rely on to stay aligned.  This document defines the plan structure, lifecycle and inheritance model used in the polished Bryon product.

## Plan structure: the 10‑series

Plans are organised into ten numbered sections inspired by military operational doctrine.  The numbers make it easy to reference a section and visually convey that context flows left‑to‑right (upstream to downstream).

| Series | Section name      | Purpose                                                                                      |
|------:|-------------------|----------------------------------------------------------------------------------------------|
| 100   | **Purpose**       | Define the mission statement, commander’s intent or high‑level problem you are solving.      |
| 200   | **Context**       | Summarise background information, constraints and situational awareness relevant to the plan. |
| 300   | **Goals**         | List measurable outcomes or objectives that signal success.                                    |
| 400   | **Rules**         | Record non‑negotiable boundaries (e.g. privacy constraints, data policies, legal requirements).|
| 500   | **Standards**     | Specify how work should be done (coding conventions, writing style, testing practices).       |
| 600   | **Tools & Sources** | Note authorised tools, files, databases and other resources available to carry out the plan. |
| 700   | **Workflows**     | Describe repeatable processes and checklists for moving work forward.                         |
| 800   | **Projects**      | Enumerate the major initiatives required to fulfil the plan’s purpose.                        |
| 900   | **Actions**       | Track near‑term tasks, decisions and assignments that roll up into projects.                 |
| 1000  | **Review**        | Capture after‑action reports, lessons learned and pointers for future improvements.          |

Each series is presented as a vertical column in the Plan Workspace UI.  Cards within the columns hold individual items (e.g. a goal, a rule, a workflow).  Users can add, edit, reorder or archive cards.  The numbering helps maintain order even as the plan evolves.

### Best practices for each section

* **100 Purpose** –  Keep this concise and inspiring.  It should answer “Why does this plan exist?”  For example, *“Help the marketing team deliver a brand‑aligned product launch across all channels by Q3.”*
* **200 Context** –  Provide only what downstream actors need to know.  Avoid dumping full documents; instead, link or attach them in **Tools & Sources**.  Capture current constraints (budget, timelines, technical limitations) here.
* **300 Goals** –  Write SMART goals (Specific, Measurable, Achievable, Relevant, Time‑bound).  Example: *“Create a website landing page that loads in <1s and converts >30% of visitors by August 1.”*
* **400 Rules** –  Translate organisational or legal requirements into clear directives.  Example: *“Sensitive medical documents must never leave the local machine; do not escalate beyond the local Ollama tiers for diagnosis.”*
* **500 Standards** –  Detail expectations for quality and style.  Examples: code formatting guidelines, writing tone, accessible design requirements.
* **600 Tools & Sources** –  List approved software, data stores, documents and APIs.  Indicate which are local‑only versus remote‑allowed (Gemini Flash via Ollama Cloud or, if enabled, Gemini Pro via direct API).
* **700 Workflows** –  Outline repeatable processes (e.g. “Intake → Summarise → Draft → Review → Publish”).  Link to templates or checklists where appropriate.
* **800 Projects** –  Projects are the downstream containers for actual work.  Each project inherits context from the plan and may contain multiple actions/tasks.  Projects can begin as a one‑sentence idea and be expanded by the system into a fuller outline.
* **900 Actions** –  Use this section for near‑term tasks, blockers, escalations and decisions.  Actions should reference the projects they support and may include due dates or owners.
* **1000 Review** –  After a plan phase or project completes, summarise what worked, what didn’t and what should change next time.  Bryon can help generate after‑action reports from chat logs and plan data.

## Plan lifecycle

Each plan moves through four lifecycle states.  The Plan Dashboard groups plans by these states to help users prioritise and see what needs attention.

1. **Proposed** –  Bryon has detected a potential plan from folder intake or user input, but the user has not yet confirmed it.  Proposed plans are shown in red.  Users can review and either accept, rename or discard them.
2. **Drafting** –  The plan has been accepted and basic sections are being fleshed out.  Users can add cards, request summaries, set goals and refine rules and standards.  Plans in drafting may show yellow indicators if key sections are missing.
3. **Active** –  The plan has all required upstream sections populated and one or more projects underway.  Active plans are shown in green.  Downstream actions should always be traceable back to active plans.
4. **Archived** –  The plan is complete or no longer relevant.  Archived plans can be hidden or kept for reference.  After‑action reports live here.

Transitions between states happen manually: the user decides when a plan is ready to move from proposed to drafting, from drafting to active, or to be archived.

## Context inheritance

One of Bryon’s strengths is that **projects and tasks inherit relevant context from their parent plan**.  This means that when an AI model is asked to generate code, documentation or analysis for a project, it receives not only the immediate task description but also the plan’s purpose, applicable rules and standards and any tools or workflows relevant to that request.

Inheritance works as follows:

* Each project automatically references the upstream cards from the plan.  For example, if a rule says “Do not escalate sensitive documents beyond the local Ollama tiers,” the router enforces that rule whenever an action under the project might trigger a Tier 3 (Flash) or Tier 4 (Pro) call.
* Users can choose context weights, indicating which sections are always injected (e.g. Purpose) and which are conditional (e.g. Writing standards only for documentation tasks).  Bryon handles the injection logic when generating prompts.
* When plan context changes (e.g. a new constraint is added), Bryon tracks which projects and tasks might be affected.  The Plan Workspace UI highlights impacted downstream items and suggests updates.

This inheritance model reduces prompt fatigue and ensures consistent execution across time.  Rather than rewriting context in every chat, the plan acts as a single source of truth for both humans and AI.

## Adding and editing cards

Users can add cards to any section via the Plan Workspace UI.  Bryon provides helpers to:

* **Generate summaries** –  For example, summarise a 20‑page PDF into the Context section using whichever tier the router selects (local Gemma 4 31B by default; escalating to Gemini Flash via Ollama Cloud, or Gemini Pro via direct API if enabled, when the document exceeds local capacity).
* **Insert templates** –  Common rules, standards and workflows can be inserted as starting points.
* **Link sources** –  Files from the workspace or external links can be associated with cards in Tools & Sources.
* **Mark stable** –  Cards can be marked as “locked,” signalling that changes require review.  This helps preserve doctrine once it has been vetted.
* **View downstream impact** –  When editing or deleting a card, Bryon displays a panel showing which projects and tasks will be affected.

## Summary

Plans are the backbone of Bryon.  They capture intent and constraints in a structured, persistent format.  A polished release must support creating, editing and navigating plans easily, manage lifecycle states, propagate context to projects and tasks and keep the plan in sync with the `.bryon` workspace.  By investing in a robust plan model, Bryon ensures that both humans and AI can work from a shared understanding of why the work matters and how it should be done.
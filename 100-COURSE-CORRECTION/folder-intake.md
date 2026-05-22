# Folder Intake

One of Bryon’s key capabilities is the ability to take a messy folder full of miscellaneous files and turn it into structured plans and projects.  This process is called **folder intake**.  It starts with local classification, continues with user review and ends with an organised workspace ready for planning.  This document describes how folder intake works and what must be implemented to make it polished.

## Why folder intake matters

People often have hundreds of unorganised files: downloaded PDFs, pictures, invoices, lecture notes, code archives, emails exported to `.eml`, and so on.  Sorting these by hand is tedious.  Bryon’s folder intake leverages AI to suggest structure while keeping the user in control.  This saves time, reduces chaos and gives AI agents a consistent starting point.

## Intake flow

1. **Select folder** –  In the Home/Command Centre or the Folder Intake view, the user selects one or more directories to scan.  Common choices include **Downloads**, **Documents**, **Desktop** or a specific project folder.

2. **Local scanning and classification** –  Bryon’s Folder Watcher enumerates files in the selected directories.  It sends the file paths and, where necessary, sampled contents to the **Local Classification Engine** (Gemma).  The engine returns:
   - A **category label** (e.g. “work emails”, “medical documents”, “lecture videos”, “source code”).
   - A **confidence score** indicating how certain it is about the label.
   - A **sensitivity flag** if the file appears to contain personally identifiable information (PII), medical information or other sensitive content.  Sensitive files are always processed locally and never escalated beyond the local Ollama tiers (Gemma 4 small / 31B).

3. **Grouping and plan suggestions** –  Bryon groups files by category and looks for patterns that suggest a plan.  For example, several PDFs of doctor’s orders and lab results might trigger a suggested “Healthcare” plan.  A mix of design assets and product requirements might suggest a “Launch Campaign” plan.  Each plan suggestion includes its own list of potential projects (e.g. “Track lab results”, “Schedule appointments”).

4. **User review** –  The Folder Intake Review UI presents:
   - A list of **detected categories** with counts and sensitivity flags.
   - **Suggested plans and projects** derived from the categories.
   - The underlying **files** with checkboxes to include or exclude them.
   - A **privacy mode** toggle for each category (local‑only vs. remote‑allowed).  If the user chooses local‑only, Bryon will never escalate those files past the local Ollama tiers — they will not be sent to Gemini 3 Flash via Ollama Cloud or to the optional direct Gemini API.
   - Fields to **rename or merge** categories and plan suggestions.

   Users can then:
   - Approve or reject each suggested plan.
   - Adjust project names and descriptions.
   - Exclude specific files from being organised (e.g. personal photos that should stay outside Bryon).
   - Choose whether to move files (deleting from the source) or copy them into the workspace.

5. **Organisation** –  When the user clicks “Organise,” Bryon creates plan and project folders under the workspace root, copies or moves approved files into them and records the classification results in the database.  It then constructs initial plan sections (Purpose, Context, Tools) from file metadata.  If deeper summarisation is requested, the router picks a tier: local **Gemma 4 31B** by default, escalating to **Gemini 3 Flash via Ollama Cloud** (or **Gemini Pro via direct API**, if the user has opted in) only when the local tier cannot comfortably handle the task and the content is not local‑only.

6. **Follow‑up suggestions** –  After the initial intake, Bryon may suggest follow‑up actions, such as drafting a treatment plan for medical documents or creating a study schedule for lecture notes.  These suggestions use the newly created plan and the files’ contents as context.

## Classification categories

The local classification engine should support a set of built‑in categories that cover most common file types:

* **Administrative** –  invoices, receipts, tax documents, insurance paperwork.
* **Medical** –  doctor’s orders, prescriptions, lab results.
* **Educational** –  lecture notes, assignments, syllabi.
* **Professional** –  work emails, meeting minutes, proposals, specs.
* **Software** –  source code, configuration files, design assets.
* **Media** –  photos, videos, audio recordings.
* **Personal** –  personal letters, journal entries, legal documents.
* **Unknown/Other** –  unrecognised formats or uncategorised items.

Each category can be refined further by the user, and new categories can be added in future versions.  The classification engine should be extensible so custom classifiers can be trained or imported.

## Privacy considerations

Privacy is built into the intake process:

* Files flagged as sensitive by the local model (e.g. medical, financial or legal documents) **never leave the machine**.  Summaries for these files are generated only on the local Ollama tiers (Gemma 4 small / 31B).
* The user can manually mark any category as **local‑only**, preventing files in that category from escalating beyond the local tiers.  This is important for compliance and personal comfort.
* Bryon logs which files are sent to a remote tier (Tier 3 Flash or Tier 4 Pro), along with the reason (e.g. summarisation).  Users can review this log in the Workspace Sync view.
* The UI should clearly indicate when content is about to leave the machine and request confirmation if necessary.

## Required polish

To ship folder intake as part of a prosumer release, the following must be implemented:

* **Reliable file scanning** –  Large directories should be scanned efficiently with progress indicators and the ability to pause or cancel.
* **Accurate classification** –  The local model must be trained or fine‑tuned enough to produce meaningful categories most of the time.  False positives should be minimal and sensitivity flags conservative.
* **Clear review UI** –  Users should feel confident about what they are approving.  The UI must be able to expand categories, show sample file previews and allow inclusion/exclusion at the file level.
* **Batch operations** –  Approving dozens of files and plans at once should be easy.  Provide “select all,” “deselect all” and filtering by file type or date.
* **Undo/redo** –  Users should be able to undo the organisation if they change their mind, either via an “undo” button or by restoring a checkpoint.
* **Folder permissions** –  Bryon must respect OS‑level permissions and not watch or modify folders the user has not granted access to.  If a folder becomes inaccessible, the app should fail gracefully.

## Summary

Folder intake transforms chaotic file dumps into organised plans and projects.  It leverages the local Ollama tiers for privacy‑preserving classification, gives users granular control over what to include and escalates to the remote tiers (Gemini Flash via Ollama Cloud, or optionally Gemini Pro via direct API) only when necessary.  A polished implementation will feel seamless: users select a folder, review intelligent suggestions and end up with an organised workspace ready for action.
# Bryon — Design Decisions

One question at a time. Answer each and we'll lock in that design choice.

---

# Question 1: Persona Injection Strategy

**What this resolves:** Whether the system prompt (Bryon's "personality") is stored once per chat or regenerated from a shared template every turn; affects DB queries, migrations, and persona editing.

## Technical phrasing

When a user loads a chat and starts a new message, does `PromptBuilder.build()` (§6 streaming design):
- **(A)** Fetch the `personas` row by `personaId`, pull `systemPrompt`, inject it fresh on every turn?
- **(B)** Store the full `systemPrompt` text as part of the first `system` role message in the `messages` table, so each chat is immutable even if the persona definition changes later?

## English phrasing

If you create a chat with Bryon's personality today, and next month you decide to tweak Bryon's tone and save it, should:
- **(A)** That old chat **automatically** reflect the new tone the next time you open it?
- **(B)** That old chat **stay frozen** with the tone it had when you created it, while only new chats use the updated tone?

## Pros and Cons

### Option A (Live persona, fetch on every turn)

**Pros:**
- Persona edits take effect immediately across all chats (useful for quick tweaks).
- Saves DB space (persona stored once, not repeated in every message).
- Simpler if you want a "Bryon" update to feel like a global change.

**Cons:**
- Old conversations can change tone unexpectedly, breaking reproducibility.
- If you delete a persona by accident, older chats reference a missing record (must add a migration).
- Harder to debug: "Why did my chat feel different last week?" — persona version wasn't captured.

### Option B (Immutable snapshot, stored in messages table)

**Pros:**
- Conversations are frozen in time — same tone every time you re-read them.
- Full audit trail: you can see exactly which persona version was active when.
- No orphan references if a persona is deleted.
- Persona history is explicit (can branch "Bryon v1" and "Bryon v2" for A/B testing).

**Cons:**
- Duplicates persona text in every chat's first message (minor DB bloat, ~300–600 bytes per chat).
- Persona updates don't propagate to old chats — you must manually re-snapshot if you want them to use the new version.
- Slightly more complex: first message role is always `system`, handled differently in migrations.

### Glossary

- **Persona**: The character/personality rules Bryon follows (e.g., "be concise, no filler").
- **System prompt**: The exact text instructions sent to the LLM that define the persona.
- **Immutable**: Cannot be changed after creation.
- **Reproducibility**: Getting the exact same response if you ask the same question twice.

---

**Your call?** (A) or (B)?

---

# Question 2: Context Trimming Strategy

**What this resolves:** How `PromptBuilder.build()` handles conversations that exceed the token budget; affects what gets shown in chat history and whether old turns disappear silently or with a warning.

## Technical phrasing

When a chat's messages exceed 75% of `num_ctx` (e.g., 6.1k of 8.1k with system prompt), do we:
- **(A)** **Slide the window**: drop the oldest user/assistant pair, keep adding recent turns until we hit the cap. Repeat every turn — old messages fall off the history silently.
- **(B)** **Soft cap + warn**: load all recent messages, but if they would exceed 75%, show a warning UI banner ("Context limit reached — earlier messages hidden") and do NOT drop them from the database. The full history is still searchable and exportable; only the LLM doesn't see the oldest parts.
- **(C)** **Summarize**: when we hit 75%, call the LLM to summarize the oldest N turns into 2–3 sentences, replace those N turns with a synthetic `system` message, and continue.

## English phrasing

If you have a long conversation (say, 50 messages), and the context window can only hold about 20 recent messages before running out of room, what should Bryon do?
- **(A)** **Silently drop old messages from what Bryon sees**, so Bryon only replies based on recent turns. (Old messages stay saved but Bryon forgets them.)
- **(B)** **Show you a warning** ("Context full") and keep all messages saved and searchable, but tell Bryon to only look at recent ones. (Full history always available for you to search or re-read.)
- **(C)** **Summarize old turns** automatically (e.g., "Early on you discussed X and Y") so Bryon remembers the gist without using up space.

## Pros and Cons

### Option A (Silent sliding window)

**Pros:**
- Dead simple — no warnings, no UI edge cases.
- LLM always sees the most recent context (freshest info).
- Minimal latency (no summarization call).

**Cons:**
- User has no idea Bryon can't see old messages — confusing if they reference something from turn 5 and Bryon acts like it never happened.
- No way to "force" Bryon to re-read the old part (you'd have to start a new chat).
- Bad UX for long research sessions where context matters.

### Option B (Soft cap + warning banner)

**Pros:**
- Transparent: user sees exactly when the limit is hit and why Bryon might miss early context.
- Full history remains searchable and exportable — no loss of data.
- User can explicitly ask Bryon to summarize or can create a new chat to reset context.
- Clean separation: browser always shows all messages, LLM sees a sliding window.

**Cons:**
- Warning banner adds UI clutter and might feel alarming.
- Doesn't solve the underlying problem — Bryon still forgets old context.
- More code paths to test (warning state, toggling context inclusion, etc.).

### Option C (Auto-summarize)

**Pros:**
- Bryon remembers the gist of old turns without spending context tokens on full messages.
- Feels seamless — the user doesn't have to manage it.
- Good for long research conversations.

**Cons:**
- Adds latency: every time we hit 75%, we pause to call the LLM (extra ~2–5s).
- Summarization quality is uneven — sometimes loses important detail.
- New failure mode: summarization LLM call fails → what do we do? Silently fallback to (A)? That's confusing.
- More state to track (which turns got summarized, when, version of summary, etc.).
- For v1, over-engineered — most chats won't hit the limit.

### Glossary

- **Context window**: The max tokens the LLM can see (e.g., 8192).
- **Token budget**: How many tokens we reserve (e.g., 1024 for the reply), leaving the rest for history + persona.
- **Soft cap**: A limit that triggers a warning but doesn't hard-block.
- **Sliding window**: Automatically dropping old messages as new ones arrive.
- **Summarize**: Condensing old messages into a shorter recap.

---

**Your call?** (A), (B), or (C)?

---

# Question 3: Multi-Tab Sync Behavior

**What this resolves:** Whether the same chat can be open in two browser tabs simultaneously and stay in sync; affects whether we need WebSockets, polling, BroadcastChannel, or none of the above.

## Technical phrasing

If a user opens `/chats/:id` in two tabs and sends a message in Tab A, should Tab B:
- **(A)** **No sync** — remain as-is. User doesn't see the new message in Tab B until they manually refresh or switch chats.
- **(B)** **Poll + BroadcastChannel** — Tab B polls the server every 3–5 seconds for new messages *if* it's focused, and tabs communicate via `BroadcastChannel` API so they stay in rough sync. Refresh not needed but there's a lag.
- **(C)** **WebSocket** — real-time bidirectional sync over WebSocket. Any message in any tab appears instantly in all tabs. Requires a persistent connection and more server code.

## English phrasing

If you have the same chat open in two browser tabs and type a message in one:
- **(A)** **The other tab stays frozen** — you have to click "refresh" or close/reopen it to see the new message.
- **(B)** **The other tab updates every few seconds** — a bit of a delay, but it catches up automatically without you doing anything.
- **(C)** **The other tab updates instantly** — the two tabs stay perfectly in sync, like magic.

## Pros and Cons

### Option A (No sync)

**Pros:**
- Zero extra code or infrastructure.
- User experience is predictable: "Bryon runs one-at-a-time; if you open two tabs, they don't interfere."
- Matches the "single-user, single-device" mental model.

**Cons:**
- Bad UX if user accidentally opens two tabs of the same chat. Confusion and data loss risk (user types in Tab A, doesn't see it in Tab B, types again in Tab B, then refreshes and loses the Tab B message).
- For power users who juggle tabs, feels clunky.

### Option B (Poll + BroadcastChannel)

**Pros:**
- Decent UX: auto-updates without refresh, tabs stay roughly in sync.
- `BroadcastChannel` is built-in; same-origin tabs can talk for free.
- Polling is low-friction — just a GET request every few seconds, no persistent connection.
- Simple server logic (no new endpoints, just use existing `/api/chats/:id/messages`).

**Cons:**
- 3–5 second lag is noticeable (not great for a real-time feel).
- Polling wastes requests if nothing changes (minor, but not zero).
- `BroadcastChannel` only works same-origin (tabs must be on same `localhost:5174` — true for us, but not portable).
- More client state to manage (polling timer, sync state, conflict resolution if user edits in both tabs mid-send).

### Option C (WebSocket)

**Pros:**
- Instant, true real-time sync.
- Feels premium and responsive.
- Scales well if we later add multi-user or multiplayer (though that's not v1).

**Cons:**
- Requires a persistent WebSocket connection (adds server load, connection pooling, etc.).
- If user opens 5 tabs, that's 5 WebSocket connections just to see the same chat. Wasteful.
- New failure mode: connection drops → do we auto-reconnect? What's the UX? Stale data until reconnect?
- Complexity for v1: new code paths, error handling, heartbeat logic.
- SvelteKit SSE is cleaner for one-way streaming; WebSocket is more overhead.

### Glossary

- **BroadcastChannel**: A browser API allowing same-origin tabs/windows to send messages to each other.
- **Polling**: Repeatedly asking the server "what's new?" every N seconds.
- **WebSocket**: A persistent, two-way connection between browser and server.
- **Same-origin**: Tabs/windows on the same protocol, domain, and port (e.g., all on `localhost:5174`).

---

**Your call?** (A), (B), or (C)?

---

# Question 4: Message History — Read-Only or Editable?

**What this resolves:** Whether users can edit or delete their own messages in chat history; affects UI surface (edit/delete buttons), data model (soft deletes, version history), and API endpoints.

## Technical phrasing

Once a user message is sent and persisted in the `messages` table, should:
- **(A)** **Read-only history** — messages are immutable after creation. No edit or delete. Full history is a permanent record.
- **(B)** **Edit + delete** — users can edit any of their messages (user role only, not assistant). Edited messages show a `(edited)` indicator. Deletion is soft (mark as deleted) or hard (cascade, but keep references clean). Assistant messages are always immutable.
- **(C)** **Delete only** — users can delete their own messages, but not edit. Deleted messages are soft-deleted (marked, but data is kept for recovery).

## English phrasing

After you send a message to Bryon:
- **(A)** **It's locked forever** — you can read it, search it, export it, but you can't change or remove it.
- **(B)** **You can fix it or remove it** — if you made a typo, you can edit it and re-send, or delete it entirely. Bryon sees that the message changed (`edited` tag).
- **(C)** **You can remove it** — delete it if you want, but you can't fix it after the fact.

## Pros and Cons

### Option A (Read-only)

**Pros:**
- Data integrity: perfect audit trail, no versioning overhead.
- Simplest implementation: no edit UI, no soft-delete logic, no API endpoints for PATCH/DELETE.
- Immutability matches "logs as the source of truth" pattern.

**Cons:**
- User UX friction: typos or mistakes can't be fixed, only worked around.
- Not intuitive: most chat apps (ChatGPT, Claude, etc.) allow editing.
- Data bloat: if a user types a long message by mistake, they have to write a new one; both stay forever.

### Option B (Edit + delete)

**Pros:**
- Expected UX: matches modern chat apps.
- Typo recovery: users can fix mistakes inline.
- Cleaner chat flow: accidental messages can be removed entirely.

**Cons:**
- Implementation complexity: need edit UI, version tracking (or just show current + `(edited)` tag), API endpoints, potential race conditions (user edits while assistant is replying).
- Data model complexity: soft deletes, cascading references, cleanup logic.
- Reprompting: if user edits their message mid-conversation, do we auto-regenerate the assistant's next reply? Or leave it stale? Needs UX clarity.
- Audit concerns: edited messages lose the original text (unless we version them, which adds DB bloat).

### Option C (Delete only)

**Pros:**
- Middle ground: fixes the accidental-send problem without edit complexity.
- Simpler than (B): just soft-delete, no versioning or reprompting logic.
- Still allows data recovery: deleted messages are marked but preserved.

**Cons:**
- Typo fixes still require a new message: less ergonomic than (B).
- Confusing if delete is soft: user sees "delete", expects it gone, but it's still in the DB and might appear in exports or recovery.
- Partial solution: doesn't address the full "fix my mistake" UX.

### Glossary

- **Soft delete**: Mark a record as deleted in the DB, but keep the data (e.g., `deleted_at` timestamp). Used for recovery and audit trails.
- **Hard delete**: Permanently remove the record (cascade, referential integrity).
- **Immutable**: Cannot be changed after creation.
- **Audit trail**: A complete record of all changes and who made them, in order.
- **Reprompting**: Regenerating a reply based on edited input (re-running the LLM).

---

**Your call?** (A), (B), or (C)?

---

# Question 5: Styling Framework

**What this resolves:** How to write CSS for the UI; affects dev workflow, bundle size, component UX consistency, and maintenance burden.

## Technical phrasing

For styling the Svelte components in `lib/ui/`, should we:
- **(A)** **Tailwind CSS v4** — use the full utility-first framework. Classes like `flex`, `p-4`, `text-sm` in component markup, plus a `tailwind.config.ts` for theming.
- **(B)** **Plain CSS + custom utilities** — hand-write CSS in `.css` files and a small utility set (e.g., `~50 custom classes` for common patterns like `.flex-center`, `.text-muted`). No framework dependency.
- **(C)** **CSS-in-JS (e.g., Svelte's built-in `<style>`)** — write scoped styles directly in each `.svelte` file; no global utility layer or separate CSS files.
- **(D)** **Component Library (shadcn-svelte or Skeleton) + Tailwind** — use pre-built, accessible components (buttons, modals, inputs, etc.), copy-paste into repo, customize with Tailwind for one-offs.

## English phrasing

When building a chat UI:
- **(A)** Build buttons, inputs, modals from scratch using Tailwind utility classes.
- **(B)** Build buttons, inputs, modals from scratch using hand-written CSS + your own utility set.
- **(C)** Build buttons, inputs, modals from scratch with scoped styles in each component.
- **(D)** Copy pre-built, tested components (shadcn-svelte) into your repo, style them with Tailwind tweaks as needed.

## Pros and Cons

### Option A (Tailwind v4)

**Pros:**
- Huge ecosystem and docs. Most developers know it.
- Fast dev experience: change a class, see the change instantly.
- Automatic tree-shaking — final bundle is small.
- Built-in theming, dark mode, responsive breakpoints.
- Full control over every pixel.

**Cons:**
- Learning curve; markup gets verbose.
- Adds a build step and dependency.
- Over-engineered for v1.

### Option B (Plain CSS + utilities)

**Pros:**
- Zero dependencies; no build step beyond SvelteKit.
- Readable markup; full control.
- Slightly smaller bundle.

**Cons:**
- Manual consistency; need solid design system upfront.
- Slower dev cycle (write CSS, go back, iterate).
- Single developer can forget utility names or be inconsistent.

### Option C (Scoped styles in Svelte)

**Pros:**
- Component-first; style lives with component.
- SvelteKit native; no extra tooling.

**Cons:**
- CSS duplication bloat (every button has identical `<style>`).
- Hard to enforce consistency.
- Painful global theme changes.

### Option D (Component Library + Tailwind)

**Pros:**
- **Fastest path to v1**: pre-built buttons, inputs, modals, dialogs, dropdowns (all accessible).
- **Consistency out of the box**: components are designed to work together.
- **Customizable**: copy into repo, own the code, tweak as needed (not a black box).
- **Battle-tested**: shadcn-svelte used in production apps, Skeleton is Svelte-native.
- **Tailwind underneath**: easy to override/extend with utility tweaks.
- **Developer speed**: focus on chat logic, not building form components.

**Cons:**
- Initial setup learning curve (understanding component structure).
- Slight bundle bloat (but tree-shaken, not huge).
- Dependency on shadcn-svelte or Skeleton; community support (usually good).
- Less "from-scratch" control (but 90% customizable).

### Glossary

- **Component Library**: Pre-built, reusable UI components (buttons, modals, inputs, etc.) with built-in accessibility.
- **shadcn-svelte**: Port of shadcn/ui to Svelte; copy-paste components into your repo (not a npm package).
- **Skeleton**: Svelte-native component library, fully featured, alternative to shadcn-svelte.
- **Utility-first**: Composing designs by applying small, single-purpose classes (vs. semantic classes).
- **Tree-shaking**: Removing unused code to reduce bundle size.

---

## ✓ Decision: Option D (shadcn-svelte + Tailwind v4)

**Locked.** Bryon will use **shadcn-svelte** for pre-built, accessible components (buttons, modals, inputs, dialogs, dropdowns) and **Tailwind CSS v4** for utility tweaks and custom styling.

**Rationale:**
- Fastest path to v1: component library eliminates boilerplate.
- Consistency out of the box; components are battle-tested.
- Fully customizable: copy components into `lib/ui/`, own the code.
- Tailwind underneath: easy to override for one-offs.
- Focus dev effort on chat logic, not form building.

**Integration points:**
- Install shadcn-svelte components as needed (`button.svelte`, `input.svelte`, `dialog.svelte`, etc.) into `src/lib/ui/components/`.
- Configure Tailwind v4 in `tailwind.config.ts` for theme and utility extensions.
- Layer custom Tailwind classes for Bryon-specific styles (e.g., chat bubbles, message containers).
- No additional dependencies beyond shadcn-svelte + Tailwind; tree-shaking keeps bundle lean.

**Next steps:**
1. Initialize SvelteKit project.
2. Install shadcn-svelte CLI.
3. Pull in required components (Button, Input, Dialog, Card, ScrollArea, etc.).
4. Configure Tailwind v4 for theming.

# Model Settings

Bryon relies on AI models for classification, summarisation and plan generation. Rather than baking in a single backend, Bryon routes tasks across a **tiered stack of models, all reached through Ollama**, with an optional direct Gemini API tier for power users. This document describes the tiers, how the model router chooses between them and what privacy controls exist.

## The model stack

Bryon ships with a four‑tier stack. The first three tiers are all served through the local **Ollama** runtime (Ollama Cloud is part of the Ollama client, not a separate provider Bryon has to integrate). The fourth tier is opt‑in.

| Tier | Model | Where it runs | Used for |
| --- | --- | --- | --- |
| 1 | **Gemma 4 (small)** | Local Ollama | File classification, sensitivity detection, quick lookups, light summarisation. The default daily driver. |
| 2 | **Gemma 4 31B** | Local Ollama (same instance) | Deep summarisation, plan section generation, project expansion, agent‑instruction generation when local hardware is sufficient. |
| 3 | **Gemini 3 Flash Preview** | Ollama Cloud (built into the Ollama client) | Tasks the local 31B cannot comfortably handle — long‑context summarisation, multi‑document synthesis, high‑quality plan drafts. Available out‑of‑the‑box; no separate API key. |
| 4 | **Gemini 2.5/3 Pro** *(optional)* | Direct Gemini API | Power‑user tier for the highest‑quality output. Off by default. Requires the user to supply a Gemini API key. |

Because tiers 1–3 share a single transport (Ollama’s HTTP API), Bryon needs only **two backend integrations**: an Ollama client (covering local + Ollama Cloud models) and an optional Gemini API client (tier 4 only).

## Tier 1 & 2: Local Ollama (Gemma 4 / Gemma 4 31B)

Bryon assumes a running local Ollama instance and pulls down both Gemma sizes. The user is expected to have hardware capable of serving the 31B model alongside the small one.

### Installation

On first launch Bryon checks for Ollama and the required models. If anything is missing it offers a guided setup:

```sh
# 1. Install Ollama (https://ollama.com)
# 2. Pull both Gemma sizes
ollama pull gemma4:e4b      # small, daily driver
ollama pull gemma4:31b      # heavier reasoning
# 3. Start Bryon — it will detect both models on http://127.0.0.1:11434
```

Bryon talks to Ollama over HTTP. If Ollama is not running, the app surfaces a clear error with a “Start Ollama” shortcut and disables actions that require an LLM. If only the small model is installed, Bryon still works — heavier tasks transparently fall through to Tier 3.

### Configuration

In **Settings → Models** the user can:

* Override the Ollama base URL (defaults to `http://127.0.0.1:11434`).
* Pick the exact model tag for each tier (e.g. `gemma4:e4b`, `gemma4:31b`).
* Adjust per‑tier generation parameters (`temperature`, `top_p`, `num_ctx`, `num_predict`, `keep_alive`).
* Set a **maximum input size** (tokens or KB) above which Tier 1 stops trying and the router escalates to Tier 2.

## Tier 3: Gemini 3 Flash Preview via Ollama Cloud

Ollama Cloud exposes Gemini 3 Flash Preview through the same Ollama client used for local models. Bryon treats it as just another model tag served by the Ollama backend, so no separate provider configuration is required for the polished out‑of‑the‑box experience.

* **Trigger** — The router escalates to Tier 3 when a task is *task‑type* heavy (deep summarisation, plan generation, multi‑document synthesis) and Tier 2 is unavailable, overloaded, or has been disabled by the user.
* **Privacy boundary** — Although Gemini 3 Flash is reached through Ollama, **the request still leaves the machine**. Bryon must treat Tier 3 as a remote tier for privacy purposes: local‑only categories never escalate to it.
* **Settings** — A toggle in **Settings → Models → Cloud tier** can disable Tier 3 entirely. When disabled, tasks that would have escalated either fall back to Tier 2 (with a warning if quality may suffer) or block with a clear message.

## Tier 4 (optional): Gemini Pro via direct API

For users who want the strongest model for plan generation and agent authoring, Bryon supports a direct Gemini API integration. This tier is **off by default** and requires explicit setup:

1. **Settings → Models → Gemini Pro (direct API)** — toggle on.
2. Paste a Gemini API key (stored in the OS keychain, never in plain config files).
3. Test the connection with a sample prompt.
4. Optionally set token / spend caps.

When enabled, Tier 4 replaces Tier 3 as the destination for high‑end tasks unless the user explicitly pins a task to Flash. All Tier 4 calls are logged with route, token counts, and cost.

If the user does not configure Tier 4, Bryon operates fully on tiers 1–3 with no degradation in core functionality.

## Model router

The **model router** is a thin layer that picks a tier per task. Routing is **task‑type driven** and respects privacy rules. The default policy:

| Task | Default tier | Notes |
| --- | --- | --- |
| File classification & sensitivity detection | **Tier 1** | Always local. Never escalates. |
| Quick chat replies, slash commands, metadata extraction | **Tier 1** | Falls through to Tier 2 only on failure. |
| Light summarisation of small documents | **Tier 1 → Tier 2** | Tier 2 if input exceeds the configured size cap. |
| Deep summarisation, plan section generation, project expansion | **Tier 2 → Tier 3** | Stays at Tier 2 when local hardware is sufficient; escalates to Tier 3 for very long contexts or when Tier 2 is unavailable. |
| Documentation refresh, agent instruction generation | **Tier 2 → Tier 3** | Same escalation as above. |
| Anything explicitly marked “highest quality” by the user | **Tier 4** if enabled, otherwise Tier 3 | Opt‑in per action. |
| Any task touching a **local‑only** category | **Tier 1 or Tier 2 only** | Never leaves the machine, regardless of task. |

The router is transparent: every action shows which tier handled it (a small badge in the UI and an entry in the activity log). Users can override the default per task or pin a tier per plan in Plan Settings.

## Privacy and trust

Bryon is local‑first, but tiers 3 and 4 send data to remote services. The contract is explicit:

* **Local‑only categories** (Folder Intake & Plan Settings) — never escalate beyond Tier 2. The router refuses to route tier‑3/4 calls that would include local‑only content and surfaces a clear explanation.
* **Preview before remote send** — for large or sensitive‑adjacent payloads, Bryon shows the exact text that will be sent to Tier 3/4 and lets the user redact or cancel.
* **Routing log** — the Workspace Sync view records, per call: timestamp, task, tier used, input/output token counts, and (for Tier 4) cost.
* **Tier‑3 disable switch** — users who want fully air‑gapped operation can disable Tier 3, leaving only the local Ollama tiers active.
* **Credentials** — the Tier 4 API key is stored in the OS keychain, never in `~/.config/bryon/config.toml`.

## Extending with additional providers

The polished release includes clean abstraction layers so future providers (Claude, OpenAI, Perplexity, additional local models, alternate Ollama Cloud models) can be added without rewriting the router. Key requirements for any new provider:

* Declare its **capabilities** (classification, summarisation, generation, vision) and **context window**.
* Declare whether it is **local** or **remote** (this drives privacy enforcement).
* Handle authentication, retries, rate limiting, and error shapes internally.
* Plug into the router by registering for one or more task types and a tier slot.

## Summary

Model settings boil down to two ideas: **everything goes through Ollama by default**, and **escalation is task‑driven, not size‑guessed**. Tier 1 (local Gemma small) handles classification and quick work; Tier 2 (local Gemma 31B) handles real reasoning; Tier 3 (Gemini 3 Flash via Ollama Cloud) handles whatever exceeds local capacity; Tier 4 (direct Gemini Pro) is the optional ceiling for power users. Privacy boundaries are enforced at the router, not bolted on after the fact.

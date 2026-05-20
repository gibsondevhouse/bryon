# Bryon

Local AI chat client built with SvelteKit. Bryon runs on one machine and talks to a local Ollama instance, with optional free web lookup from the server.

## Prerequisites

```sh
ollama serve
ollama pull gemma4:e4b         # Bryon v1 is locked to Gemma 4
```

## Local Development

```sh
pnpm install
pnpm dev
```

Default app URL: `http://127.0.0.1:5174`

## V1 Scope

V1 is a focused rich-chat app:

- Streaming local Ollama chat
- Photo uploads routed to the configured vision model
- Document uploads attached to a chat turn: PDF, TXT, MD, HTML, DOCX, XLSX, PPTX
- Explicit web lookup from the composer
- Settings-managed memory: “Remember” and “Never suggest”
- Local chat history, message search, markdown/code rendering, export, and model pinning

V1 intentionally does **not** include projects, domain personas, model-controlled tools, reusable document libraries, or editable prompt libraries.

## V1.5 Target

V1.5 is the project layer:

- Project-scoped chats and files
- Project prompts and reusable prompt presets
- Richer memory editing with project/global scope
- Reusable project knowledge search/RAG

## Local Quality Gate

```sh
pnpm gate
```

`pnpm gate` runs:

- `pnpm lint`
- `pnpm check`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

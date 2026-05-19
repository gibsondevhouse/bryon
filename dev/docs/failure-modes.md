# Bryon — Failure Modes

No silent failures, no cryptic errors, no data loss.

## Ollama Unreachable At Boot

- Server logs a warning and continues booting.
- `/api/health` returns `ollama: false`.
- UI shows the health banner and disables sending until retry succeeds.

## Chat Model Not Found

- Streaming emits `event: error` with `code: MODEL_NOT_FOUND` and the model name.
- UI shows an inline retryable error with `ollama pull <model>`.
- No assistant message is persisted if the stream never opened cleanly.

## Vision Model Not Capable Or Missing

- If image attachments are present, the stream route selects `[llm].vision_model`.
- If that model is not vision-capable, the server returns `MODEL_NOT_VISION` before saving the user message.
- UI tells the user to configure a vision-capable model in Settings.

## Ollama Interrupted Mid-stream

- Server emits `STREAM_INTERRUPTED`.
- Partial assistant content is persisted with `ms_total = null`.
- UI renders the partial response and offers Retry.

## User Cancels Stream

- Client abort is forwarded to Ollama.
- Partial assistant content is persisted with `ms_total = null`.
- UI marks the response cancelled and re-enables composer.

## Config Parse Error

- Server logs the TOML parse error.
- Built-in defaults are used.
- Settings endpoint returns the parse error so UI can surface it.

## DB Migration Or Write Failure

- Migration failures are fatal at boot.
- Runtime write failures return structured HTTP/SSE errors and are logged.
- Server should not crash for endpoint-level write failures.

## Upload Too Large

- `POST /api/chats/:id/uploads` rejects files over 25 MB or message totals over 100 MB.
- Nothing is written after validation failure.
- UI shows an inline upload error.

## Unsupported Upload Type

- Upload route returns `UNSUPPORTED_MEDIA_TYPE`.
- Accepted v1 types: PNG, JPEG, WebP, PDF, TXT, MD, HTML, DOCX, XLSX, PPTX.

## Document Extraction Failure

- Upload route returns `UPLOAD_FAILED` with a clear extractor error.
- For Office files, the local `unzip` command must be available.
- The chat message is not sent until upload succeeds.

## Web Lookup Disabled

- If the composer web toggle is on but Settings disables web lookup, stream preflight returns `WEB_SEARCH_DISABLED`.
- UI tells the user to enable web lookup or send without it.

## Web Lookup Failed

- SearXNG failures fall back to DuckDuckGo Instant Answers when possible.
- If all lookup paths fail, stream preflight returns `WEB_SEARCH_FAILED` before saving the user message.

## Auto-summarization Failure

- Server falls back to sliding-window context for that turn.
- No failed summary is persisted.
- Failure is logged only.

## Unknown Slash Command

- UI shows an ephemeral composer error.
- The command is not persisted and is not sent to Ollama.

## General Principles

- Partial data beats no data after generation has started.
- Preflight failures should avoid persisting a user message.
- User-facing errors should include an action when possible.

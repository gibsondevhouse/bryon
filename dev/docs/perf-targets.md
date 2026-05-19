# Bryon — Performance Targets

Minimum acceptable numbers for v1 on a modern Mac running Ollama locally.

## Streaming & Response Speed

| Metric | Target | Notes |
|---|---|---|
| TTFT — warm model | < 500ms | Model already loaded |
| TTFT — cold start | < 4s | Ollama loads model fresh |
| Tokens per second | >= 20 tok/s | On a 4B class chat model |
| Stream cancel | < 300ms | User action to Ollama abort signal |
| Partial response persisted after cancel | < 200ms | Assistant row saved with `ms_total = null` |

## Rich Chat Inputs

| Metric | Target | Notes |
|---|---|---|
| Image upload save | < 300ms | Excludes model inference |
| Document upload save + extract | < 3s for typical docs | PDF/Office extraction is local and bounded |
| Web lookup preflight | < 5s | SearXNG or DuckDuckGo fallback before generation |
| Memory prompt injection | < 5ms | String assembly only |

## API & Data Layer

| Metric | Target | Notes |
|---|---|---|
| SQLite read | < 20ms | WAL mode |
| SQLite write | < 30ms | Single message transaction |
| FTS5 search query | < 100ms | 10k messages |
| Chat list load | < 50ms | Paged |
| App server boot | < 2s + warning if Ollama down | Server still starts |

## Not Targeted In V1

- Multi-user concurrency
- Project/RAG indexing throughput
- Sub-100ms TTFT
- Large-model performance guarantees

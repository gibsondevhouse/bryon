# Bryon — Slash Commands

Slash commands are intercepted client-side and are never sent to Ollama.

## v1 Commands

### `/new`
Creates a blank chat and navigates to it.

### `/clear`
Creates a new chat with the current chat model pin, leaving old history intact.

### `/model [name]`
Without args, shows the active model. With a model name, pins that model to the current chat. `/model reset` removes the chat pin and returns to `[llm].model`.

### `/export`
Downloads the current chat as Markdown.

### `/help`
Shows the command list.

## Removed From V1

- `/persona`: prompt/persona editing is deferred to v1.5 projects/prompt management.
- `/tools`: v1 does not expose model-controlled tools. Web lookup is an explicit composer toggle.

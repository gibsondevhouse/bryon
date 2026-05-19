// Models known to support image input via Ollama's `images` field.
const VISION_PATTERNS = [
	/^gemma3:/i,
	/^gemma4:/i,
	/^llava/i,
	/^moondream/i,
	/^minicpm-v/i,
	/^qwen-vl/i,
	/^phi3.*vision/i,
	/^bakllava/i,
];

export function isVisionCapable(model: string): boolean {
	return VISION_PATTERNS.some((p) => p.test(model));
}

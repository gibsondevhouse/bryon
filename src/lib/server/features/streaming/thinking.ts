/**
 * Thinking-mode classifier and depth helpers.
 *
 * ThinkingMode values and what they do:
 *
 *   off      → think: false — reasoning fully disabled
 *   auto     → think: true only when the heuristic detects a complex query
 *   light    → think: true always, with a "be concise" system prompt note
 *   normal   → think: true always, no depth instruction (model's default)
 *   extended → think: true always, with a "reason thoroughly" system prompt note
 */

export type ThinkingMode = 'off' | 'auto' | 'light' | 'normal' | 'extended';

// ── Heuristic patterns ──────────────────────────────────────────────────────

/** Whole-message social filler: greetings, acks, one-word replies. */
const CASUAL_RE =
	/^(?:hi+|hey+|hello+|howdy|sup|yo|bye+|goodbye|see\s+ya|cheers|thanks?|thank\s+you|thx|ty|ok+|okay|sure|yep|nope|yes|no|great|good|cool|nice|perfect|awesome|got\s+it|sounds\s+good|alright|makes?\s+sense|interesting|noted|lol|haha|wow|oh|ah|hmm+|hm+)[!?.,\s]*$/i;

/** Short social questions that need zero reasoning. */
const SOCIAL_Q_RE =
	/^(?:(?:(?:hi|hey|hello|good\s*(?:morning|afternoon|evening))[,\s]+)?(?:how\s+are\s+you(?:\s+doing)?|how'?s\s+it\s+going|how'?s\s+everything|what'?s\s+up|you\s+(?:good|ok(?:ay)?)|all\s+good|what\s+are\s+you\s+doing|how\s+have\s+you\s+been))[!?.,\s]*$/i;

/** Task-oriented verbs that signal real work is expected. */
const TASK_RE =
	/\b(?:explain|debug|fix|implement|write|create|build|analyze|analyse|compare|refactor|optimize|summarize|summarise|translate|solve|calculate|compute|prove|design|evaluate|review|generate|convert|migrate|parse|format|test|document|help\s+me|show\s+me|tell\s+me\s+(?:about|how|why|what))\b/i;

/**
 * Reasoning question starters — phrased in ways that actually require
 * inference, not just social phrasing ("how are you").
 */
const REASONING_Q_RE =
	/\b(?:why|how\s+(?:do|does|can|to|should|would|could|might)|what'?s\s+|what\s+(?:is|are|does|would|should|happens?|causes?|makes?|difference)|which\s+(?:is|should|would)|when\s+(?:do|does|should|would|is)|where\s+(?:is|do|does|should|would))\b/i;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns true if the model's chain-of-thought reasoning (`think: true`)
 * should be sent to Ollama for this message.
 */
export function resolveThinking(mode: ThinkingMode, content: string): boolean {
	switch (mode) {
		case 'off':
			return false;
		case 'auto':
			return classifyThinking(content);
		case 'light':
		case 'normal':
		case 'extended':
			return true;
	}
}

/**
 * Returns an optional system-prompt note that shapes reasoning *depth*.
 * Only non-null for `light` and `extended`; `normal` lets the model choose
 * naturally, and `off`/`auto` don't need a depth hint.
 */
export function thinkingDepthInstruction(mode: ThinkingMode): string | null {
	switch (mode) {
		case 'light':
			return 'Keep your reasoning brief — think through the essential steps only, then respond directly.';
		case 'extended':
			return 'Reason thoroughly and comprehensively before responding — explore multiple approaches, consider edge cases, and verify your conclusions.';
		default:
			return null;
	}
}

// ── Heuristic (used by "auto" mode) ─────────────────────────────────────────

/**
 * Heuristic classifier: should this message trigger reasoning at all?
 *
 * Rules (in priority order):
 *  1. Code blocks / inline code → always think
 *  2. Long messages (> 25 words / > 180 chars) → always think
 *  3. Pure greetings / acknowledgements → never think
 *  4. Social questions ("how are you?") → never think
 *  5. ≤ 6 words → think only if task verb or reasoning question detected
 *  6. 7–25 words → think if task verb, reasoning question, or "?" present
 */
export function classifyThinking(content: string): boolean {
	const trimmed = content.trim();
	const words = trimmed.split(/\s+/).filter(Boolean);

	if (/```|`[^`]{2,}`/.test(trimmed)) return true;
	if (words.length > 25 || trimmed.length > 180) return true;
	if (CASUAL_RE.test(trimmed)) return false;
	if (SOCIAL_Q_RE.test(trimmed)) return false;

	if (words.length <= 6) {
		return TASK_RE.test(trimmed) || REASONING_Q_RE.test(trimmed);
	}

	return TASK_RE.test(trimmed) || REASONING_Q_RE.test(trimmed) || trimmed.includes('?');
}

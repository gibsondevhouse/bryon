// Bryon v1 is locked to the Gemma 4 family. All Gemma 4 variants are natively
// multimodal per the model card, so vision capability == being Gemma 4.
const GEMMA4_PATTERN = /^gemma[-_]?4[:-]/i;

export function isVisionCapable(model: string): boolean {
	return isGemma4(model);
}

export function isGemma4(model: string): boolean {
	return GEMMA4_PATTERN.test(model.trim());
}

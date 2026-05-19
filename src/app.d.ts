// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Settings } from '$lib/shared/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			config: Settings;
			ollamaReachable: boolean;
			configParseError: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

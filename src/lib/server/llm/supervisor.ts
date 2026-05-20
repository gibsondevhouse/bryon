import { getLogger } from '../logger';

export type OllamaState = 'unknown' | 'ready' | 'unreachable';

export class OllamaSupervisor {
	private state: OllamaState = 'unknown';
	private baseUrl: string;
	private timeout: number = 2000;
	private checkInterval: NodeJS.Timeout | null = null;
	private backoffMs = 500;
	private readonly MAX_BACKOFF = 10000;
	private lastSuccessfulCheck = 0;
	private readonly HEARTBEAT_MS = 30000;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
	}

	getState(): OllamaState {
		return this.state;
	}

	start(): void {
		if (this.checkInterval) return;
		this.probe();
	}

	stop(): void {
		if (this.checkInterval) {
			clearTimeout(this.checkInterval);
			this.checkInterval = null;
		}
	}

	async probe(onDemand = false): Promise<boolean> {
		// If on-demand and we have a fresh successful check, skip
		if (onDemand && this.state === 'ready' && Date.now() - this.lastSuccessfulCheck < 5000) {
			return true;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.baseUrl}/api/tags`, {
				signal: controller.signal,
			});

			clearTimeout(timer);

			if (response.ok) {
				if (this.state !== 'ready') {
					getLogger().info({ baseUrl: this.baseUrl }, 'ollama.reachable');
				}
				this.state = 'ready';
				this.lastSuccessfulCheck = Date.now();
				this.backoffMs = 500; // Reset backoff
				this.scheduleNext(this.HEARTBEAT_MS);
				return true;
			}
			throw new Error(`Ollama returned HTTP ${response.status}`);
		} catch (error) {
			clearTimeout(timer);
			if (this.state !== 'unreachable') {
				getLogger().warn({ baseUrl: this.baseUrl, error }, 'ollama.unreachable');
			}
			this.state = 'unreachable';

			if (!onDemand) {
				this.scheduleNext(this.backoffMs);
				this.backoffMs = Math.min(this.backoffMs * 2, this.MAX_BACKOFF);
			}
			return false;
		}
	}

	private scheduleNext(ms: number): void {
		if (this.checkInterval) clearTimeout(this.checkInterval);
		this.checkInterval = setTimeout(() => this.probe(), ms);
	}
}

let instance: OllamaSupervisor | null = null;

export function getOllamaSupervisor(baseUrl?: string): OllamaSupervisor {
	if (!instance) {
		if (!baseUrl) throw new Error('OllamaSupervisor must be initialized with a baseUrl');
		instance = new OllamaSupervisor(baseUrl);
	}
	return instance;
}

import { STREAM_ERROR_CODE } from './shared/stream-events';

export type AppError = {
    id: string;
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    type: 'system' | 'turn';
};

class ErrorChannel {
    errors = $state<AppError[]>([]);

    push(error: Omit<AppError, 'id'>) {
        const id = Math.random().toString(36).slice(2);
        this.errors.push({ ...error, id });

        if (error.type === 'system') {
            setTimeout(() => {
                this.remove(id);
            }, 5000);
        }
    }

    remove(id: string) {
        this.errors = this.errors.filter(e => e.id !== id);
    }

    isSystemError(code: string): boolean {
        return code === STREAM_ERROR_CODE.OllamaError || code === 'OLLAMA_UNREACHABLE';
    }
}

export const errorChannel = new ErrorChannel();

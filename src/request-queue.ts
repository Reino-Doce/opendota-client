import { OpenDotaError } from './errors.js';

interface QueueOptions {
    readonly concurrency: number;
    readonly maximumQueued: number;
    readonly minimumIntervalMs: number;
    readonly now: () => number;
}

interface QueueJob<Value> {
    readonly signal: AbortSignal;
    readonly run: () => Promise<Value>;
    readonly resolve: (value: Value) => void;
    readonly reject: (error: unknown) => void;
    readonly onAbort: () => void;
    started: boolean;
}

export class RequestQueue {
    readonly #options: QueueOptions;
    readonly #pending: QueueJob<unknown>[] = [];
    readonly #active = new Set<QueueJob<unknown>>();
    #lastStartedAt: number | undefined;
    #timer: ReturnType<typeof setTimeout> | undefined;
    #closed = false;

    constructor(options: QueueOptions) {
        this.#options = options;
    }

    run<Value>(run: () => Promise<Value>, signal: AbortSignal): Promise<Value> {
        if (this.#closed) return Promise.reject(new OpenDotaError({ code: 'client-closed' }));
        if (signal.aborted) return Promise.reject(new OpenDotaError({ code: 'aborted' }));
        const nextStartAt = this.#lastStartedAt === undefined
            ? this.#options.now()
            : this.#lastStartedAt + this.#options.minimumIntervalMs;
        const canStartImmediately = this.#timer === undefined
            && this.#active.size < this.#options.concurrency
            && this.#options.now() >= nextStartAt;
        if (this.#pending.length >= this.#options.maximumQueued && !canStartImmediately) {
            return Promise.reject(new OpenDotaError({ code: 'queue-full' }));
        }

        return new Promise((resolve, reject) => {
            const job: QueueJob<Value> = {
                signal,
                run,
                resolve,
                reject,
                started: false,
                onAbort: () => this.#cancel(job as QueueJob<unknown>),
            };
            signal.addEventListener('abort', job.onAbort, { once: true });
            this.#pending.push(job as QueueJob<unknown>);
            this.#pump();
        });
    }

    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        if (this.#timer !== undefined) clearTimeout(this.#timer);
        this.#timer = undefined;
        for (const job of [...this.#pending, ...this.#active]) {
            job.signal.removeEventListener('abort', job.onAbort);
            job.reject(new OpenDotaError({ code: 'client-closed' }));
        }
        this.#pending.length = 0;
        this.#active.clear();
    }

    #cancel(job: QueueJob<unknown>): void {
        job.signal.removeEventListener('abort', job.onAbort);
        job.reject(new OpenDotaError({ code: 'aborted' }));
        if (job.started) return;
        const index = this.#pending.indexOf(job);
        if (index >= 0) this.#pending.splice(index, 1);
        this.#pump();
    }

    #pump(): void {
        if (this.#closed || this.#pending.length === 0 || this.#timer !== undefined) return;

        while (this.#active.size < this.#options.concurrency && this.#pending.length > 0) {
            const now = this.#options.now();
            const nextStartAt = this.#lastStartedAt === undefined
                ? now
                : this.#lastStartedAt + this.#options.minimumIntervalMs;
            const waitMs = Math.max(0, nextStartAt - now);
            if (waitMs > 0) {
                this.#timer = setTimeout(() => {
                    this.#timer = undefined;
                    this.#pump();
                }, waitMs);
                return;
            }

            const job = this.#pending.shift();
            if (!job) return;
            if (job.signal.aborted) {
                this.#cancel(job);
                continue;
            }

            job.started = true;
            this.#lastStartedAt = now;
            this.#active.add(job);
            void job.run().then(job.resolve, job.reject).finally(() => {
                job.signal.removeEventListener('abort', job.onAbort);
                this.#active.delete(job);
                this.#pump();
            });
        }
    }
}

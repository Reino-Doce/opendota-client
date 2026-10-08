import { createHash } from 'node:crypto';
import { OpenDotaError } from './errors.js';
import { parseLosslessJson } from './json.js';
import { runtimeOverrides } from './runtime-overrides.generated.js';
import { RequestQueue } from './request-queue.js';
import { apiContractVersion, supportedOperations } from './operations.generated.js';
import type {
    ClientOptions,
    HttpMethod,
    OpenDotaResult,
    RateLimitHeaders,
    RequestOptions,
    ResponseData,
    Route,
} from './types.js';

interface CacheEntry {
    readonly data: unknown;
    readonly fetchedAt: string;
    readonly rateLimit: RateLimitHeaders;
    readonly expiresAt: number;
}

interface SharedRequest {
    readonly controller: AbortController;
    readonly subscribers: Set<symbol>;
    promise: Promise<CacheEntry>;
    deadlineExpired: boolean;
    completed: boolean;
}

const defaultOptions = {
    baseUrl: 'https://api.opendota.com/api',
    maxConcurrency: 2,
    maxQueuedRequests: 64,
    minimumRequestIntervalMs: 1_100,
    attemptTimeoutMs: 10_000,
    requestDeadlineMs: 30_000,
    maxRetries: 2,
    retryBaseDelayMs: 250,
    cacheTtlMs: 0,
    maxCacheEntries: 256,
} as const;

const identityPathKeys = new Set([
    'account_id', 'included_account_id', 'excluded_account_id', 'match_id', 'match_seq_num', 'less_than_match_id',
    'steamid', 'steam_id', 'lobby_id', 'server_id', 'server_steam_id', 'game_server_id', 'watch_server_id',
    'team_id', 'league_id', 'leagueid',
]);
const transientStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);
const decimalIdArrayPaths = new Set<string>(runtimeOverrides.decimalIdArrayResponses);
const omitFalseQueryKeys = new Set<string>(runtimeOverrides.omitFalseQueryParameters);
const numericBooleanQueryKeys = new Set<string>(runtimeOverrides.numericBooleanQueryParameters);

function abortError(signal: AbortSignal, operationId: string, deadlineExpired: boolean): OpenDotaError {
    return new OpenDotaError({
        code: deadlineExpired ? 'timeout' : 'aborted',
        operationId,
    });
}

function identityValue(key: string, value: unknown): string | number | boolean | undefined {
    if (value === undefined || value === null) return undefined;
    if (omitFalseQueryKeys.has(key) && value === false) return undefined;
    if (key === 'turbo' && value === true) return 1;
    if (identityPathKeys.has(key)) {
        if (typeof value !== 'string' || !/^\d+$/.test(value)) {
            throw new OpenDotaError({ code: 'invalid-input' });
        }
        return value;
    }
    if (numericBooleanQueryKeys.has(key) && typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    throw new OpenDotaError({ code: 'invalid-input' });
}

function serializeQuery(query: Record<string, unknown>): URLSearchParams {
    const search = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
        if (Array.isArray(raw)) {
            for (const value of raw) {
                const serialized = identityValue(key, value);
                if (serialized !== undefined) search.append(key, String(serialized));
            }
            continue;
        }
        const serialized = identityValue(key, raw);
        if (serialized !== undefined) search.append(key, String(serialized));
    }
    return search;
}

function buildRoute(path: string, parameters: Record<string, unknown> | undefined): string {
    const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1] ?? '');
    const supplied = parameters ?? {};
    const stringPathParameters = new Set<string>(runtimeOverrides.stringPathParameters[path as keyof typeof runtimeOverrides.stringPathParameters] ?? []);
    if (placeholders.some((name) => !Object.hasOwn(supplied, name)) || Object.keys(supplied).some((name) => !placeholders.includes(name))) {
        throw new OpenDotaError({ code: 'invalid-input' });
    }
    return path.replaceAll(/\{([^}]+)\}/g, (_match, name: string) => {
        const raw = supplied[name];
        const value = stringPathParameters.has(name)
            ? typeof raw === 'string' ? raw : undefined
            : identityValue(name, raw);
        if (value === undefined) throw new OpenDotaError({ code: 'invalid-input' });
        return encodeURIComponent(String(value));
    });
}

function retryAfter(response: Response, now: number): number | undefined {
    const value = response.headers.get('retry-after');
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

function rateLimitHeaders(response: Response): RateLimitHeaders {
    const minute = response.headers.get('x-rate-limit-remaining-minute');
    const day = response.headers.get('x-rate-limit-remaining-day');
    return {
        ...(minute === null || !Number.isFinite(Number(minute)) ? {} : { minuteRemaining: Number(minute) }),
        ...(day === null || !Number.isFinite(Number(day)) ? {} : { dayRemaining: Number(day) }),
    };
}

function stableQueryKey(search: URLSearchParams): string {
    return [...search.entries()].map(([key, value], index) => ({ key, value, index }))
        .sort((left, right) => left.key.localeCompare(right.key) || left.index - right.index)
        .map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
}

function isTransient(error: unknown): boolean {
    if (error instanceof OpenDotaError) {
        return error.code === 'network-error' || error.code === 'timeout'
            || error.code === 'http-error' && error.status !== undefined && transientStatusCodes.has(error.status)
            || error.code === 'rate-limited';
    }
    return false;
}

export class OpenDotaClient {
    readonly #baseUrl: URL;
    readonly #apiKey: string | undefined;
    readonly #fetch: typeof fetch;
    readonly #now: () => number;
    readonly #sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
    readonly #random: () => number;
    readonly #attemptTimeoutMs: number;
    readonly #requestDeadlineMs: number;
    readonly #maxRetries: number;
    readonly #retryBaseDelayMs: number;
    readonly #cacheTtlMs: number;
    readonly #maxCacheEntries: number;
    readonly #queue: RequestQueue;
    readonly #inFlight = new Map<string, SharedRequest>();
    readonly #cache = new Map<string, CacheEntry>();
    readonly #controllers = new Set<AbortController>();
    #closed = false;

    constructor(options: ClientOptions = {}) {
        const base = options.baseUrl ?? defaultOptions.baseUrl;
        try {
            this.#baseUrl = new URL(base.endsWith('/') ? base : `${base}/`);
        } catch {
            throw new OpenDotaError({ code: 'invalid-url' });
        }
        if (!['https:', 'http:'].includes(this.#baseUrl.protocol) || this.#baseUrl.username || this.#baseUrl.password || this.#baseUrl.search || this.#baseUrl.hash) {
            throw new OpenDotaError({ code: 'invalid-url' });
        }
        this.#apiKey = options.apiKey;
        if (this.#apiKey !== undefined && this.#apiKey.trim().length === 0) throw new OpenDotaError({ code: 'invalid-input' });
        this.#fetch = options.fetchImpl ?? fetch;
        this.#now = options.now ?? Date.now;
        this.#sleep = options.sleep ?? sleep;
        this.#random = options.random ?? Math.random;
        this.#attemptTimeoutMs = options.attemptTimeoutMs ?? defaultOptions.attemptTimeoutMs;
        this.#requestDeadlineMs = options.requestDeadlineMs ?? defaultOptions.requestDeadlineMs;
        this.#maxRetries = options.maxRetries ?? defaultOptions.maxRetries;
        this.#retryBaseDelayMs = options.retryBaseDelayMs ?? defaultOptions.retryBaseDelayMs;
        this.#cacheTtlMs = options.cacheTtlMs ?? defaultOptions.cacheTtlMs;
        this.#maxCacheEntries = options.maxCacheEntries ?? defaultOptions.maxCacheEntries;
        for (const numeric of [this.#attemptTimeoutMs, this.#requestDeadlineMs, this.#maxRetries, this.#retryBaseDelayMs, this.#cacheTtlMs, this.#maxCacheEntries]) {
            if (!Number.isSafeInteger(numeric) || numeric < 0) throw new OpenDotaError({ code: 'invalid-input' });
        }
        for (const numeric of [options.maxConcurrency ?? defaultOptions.maxConcurrency, options.maxQueuedRequests ?? defaultOptions.maxQueuedRequests, options.minimumRequestIntervalMs ?? defaultOptions.minimumRequestIntervalMs]) {
            if (!Number.isSafeInteger(numeric) || numeric < 0) throw new OpenDotaError({ code: 'invalid-input' });
        }
        if ((options.maxConcurrency ?? defaultOptions.maxConcurrency) === 0) throw new OpenDotaError({ code: 'invalid-input' });
        this.#queue = new RequestQueue({
            concurrency: options.maxConcurrency ?? defaultOptions.maxConcurrency,
            maximumQueued: options.maxQueuedRequests ?? defaultOptions.maxQueuedRequests,
            minimumIntervalMs: options.minimumRequestIntervalMs ?? defaultOptions.minimumRequestIntervalMs,
            now: this.#now,
        });
    }

    get<const Path extends Route<'get'>>(
        path: Path,
        options: RequestOptions<Path, 'get'>,
    ): Promise<OpenDotaResult<ResponseData<Path, 'get'>>> {
        return this.#request('get', path, options as RequestOptions<Path, 'get'>);
    }

    post<const Path extends Route<'post'>>(
        path: Path,
        options: RequestOptions<Path, 'post'>,
    ): Promise<OpenDotaResult<ResponseData<Path, 'post'>>> {
        return this.#request('post', path, options as RequestOptions<Path, 'post'>);
    }

    clearCache(): void {
        this.#cache.clear();
    }

    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        for (const controller of this.#controllers) controller.abort();
        for (const request of this.#inFlight.values()) request.controller.abort();
        this.#queue.close();
        this.#cache.clear();
    }

    async #request<Path extends Route<Method>, Method extends HttpMethod>(
        method: Method,
        path: Path,
        options: RequestOptions<Path, Method>,
    ): Promise<OpenDotaResult<ResponseData<Path, Method>>> {
        if (this.#closed) throw new OpenDotaError({ code: 'client-closed' });
        if (options.signal?.aborted) throw new OpenDotaError({ code: 'aborted' });
        const route = buildRoute(path, options.path as Record<string, unknown> | undefined);
        const query = (options.query ?? {}) as Record<string, unknown>;
        for (const required of runtimeOverrides.requiredQueryParameters[path as keyof typeof runtimeOverrides.requiredQueryParameters] ?? []) {
            if (!Object.hasOwn(query, required) || query[required] === undefined || query[required] === null) {
                throw new OpenDotaError({ code: 'invalid-input' });
            }
        }
        const search = serializeQuery(query);
        const queryKey = stableQueryKey(search);
        const url = new URL(route.replace(/^\//, ''), this.#baseUrl);
        if (queryKey) url.search = queryKey;
        const operation = supportedOperations.find((entry) => entry.path === path && entry.method === method.toUpperCase());
        if (!operation) throw new OpenDotaError({ code: 'invalid-input' });
        const operationId = operation.operationId;

        if (method === 'post') {
            const controller = new AbortController();
            this.#controllers.add(controller);
            const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
            const deadlineTimer = setTimeout(() => controller.abort(), this.#requestDeadlineMs);
            try {
                const result = await this.#runWithRetries('post', url, operationId, path, signal);
                return this.#wrapResult(result, operationId, 'miss') as OpenDotaResult<ResponseData<Path, Method>>;
            } catch (error) {
                if (this.#closed) throw new OpenDotaError({ code: 'client-closed', operationId });
                if (controller.signal.aborted) throw new OpenDotaError({ code: 'timeout', operationId });
                throw error;
            } finally {
                clearTimeout(deadlineTimer);
                this.#controllers.delete(controller);
            }
        }

        const cacheKey = createHash('sha256').update(`${this.#baseUrl.origin}${this.#baseUrl.pathname}|${method}|${path}|${queryKey}`).digest('hex');
        const ttl = options.cacheTtlMs ?? this.#cacheTtlMs;
        if (!Number.isSafeInteger(ttl) || ttl < 0) throw new OpenDotaError({ code: 'invalid-input', operationId });
        if (options.cache !== false && ttl > 0) {
            const cached = this.#cache.get(cacheKey);
            if (cached && cached.expiresAt > this.#now()) {
                this.#cache.delete(cacheKey);
                this.#cache.set(cacheKey, cached);
                return this.#wrapResult(cloneEntry(cached), operationId, 'hit') as OpenDotaResult<ResponseData<Path, Method>>;
            }
            if (cached) this.#cache.delete(cacheKey);
        }

        const existing = this.#inFlight.get(cacheKey);
        if (existing) {
            return this.#subscribe(existing, operationId, options.signal).then((entry) =>
                this.#wrapResult(entry, operationId, 'coalesced') as OpenDotaResult<ResponseData<Path, Method>>);
        }

        const controller = new AbortController();
        this.#controllers.add(controller);
        const request: SharedRequest = {
            controller,
            subscribers: new Set(),
            deadlineExpired: false,
            completed: false,
            promise: Promise.resolve(undefined as unknown as CacheEntry),
        };
        const deadlineTimer = setTimeout(() => {
            request.deadlineExpired = true;
            controller.abort();
        }, this.#requestDeadlineMs);
        const inFlightPromise = this.#runWithRetries('get', url, operationId, path, controller.signal)
            .then((entry) => {
                if (options.cache !== false && ttl > 0 && !this.#closed) this.#saveCache(cacheKey, { ...entry, expiresAt: this.#now() + ttl });
                return entry;
            })
            .catch((error: unknown) => {
                if (this.#closed) throw new OpenDotaError({ code: 'client-closed', operationId });
                if (controller.signal.aborted) throw abortError(controller.signal, operationId, request.deadlineExpired);
                throw error;
            })
            .finally(() => {
                request.completed = true;
                clearTimeout(deadlineTimer);
                this.#inFlight.delete(cacheKey);
                this.#controllers.delete(controller);
            });
        request.promise = inFlightPromise;
        this.#inFlight.set(cacheKey, request);
        return this.#subscribe(request, operationId, options.signal).then((entry) =>
            this.#wrapResult(entry, operationId, 'miss') as OpenDotaResult<ResponseData<Path, Method>>);
    }

    #subscribe(request: SharedRequest, operationId: string, signal?: AbortSignal): Promise<CacheEntry> {
        if (signal?.aborted) return Promise.reject(new OpenDotaError({ code: 'aborted', operationId }));
        const token = Symbol(operationId);
        request.subscribers.add(token);
        return new Promise((resolve, reject) => {
            let settled = false;
            const unsubscribe = () => {
                if (settled) return;
                settled = true;
                request.subscribers.delete(token);
                signal?.removeEventListener('abort', onAbort);
                if (request.subscribers.size === 0 && !request.completed) request.controller.abort();
            };
            const onAbort = () => {
                unsubscribe();
                reject(new OpenDotaError({ code: 'aborted', operationId }));
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            request.promise.then((entry) => {
                if (settled) return;
                unsubscribe();
                resolve(cloneEntry(entry));
            }, (error: unknown) => {
                if (settled) return;
                unsubscribe();
                reject(error);
            });
        });
    }

    async #runWithRetries(
        method: HttpMethod,
        url: URL,
        operationId: string,
        path: string,
        signal: AbortSignal,
    ): Promise<CacheEntry> {
        const deadline = this.#now() + this.#requestDeadlineMs;
        let attempt = 0;
        while (true) {
            if (signal.aborted) throw new OpenDotaError({ code: 'aborted', operationId });
            try {
                return await this.#queue.run(
                    () => this.#performAttempt(method, url, operationId, path, signal),
                    signal,
                );
            } catch (error) {
                if (signal.aborted) throw new OpenDotaError({ code: 'aborted', operationId });
                if (method === 'post' || !isTransient(error) || attempt >= this.#maxRetries || this.#now() >= deadline) throw error;
                const retryAfterMs = error instanceof OpenDotaError ? error.retryAfterMs : undefined;
                const baseDelay = this.#retryBaseDelayMs * 2 ** attempt;
                const delay = retryAfterMs ?? Math.round(baseDelay * (0.5 + this.#random()));
                if (this.#now() + delay >= deadline) throw error;
                try {
                    await this.#sleep(delay, signal);
                } catch {
                    throw new OpenDotaError({ code: 'aborted', operationId });
                }
                attempt += 1;
            }
        }
    }

    async #performAttempt(method: HttpMethod, url: URL, operationId: string, path: string, signal: AbortSignal): Promise<CacheEntry> {
        const attemptController = new AbortController();
        const attemptSignal = AbortSignal.any([signal, attemptController.signal]);
        let didTimeout = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let abortHandler: (() => void) | undefined;
        const timeout = new Promise<never>((_resolve, reject) => {
            timeoutHandle = setTimeout(() => {
                didTimeout = true;
                attemptController.abort();
                reject(new OpenDotaError({ code: 'timeout', operationId }));
            }, this.#attemptTimeoutMs);
            abortHandler = () => {
                attemptController.abort();
                reject(new OpenDotaError({ code: 'aborted', operationId }));
            };
            signal.addEventListener('abort', abortHandler, { once: true });
        });
        const operation = (async () => {
            let response: Response;
            try {
                response = await this.#fetch(url, {
                    method: method.toUpperCase(),
                    headers: {
                        accept: 'application/json',
                        ...(this.#apiKey === undefined ? {} : { authorization: `Bearer ${this.#apiKey}` }),
                    },
                    signal: attemptSignal,
                });
            } catch {
                if (didTimeout) throw new OpenDotaError({ code: 'timeout', operationId });
                if (signal.aborted || this.#closed) throw new OpenDotaError({ code: 'aborted', operationId });
                throw new OpenDotaError({ code: 'network-error', operationId });
            }
            const raw = await response.text().catch(() => {
                throw new OpenDotaError({ code: 'network-error', operationId });
            });
            if (!response.ok) {
                const status = response.status;
                const retryAfterMs = retryAfter(response, this.#now());
                if (status === 401 || status === 403 || status === 400 && /invalid api key/i.test(raw.slice(0, 256))) {
                    throw new OpenDotaError({ code: 'unauthorized', status, operationId });
                }
                if (status === 404) throw new OpenDotaError({ code: 'not-found', status, operationId });
                if (status === 429) throw new OpenDotaError({ code: 'rate-limited', status, operationId, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) });
                throw new OpenDotaError({ code: 'http-error', status, operationId, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) });
            }
            const data = parseLosslessJson(raw, decimalIdArrayPaths.has(path));
            return {
                data,
                fetchedAt: new Date(this.#now()).toISOString(),
                rateLimit: rateLimitHeaders(response),
                expiresAt: 0,
            } satisfies CacheEntry;
        })();
        try {
            return await Promise.race([operation, timeout]);
        } finally {
            attemptController.abort();
            if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
            if (abortHandler) signal.removeEventListener('abort', abortHandler);
        }
    }

    #wrapResult<Value>(entry: CacheEntry, operationId: string, cacheStatus: 'miss' | 'hit' | 'coalesced'): OpenDotaResult<Value> {
        return {
            data: structuredClone(entry.data) as Value,
            meta: {
                provider: 'opendota',
                operationId,
                contractVersion: apiContractVersion,
                fetchedAt: entry.fetchedAt,
                servedAt: new Date(this.#now()).toISOString(),
                cacheStatus,
                rateLimit: { ...entry.rateLimit },
            },
        };
    }

    #saveCache(key: string, entry: CacheEntry): void {
        if (this.#maxCacheEntries === 0) return;
        this.#cache.delete(key);
        this.#cache.set(key, entry);
        while (this.#cache.size > this.#maxCacheEntries) {
            const oldest = this.#cache.keys().next().value as string | undefined;
            if (oldest === undefined) break;
            this.#cache.delete(oldest);
        }
    }
}

function cloneEntry(entry: CacheEntry): CacheEntry {
    return { ...entry, data: structuredClone(entry.data), rateLimit: { ...entry.rateLimit } };
}

async function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new OpenDotaError({ code: 'aborted' });
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new OpenDotaError({ code: 'aborted' }));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

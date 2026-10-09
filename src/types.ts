import type { paths } from './openapi.generated.js';
import type { supportedOperations } from './operations.generated.js';

export type DecimalId = string;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Operation = (typeof supportedOperations)[number];
export type HttpMethod = 'get' | 'post';
export type Route<Method extends HttpMethod> = {
    [Path in keyof paths]: Method extends keyof paths[Path]
        ? [NonNullable<paths[Path][Method]>] extends [never] ? never : Path
        : never;
}[keyof paths] & string;

type OperationAt<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method];
type ParametersAt<Path extends keyof paths, Method extends HttpMethod> = Path extends keyof paths
    ? Method extends keyof paths[Path]
        ? OperationAt<Path, Method> extends { parameters?: infer Parameters }
            ? Parameters
            : never
        : never
    : never;
type PathParametersAt<Path extends keyof paths, Method extends HttpMethod> = ParametersAt<Path, Method> extends { path?: infer Parameter }
    ? NonNullable<Parameter>
    : never;
type QueryParametersAt<Path extends keyof paths, Method extends HttpMethod> = ParametersAt<Path, Method> extends { query?: infer Parameter }
    ? NonNullable<Parameter>
    : never;
type RequiredKeys<Value> = Value extends object
    ? { [Key in keyof Value]-?: object extends Pick<Value, Key> ? never : Key }[keyof Value]
    : never;
type PathOption<Path extends keyof paths, Method extends HttpMethod> = [PathParametersAt<Path, Method>] extends [never]
    ? { path?: never }
    : { path: PathParametersAt<Path, Method> };
type QueryOption<Path extends keyof paths, Method extends HttpMethod> = [QueryParametersAt<Path, Method>] extends [never]
    ? { query?: never }
    : [RequiredKeys<QueryParametersAt<Path, Method>>] extends [never]
        ? { query?: QueryParametersAt<Path, Method> }
        : { query: QueryParametersAt<Path, Method> };

export type RequestOptions<Path extends keyof paths, Method extends HttpMethod> = PathOption<Path, Method>
    & QueryOption<Path, Method>
    & { signal?: AbortSignal; cacheTtlMs?: number; cache?: boolean; body?: never };

type SuccessResponse<Path extends keyof paths, Method extends HttpMethod> = Method extends keyof paths[Path]
    ? OperationAt<Path, Method> extends { responses: infer Responses }
        ? 200 extends keyof Responses
            ? Responses[200] extends { content: infer Content }
                ? Content[keyof Content]
                : unknown
            : unknown
        : unknown
    : unknown;

export type ResponseData<Path extends keyof paths, Method extends HttpMethod> = SuccessResponse<Path, Method>;

export interface RateLimitHeaders {
    readonly minuteRemaining?: number;
    readonly dayRemaining?: number;
}

export interface ResponseMeta {
    readonly provider: 'opendota';
    readonly operationId: string;
    readonly contractVersion: string;
    readonly fetchedAt: string;
    readonly servedAt: string;
    readonly cacheStatus: 'miss' | 'hit' | 'coalesced';
    readonly rateLimit: RateLimitHeaders;
}

export interface OpenDotaResult<Data> {
    readonly data: Data;
    readonly meta: ResponseMeta;
}

export interface ClientOptions {
    readonly apiKey?: string | undefined;
    readonly baseUrl?: string;
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => number;
    readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
    readonly random?: () => number;
    readonly maxConcurrency?: number;
    readonly maxQueuedRequests?: number;
    readonly minimumRequestIntervalMs?: number;
    readonly attemptTimeoutMs?: number;
    readonly requestDeadlineMs?: number;
    readonly maxRetries?: number;
    readonly retryBaseDelayMs?: number;
    readonly cacheTtlMs?: number;
    readonly maxCacheEntries?: number;
    readonly maxResponseBytes?: number;
}

export type OpenDotaErrorCode =
    | 'invalid-input'
    | 'invalid-url'
    | 'unauthorized'
    | 'not-found'
    | 'rate-limited'
    | 'http-error'
    | 'network-error'
    | 'response-too-large'
    | 'invalid-response'
    | 'aborted'
    | 'timeout'
    | 'queue-full'
    | 'client-closed';

export interface OpenDotaErrorOptions {
    readonly code: OpenDotaErrorCode;
    readonly operationId?: string;
    readonly status?: number;
    readonly retryAfterMs?: number;
}

const safeMessages: Record<OpenDotaErrorCode, string> = {
    'invalid-input': 'The OpenDota request options are invalid.',
    'invalid-url': 'The OpenDota base URL is invalid.',
    unauthorized: 'OpenDota rejected the supplied credentials.',
    'not-found': 'OpenDota does not have a record for this request.',
    'rate-limited': 'OpenDota rate-limited this request.',
    'http-error': 'OpenDota returned an unsuccessful HTTP response.',
    'network-error': 'The OpenDota request failed before receiving a response.',
    'response-too-large': 'OpenDota returned a response larger than the configured limit.',
    'invalid-response': 'OpenDota returned a response that was not valid JSON.',
    aborted: 'The OpenDota request was cancelled.',
    timeout: 'The OpenDota request exceeded its time limit.',
    'queue-full': 'The OpenDota client request queue is full.',
    'client-closed': 'The OpenDota client has been closed.',
};

export class OpenDotaError extends Error {
    readonly code: OpenDotaErrorCode;
    readonly operationId?: string;
    readonly status?: number;
    readonly retryAfterMs?: number;

    constructor(options: OpenDotaErrorOptions) {
        super(safeMessages[options.code]);
        this.name = 'OpenDotaError';
        this.code = options.code;
        if (options.operationId !== undefined) this.operationId = options.operationId;
        if (options.status !== undefined) this.status = options.status;
        if (options.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs;
    }
}

export function asOpenDotaError(error: unknown, code: OpenDotaErrorCode, operationId?: string): OpenDotaError {
    if (error instanceof OpenDotaError) return error;
    return new OpenDotaError({ code, ...(operationId === undefined ? {} : { operationId }) });
}

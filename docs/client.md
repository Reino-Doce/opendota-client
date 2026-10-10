# Client API

[Documentation home](README.md) · [Endpoints](operations.md) · [Request behavior](requests.md) · [Errors](errors.md)

Import runtime values and types from the package root:

```ts
import {
  OpenDotaClient,
  apiContractVersion,
  supportedOperations,
  type ClientOptions,
  type DecimalId,
  type RequestOptions,
  type ResponseData,
} from '@reino-doce/opendota-client';
```

## Constructor

```ts
new OpenDotaClient(options?: ClientOptions)
```

All options are optional. Request limits apply to one client instance.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | Omitted | Optional credential sent as `Authorization: Bearer <key>`. A blank key is rejected. |
| `baseUrl` | `string` | `https://api.opendota.com/api` | API root. Only HTTP and HTTPS URLs are accepted; credentials, query strings, and fragments are rejected. A trailing slash is normalized. |
| `maxConcurrency` | `number` | `2` | Maximum simultaneous request attempts. |
| `maxQueuedRequests` | `number` | `64` | Maximum waiting attempts. With `0`, only an attempt that can start immediately is accepted. |
| `minimumRequestIntervalMs` | `number` | `1100` | Minimum interval between attempt starts, including retries. |
| `attemptTimeoutMs` | `number` | `10000` | Time limit for one fetch and response-body read. |
| `requestDeadlineMs` | `number` | `30000` | Overall request deadline, including queue waits and retries. Coalesced callers share the initiating request's deadline. |
| `maxRetries` | `number` | `2` | Additional attempts for transient GET failures. POST requests are never retried automatically. |
| `retryBaseDelayMs` | `number` | `250` | Base delay for exponential retry backoff with jitter. `Retry-After` takes precedence when present. |
| `cacheTtlMs` | `number` | `0` | Default GET cache lifetime. `0` bypasses cache reads and writes. |
| `maxCacheEntries` | `number` | `256` | Maximum stored GET results. `0` disables storage. |
| `maxResponseBytes` | `number` | `8388608` (8 MiB) | Maximum streamed response-body bytes, after HTTP decoding. Applies to both successful and error responses. |
| `fetchImpl` | `typeof fetch` | Native `fetch` | Injectable transport with the standard fetch signature. |
| `now` | `() => number` | `Date.now` | Clock returning epoch milliseconds for timestamps, queue timing, and retry calculations. |
| `sleep` | `(milliseconds: number, signal?: AbortSignal) => Promise<void>` | Abort-aware timer | Injectable retry-delay function. |
| `random` | `() => number` | `Math.random` | Randomness source for retry jitter. |

Numeric constructor options must be nonnegative safe integers. `maxConcurrency` and `maxResponseBytes` must be at least `1`. A zero timeout schedules an immediate timeout; it does not disable the time limit. Invalid settings throw [`OpenDotaError`](errors.md) during construction.

## Methods

### `get(route, options)`

```ts
get<const Path extends Route<'get'>>(
  route: Path,
  options: RequestOptions<Path, 'get'>,
): Promise<OpenDotaResult<ResponseData<Path, 'get'>>>
```

Calls a supported GET route. The route literal determines the accepted parameters and successful response type. Identical in-flight GET requests share transport work. Memory caching is opt-in; see [GET cache and coalescing](requests.md#get-cache-and-coalescing).

```js
const result = await client.get('/matches/{match_id}', {
  path: { match_id: '90071992547409931' },
});
```

### `post(route, options)`

```ts
post<const Path extends Route<'post'>>(
  route: Path,
  options: RequestOptions<Path, 'post'>,
): Promise<OpenDotaResult<ResponseData<Path, 'post'>>>
```

Calls one of the two supported POST routes: [parse submission](endpoints/matches.md#post_request_by_job_id) or [player refresh](endpoints/players.md#post_refresh). These operations change provider state. Each explicit call sends a separate request with no body, caching, coalescing, or automatic retry.

```js
const result = await client.post('/request/{match_id}', {
  path: { match_id: '90071992547409931' },
});
```

### Request options

`RequestOptions<Path, Method>` infers `path` and `query` from the route. The options argument is always required; use `{}` when a route has no parameters.

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | Route-specific object | For routes with placeholders | Values substituted into the route template and URL-encoded. |
| `query` | Route-specific object | When the endpoint declares required query fields | Filters serialized into the query string. See each [endpoint](operations.md). |
| `signal` | `AbortSignal` | No | Cancels this caller's request. |
| `cacheTtlMs` | `number` | No | Overrides the client GET cache lifetime for this call. |
| `cache` | `boolean` | No | `false` bypasses GET cache reads and writes; coalescing still applies. |
| `body` | `never` | No | No supported operation accepts a request body. |

TypeScript checks route names, methods, and parameter shapes. The runtime checks supported routes and identifier formatting, but does not provide full schema validation for inputs or responses.

### `clearCache()`

```ts
clearCache(): void
```

Removes stored GET results. It does not cancel in-flight requests, which may subsequently populate the cache.

### `close()`

```ts
close(): void
```

Cancels active and waiting work and clears the cache. Repeated calls are safe. A closed client cannot be reopened; later requests fail with `client-closed`.

## Results and metadata

```ts
interface OpenDotaResult<Data> {
  readonly data: Data;
  readonly meta: ResponseMeta;
}
```

`data` is the successful JSON response after lossless identifier handling. It is cloned separately for every caller, including cache hits and coalesced requests. Types represent the corrected saved contract; missing fields, null values, and additional provider fields are preserved at runtime.

| Metadata field | Type | Meaning |
| --- | --- | --- |
| `provider` | `'opendota'` | Data provider. |
| `operationId` | `string` | Identifier from the saved API contract. |
| `contractVersion` | `string` | Version used to generate this client. |
| `fetchedAt` | `string` | ISO timestamp when the JSON response was acquired. Cache hits and coalesced results retain this timestamp. |
| `servedAt` | `string` | ISO timestamp when this caller's result was created. |
| `cacheStatus` | `'miss' \| 'hit' \| 'coalesced'` | A new request, stored result, or shared in-flight request respectively. POST always reports `miss`. |
| `rateLimit` | `RateLimitHeaders` | Remaining quotas from the acquired response, when the provider supplies them. |

`RateLimitHeaders` contains optional numeric `minuteRemaining` and `dayRemaining` fields, read from `x-rate-limit-remaining-minute` and `x-rate-limit-remaining-day`. Cached values are the headers from the original acquisition, not a fresh quota report.

Neither timestamp represents match game time or the observation time of an individual response field.

## Contract exports

### `apiContractVersion`

A literal version string for the saved contract, currently `31.1.0`. It is separate from the package version.

### `supportedOperations`

A readonly array of all supported operations. Each entry has `method` (`'GET'` or `'POST'`), `path`, `operationId`, and `summary`. It is useful for inspection or route menus; requests still use the route and method directly.

```js
console.log(apiContractVersion);
console.table(supportedOperations);
```

## Exported types

| Type | Purpose |
| --- | --- |
| `ClientOptions` | Constructor configuration. |
| `DecimalId` | Alias for `string`; pass exact decimal identifier text. |
| `HttpMethod` | `'get' \| 'post'`. |
| `Route<Method>` | Supported route literals for a method. |
| `Operation` | One entry in `supportedOperations`. |
| `RequestOptions<Path, Method>` | Route-specific inputs plus common request controls. |
| `ResponseData<Path, Method>` | Successful `data` shape for a route. |
| `OpenDotaResult<Data>` | Data and metadata envelope. |
| `ResponseMeta` | Acquisition and delivery metadata. |
| `RateLimitHeaders` | Optional remaining quotas. |
| `JsonValue` | Recursive JSON value type. |
| `OpenDotaErrorCode` | Union of [stable error codes](errors.md#error-codes). |
| `OpenDotaErrorOptions` | Options for constructing an [error](errors.md). |

Name an endpoint's response type through the public alias:

```ts
type Match = ResponseData<'/matches/{match_id}', 'get'>;
const accountId: DecimalId = '123456789';
const options: RequestOptions<'/players/{account_id}/matches', 'get'> = {
  path: { account_id: accountId },
  query: { limit: 5 },
};
```

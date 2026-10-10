# Request behavior

[Package overview](../README.md) · [Documentation](README.md) · [Client reference](client.md) · [Operations](operations.md) · [Errors](errors.md)

The client sends the routes listed in the [operation index](operations.md). Route-specific TypeScript types describe their parameters and successful response data. The behavior below applies across those operations.

## Request options

```ts
import type { RequestOptions } from '@reino-doce/opendota-client';

const options: RequestOptions<'/matches/{match_id}', 'get'> = {
  path: { match_id: '1234567890' },
  cacheTtlMs: 5_000,
};
```

`RequestOptions<Path, Method>` derives its parameters from the route. `path` is required only for routes with path parameters and prohibited otherwise. `query` is required when the route has a required query parameter, optional when all its query parameters are optional, and prohibited when it has none. The options argument itself is always required; use `{}` for a route without arguments.

| Option | Behavior |
| --- | --- |
| `path` | Replaces the route's named placeholders. Supply exactly those names. |
| `query` | Encodes the route's query parameters. `/explorer` requires `sql`. |
| `signal` | Cancels this caller's request. See [cancellation](#cancellation). |
| `cacheTtlMs` | Overrides the client's GET cache TTL. Must be a nonnegative safe integer in milliseconds. `0` bypasses cache reads and writes. |
| `cache` | `false` bypasses GET cache reads and writes. It does not disable in-flight coalescing. |
| `body` | Not supported. POST operations send no request body. |

POST operations ignore the cache options. Client-level defaults and limits are documented in the [client reference](client.md).

```ts
import { OpenDotaClient } from '@reino-doce/opendota-client';

const client = new OpenDotaClient();

try {
  const result = await client.get('/players/{account_id}/matches', {
    path: { account_id: '123456789' },
    query: {
      limit: 10,
      win: false,
      project: ['match_id', 'hero_id'],
    },
    cacheTtlMs: 5_000,
  });
  console.log(result.data, result.meta.cacheStatus);
} finally {
  client.close();
}
```

## Paths, query values, and identifiers

Call a route template such as `/matches/{match_id}` and pass its values through `path`. Each replacement is percent-encoded as one path component. Missing or extra path keys reject with `invalid-input`.

Identity parameters such as `account_id`, `match_id`, `match_seq_num`, `less_than_match_id`, `team_id`, `league_id`, and Steam/server IDs require digit-only decimal strings at runtime. This also applies to identity values in query arrays. Numeric identity inputs are rejected even when the number is within JavaScript's safe range. Keep IDs as strings from their source; converting an already rounded number to a string cannot recover its original value. Hero and item response IDs remain numeric. Most `hero_id` inputs use numbers, but `/rankings` expects a string `hero_id`; follow the route-specific parameter types.

The parse-status route `/request/{jobId}` accepts a string job ID, including opaque nondecimal strings. It rejects numeric job IDs. Other string path parameters, such as `resource` and `field`, follow their generated route types.

Query serialization follows these rules:

| Input | Encoded behavior |
| --- | --- |
| `undefined` or `null` | Omitted at runtime. Required query values cannot be omitted. |
| String, finite number, or boolean | Encoded as a query value; numeric `0` is retained. |
| Array | Each item becomes a repeated key, preserving item order. |
| Boolean `win` or `is_radiant` | `true` becomes `1`; `false` becomes `0`. |
| Boolean `turbo` | `true` becomes `1`; `false` is omitted. |
| Object, nonfinite number, or unsupported value | Rejected with `invalid-input`. |

For example, `project: ['match_id', 'hero_id']` becomes `project=match_id&project=hero_id`, and `win: false` becomes `win=0`. Query keys are sorted for a stable request URL; order among repeated values for the same key is retained. Different ordering of an array therefore produces a different cache/coalescing key.

Pass raw query values rather than pre-encoded strings. For `/explorer`, use `query: { sql: 'SELECT 1' }`; the SDK performs URL encoding.

The runtime checks parameter presence and serializability, supported route/method combinations, and known identity formats. It does not implement every constraint in the generated schema, such as numeric ranges, enums, or rejection of unknown query names passed from untyped JavaScript. Use the route's TypeScript types and the [operation index](operations.md) to select valid inputs.

## Response data

Successful requests return `OpenDotaResult<Data>` with `data` and `meta`; see the [result reference](client.md#results-and-metadata). The client parses JSON and preserves response fields, including fields not described by the generated types. It does not validate a successful payload against the response schema or fill in missing properties.

When a parsed JSON number is an integer outside JavaScript's safe integer range, the JSON parser returns its original JSON text as a string, including in fields that are not identifiers. Ordinary safe numbers remain numbers, subject to the identifier normalization below.

Digit-only values under these response property names are normalized to strings recursively:

```text
account_id, included_account_id, excluded_account_id, match_id, match_seq_num,
steamid, steam_id, lobby_id, server_id, server_steam_id, game_server_id,
watch_server_id, team_id, radiant_team_id, dire_team_id, opposing_team_id,
league_id, leagueid, jobId
```

Two route-specific rules also apply:

- `/leagues/{league_id}/matchIds`: decimal array entries become strings.
- `/request/{jobId}`: the root `id` property becomes a string when decimal. Nested or unrelated `id` properties keep their ordinary JSON type.

`DecimalId` is a TypeScript alias for `string`, not a runtime validator. Normalization leaves `null`, missing fields, and nondecimal values intact. A successful empty array or JSON `null` remains successful data; an empty or malformed JSON response body rejects with `invalid-response`.

Every returned result contains cloned data and rate-limit metadata. Mutating one result does not mutate the cache or another caller's result. See [contract corrections](contract-corrections.md) for the generated type adjustments.

## GET cache and coalescing

Cache entries and in-flight requests are private to a client instance. Their keys include the resolved path, serialized query, method, and route template. Different path values do not share results.

| Request setting | Reads an unexpired entry | Stores a successful result | Shares an identical in-flight GET |
| --- | --- | --- | --- |
| Effective `cacheTtlMs > 0`, `cache` omitted or `true` | Yes | Yes, subject to `maxCacheEntries` | Yes |
| Effective `cacheTtlMs = 0` | No | No | Yes |
| `cache: false` | No | No | Yes |

The default TTL is `0`. A positive TTL starts when a successful result is stored. Only successes are cached. Entries use bounded least-recently-used eviction; a cache hit refreshes the entry's recency. `maxCacheEntries: 0` disables storage.

An existing entry keeps the expiration set when it was stored. A later positive per-request TTL neither shortens nor extends that expiration on a cache hit. A bypass request leaves existing entries in place. To remove them, call `clearCache()`.

If no usable cached entry exists, identical concurrent GETs share one transport request, queue slot, retry sequence, and deadline. The caller that starts the shared request determines whether it will be cached and for how long. A joining caller's cache settings do not change that policy. Consequently, `cache: false` can join a cache-enabled request that will populate the cache for subsequent calls.

`meta.cacheStatus` describes how each caller obtained its result:

- `miss`: this caller started the request, including uncached GETs and all POSTs.
- `hit`: this caller received a stored entry.
- `coalesced`: this caller joined an existing in-flight GET.

Cached and coalesced results retain the original `fetchedAt`; each result receives its own `servedAt`. These are client timestamps, not the time of a match event or a provider freshness guarantee. Cached rate-limit values are also from the original response.

`clearCache()` does not cancel in-flight requests. A cache-enabled request already in progress can populate the cache after it is cleared.

## Queue, retries, and time limits

GET and POST attempts use the same per-client queue. `maxConcurrency` limits active attempts, `minimumRequestIntervalMs` spaces attempt starts, and `maxQueuedRequests` bounds waiting attempts. Retries re-enter that queue; retry waits do not hold an active attempt slot. If a request cannot start immediately and the waiting queue is full, it rejects with `queue-full`.

GETs can retry these failures up to `maxRetries` additional times:

- `network-error`, including a failure while reading the response body.
- `timeout` from an individual attempt.
- HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504`.

A valid `Retry-After` header takes precedence over backoff. It accepts nonnegative seconds or an HTTP date, converted to a nonnegative delay. Otherwise the delay is `round(retryBaseDelayMs × 2^retryIndex × (0.5 + random()))`, where the first retry has index `0`. With the default random source this adds jitter around the exponential delay.

`attemptTimeoutMs` covers one fetch and its response-body read, starting after the attempt leaves the queue. `requestDeadlineMs` covers the entire shared GET or individual POST, including queue waits, attempts, and retry delays. A joining GET caller inherits the running request's remaining deadline. Zero time limits schedule immediate expiry; they do not disable timeouts.

The client does not retry when its retry count is exhausted, the deadline has elapsed, or the next delay would reach or exceed the deadline. In the last case, it returns the current error without waiting; this can be an HTTP or network error rather than `timeout`. See [errors](errors.md) for the complete classification.

The client reports rate-limit headers but does not use remaining counts to schedule requests automatically. Configure the pacing and concurrency for your workload.

## POST behavior

Each POST creates a separate request. POSTs send no body, never retry automatically, never use the cache, and never coalesce. They still use the shared queue, response-size limit, per-attempt timeout, overall deadline, and cancellation signal.

```ts
const submitted = await client.post('/request/{match_id}', {
  path: { match_id: '1234567890' },
});
```

Submission success is the response to that operation; it does not itself establish that asynchronous provider work has completed. Consult the operation's response and status route before relying on completion. After a network failure or timeout, a POST may already have reached the provider; repeating it is an application decision.

## Cancellation

Pass an `AbortSignal` through `signal`. An already-aborted signal rejects before a request starts. Cancelling a GET subscriber rejects that caller with `aborted`; other subscribers can continue using the shared transport. The client aborts the shared transport when all subscribers cancel. A subsequent GET can start a fresh request instead of joining the aborted one.

Cancelling a POST aborts its individual transport. `close()` aborts active requests, rejects queued work, clears stored entries, and prevents future requests. An in-flight cancellation during shutdown can surface as `aborted` or `client-closed`; future calls reject with `client-closed`.

```ts
import { OpenDotaClient, OpenDotaError } from '@reino-doce/opendota-client';

const client = new OpenDotaClient();
const controller = new AbortController();
const pending = client.get('/metadata', { signal: controller.signal });
controller.abort();

try {
  await pending;
} catch (error) {
  if (!(error instanceof OpenDotaError) || error.code !== 'aborted') throw error;
} finally {
  client.close();
}
```

## Interpreting provider data

Generated response types describe the saved contract, not a runtime guarantee about a live provider response. Handle optional properties and nullable responses before reading them. An empty match history does not establish that a player has never played; absent parsed fields do not establish that their value is zero.

The transport does not infer missing match events, coordinates, telemetry, or provider coverage. `/live` returns the provider's live-game data through the same request mechanism; it does not create a continuous telemetry stream. Use `fetchedAt`, cache status, and the provider's own fields to assess whether the data fits the intended use.

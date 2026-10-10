# Error reference

[Package overview](../README.md) · [Documentation](README.md) · [Client reference](client.md) · [Operations](operations.md) · [Request behavior](requests.md)

The client throws `OpenDotaError` for its validation, HTTP, transport, scheduling, and lifecycle failures. Handle errors by `code`; messages are fixed descriptions rather than provider response bodies.

## `OpenDotaError`

```ts
import type { OpenDotaErrorCode } from '@reino-doce/opendota-client';

interface OpenDotaErrorOptions {
  readonly code: OpenDotaErrorCode;
  readonly operationId?: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
}

declare class OpenDotaError extends Error {
  constructor(options: OpenDotaErrorOptions);
  readonly code: OpenDotaErrorCode;
  readonly operationId?: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
}
```

| Property | Meaning |
| --- | --- |
| `name` | Always `OpenDotaError`. |
| `message` | Fixed message for the code. Does not include the API key, provider body, or underlying transport exception text. |
| `code` | One of the stable codes below. |
| `operationId` | Generated operation identifier when attached by the failing code path. Optional; do not assume every request failure includes it. |
| `status` | HTTP status when attached to an HTTP classification or response-size failure. Optional. |
| `retryAfterMs` | Parsed `Retry-After` delay for `rate-limited` or `http-error`, when the response header is valid. Optional. |

For example, local input validation, queue failures, and JSON parsing failures can omit `operationId`; `invalid-response` does not attach an HTTP status. Do not infer that no HTTP response was received solely because `status` is absent.

## Error codes

Automatic retry eligibility in this table applies only to GETs and is bounded by the configured count and request deadline. POSTs never retry automatically. A rejected GET may already have exhausted those retries. See [retry behavior](requests.md#queue-retries-and-time-limits) before adding an application retry loop.

| Code | Trigger | Retry and handling guidance |
| --- | --- | --- |
| `invalid-input` | Invalid constructor limits or blank API key; missing/extra path keys; invalid identity or query values; missing required query; unsupported route/method; invalid GET TTL. | No automatic retry. Correct the input. |
| `invalid-url` | Invalid base URL, non-HTTP(S) protocol, embedded credentials, query string, or fragment. | No automatic retry. Supply a valid base URL. |
| `unauthorized` | HTTP `401` or `403`, or HTTP `400` whose first 256 body characters match `invalid api key` case-insensitively. | No automatic retry. Check credentials and provider access before repeating the request. |
| `not-found` | HTTP `404`. | No automatic retry. Handle the missing provider record. A successful JSON `null` or empty array is data instead of this error. |
| `rate-limited` | HTTP `429`. | GET retry eligible; a valid `Retry-After` is honored within the deadline. If still rejected, reduce request rate or wait before a later request. |
| `http-error` | Another unsuccessful HTTP status. | GET retry eligible only for `408`, `425`, `500`, `502`, `503`, and `504`. Other statuses need application-specific handling. |
| `network-error` | Fetch rejects without cancellation/timeout, or reading the response body fails. | GET retry eligible. For a failed POST, consider whether the provider could already have processed it before repeating it. |
| `response-too-large` | The streamed response exceeds `maxResponseBytes`, including unsuccessful HTTP responses. The reader is cancelled. | No automatic retry. Review the response-size limit or reduce the requested data. |
| `invalid-response` | A successful response body is not valid JSON, including an empty body. | No automatic retry. Check provider behavior or the configured base URL. Schema mismatches alone do not cause this error. |
| `aborted` | The caller's signal is aborted, all GET subscribers cancel, or work is cancelled during shutdown. | No automatic retry. Treat cancellation as completion of that caller's interest. |
| `timeout` | An attempt exceeds `attemptTimeoutMs`, or the entire request reaches `requestDeadlineMs`, including queue time. | Individual GET attempt timeouts are retry eligible while time remains. Overall deadline expiry ends the request. Review latency, queue load, and time limits before retrying later. |
| `queue-full` | The waiting queue is at capacity and the attempt cannot start immediately. | No automatic retry. Reduce simultaneous requests or review queue capacity and pacing. |
| `client-closed` | A request uses a closed client, or pending work is rejected during shutdown. | No automatic retry. Create a new client for further work. |

The response-size limit is enforced before HTTP error classification, so an oversized HTTP `429` or `500` body can produce `response-too-large`. Non-successful response bodies do not have to be JSON to produce an HTTP classification.

## Catching errors

This example distinguishes successful empty data from transport failures and handles a few errors that commonly require separate application behavior. It logs only structured error fields, not credentials or raw responses.

```ts
import { OpenDotaClient, OpenDotaError } from '@reino-doce/opendota-client';

const client = new OpenDotaClient();

try {
  const result = await client.get('/players/{account_id}/recentMatches', {
    path: { account_id: '123456789' },
  });
  console.log(result.data); // An empty array is a successful response.
} catch (error: unknown) {
  if (!(error instanceof OpenDotaError)) throw error;

  switch (error.code) {
    case 'aborted':
    case 'client-closed':
      break;
    case 'not-found':
      console.log('No provider record is available for this request.');
      break;
    case 'rate-limited':
      console.error('Request rate exceeded the provider limit.', {
        retryAfterMs: error.retryAfterMs,
      });
      break;
    default:
      console.error(error.message, {
        code: error.code,
        operationId: error.operationId,
        status: error.status,
      });
  }
} finally {
  client.close();
}
```

Constructing a client can also throw synchronously for invalid configuration. Wrap construction in your application's error boundary when configuration comes from external input. A custom runtime hook can throw its own error, so an `unknown` catch value should still be checked with `instanceof` before accessing these fields.

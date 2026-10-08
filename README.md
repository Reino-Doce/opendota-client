# @reino-doce/opendota-client

A typed Node.js client for all operations in the OpenDota REST API contract. It uses native `fetch`, returns provider data without a Dota-specific projection, and keeps request credentials in the `Authorization` header.

## Requirements and setup

Requires Node.js `>=24.21.0 <25` and npm `>=12.1.0`.

```sh
npm install @reino-doce/opendota-client
```

```js
import { OpenDotaClient } from '@reino-doce/opendota-client';

const client = new OpenDotaClient({
  apiKey: process.env.OPENDOTA_API_KEY,
});

try {
  const { data, meta } = await client.get('/players/{account_id}/matches', {
    path: { account_id: '123456789' },
    query: { limit: 5, significant: 1 },
  });
  console.log(data, meta.fetchedAt);
} finally {
  client.close();
}
```

Player account IDs are Steam32 IDs. Pass identifiers as decimal strings even when the upstream schema currently represents them as numbers. Hero and item IDs remain numbers. `DecimalId` is exported for reusable type annotations.

Every route is a literal from the generated OpenDota contract. Path parameters and query parameters have separate, inferred types; documented POST operations do not accept a request body. `supportedOperations` and `apiContractVersion` are exported. See the [complete operation index](docs/operations.md).

## Authentication and errors

Anonymous requests work subject to the service's current limits. Pass an optional key as `apiKey`; the client sends it as `Authorization: Bearer …` and never appends it to the URL. An invalid key, rejected request, missing record, rate limit, network error, invalid JSON response, cancellation, timeout, queue exhaustion, and closed client produce an `OpenDotaError` with a stable `code`. Error messages and metadata never include keys or response bodies. HTTP status and a safe operation ID are available where applicable.

The constructor accepts an alternate `baseUrl` and injectable `fetchImpl`, clock, sleep, and randomness sources. The default request controls are two concurrent requests, 64 queued requests, a 1,100 ms interval between starts, a 10-second attempt timeout, a 30-second overall deadline, and at most two retries for transient GET failures. `Retry-After` is honored within the deadline. POST is explicit, never cached or coalesced, and never retried automatically.

GET coalescing is on. Memory caching is off by default. Set constructor `cacheTtlMs` or per-request `cacheTtlMs` to opt in; a zero value disables storage. The cache has a 256-entry default cap, scopes naturally to one client instance, includes the effective path and query in each key, and returns cloned data. `cache: false` bypasses storage. `clearCache()` removes cached values; `close()` cancels work and clears the cache.

`meta.fetchedAt` records when a JSON response was acquired; `servedAt` records when this caller received it. Neither is match game time or field-observation time. Rate-limit headers are returned when present. Limits and authentication entitlements change independently of this package and are not hard-coded as provider promises.

## Query and response behavior

- Omitted or `undefined` query values are left out. `0` and `false` are preserved, except `turbo: false` is omitted because OpenDota currently selects turbo matches whenever that query key is present. A boolean `win` or `is_radiant` value is encoded as `1` or `0`.
- Query arrays use repeated keys. For example, `teamA: [1, 2]` becomes `teamA=1&teamA=2`; this is also applied to `/findMatches`, where the published schema incorrectly claims CSV encoding. `/findMatches` inputs are hero IDs, not account IDs.
- Empty arrays, `null`, absent optional fields, and additional provider fields are retained. Numeric identifiers in the documented identity fields are converted losslessly to strings before they reach application code. Unsafe non-identifier integers are also kept as decimal strings rather than rounded.
- The official schema is incomplete in places. Generated response fields that OpenDota leaves unspecified remain `unknown` or a general JSON value, and the transport does not reject additive fields it has not seen.

## Interpretation limits

- An empty player history does not prove that the profile is private or that the player has no matches.
- A null parse-job response means there is no queue record to inspect; it does not prove parsing succeeded. Fetch match details to check available parsed data.
- Player wardmaps are aggregate historical density and have no placement timestamps.
- Benchmarks report whole-match metrics, not minute-specific performance trajectories. Their percentile values may be `null`; do not replace null with zero or assume a missing sample count.
- Match detail can be partial or unparsed. Preserve field absence and provider-derived roles as such.

## Examples

Runnable examples are in [`examples/`](examples/). The parse submission example sends a POST only when explicitly run with a match ID; status lookup is a separate GET example.

```sh
node examples/player-history.mjs 123456789
node examples/benchmarks.mjs
node examples/wardmap.mjs 123456789
node examples/parsed-matches.mjs
node examples/match-detail.mjs 90071992547409931
node examples/submit-parse.mjs 90071992547409931
node examples/parse-status.mjs <job-id>
```

The last command accepts the provider's parsing-job ID as a string; it may be a UUID.

## Contract updates and verification

`spec/openapi.json` is an unmodified snapshot from [OpenDota's public API contract](https://api.opendota.com/api). `spec/contract.json` records its version, retrieval date, upstream source revision, and SHA-256. `spec/overrides.json` records narrow corrections needed for runtime behavior or lossless ID types. The MIT notice for the vendored schema is in [`spec/NOTICE.md`](spec/NOTICE.md).

See [contract corrections](docs/contract-corrections.md) for the source-backed rationale behind each override.

Generated TypeScript and the operation index are created offline from the saved schema. After reviewing a newer upstream contract, update the snapshot and its metadata, review the full operation diff, and update `spec/operations.lock.json` deliberately before regenerating. The generator fails if the operation list changes without that review.

```sh
npm ci
npm run generate:check
npm run typecheck
npm run lint
npm test
npm pack --json
```

`npm run smoke` is an opt-in bounded, read-only check against `/metadata`, `/heroes`, and `/benchmarks` for hero 1. It makes three GET calls, observes the configured rate interval, and does not require a match, Steam account, player ID, parse submission, or history refresh. Set `OPENDOTA_API_KEY` only when choosing to use a configured key.

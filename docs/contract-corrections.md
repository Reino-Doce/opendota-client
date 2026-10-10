# Contract and maintenance

[Documentation home](README.md) · [Endpoints](operations.md) · [Response schemas](schemas.md) · [Development](development.md)

## Saved contract

The reference describes a pinned API contract. Its version is separate from the package version, and its saved retrieval date is not the timestamp of a live provider response.

| Metadata | Value |
| --- | --- |
| API version | `31.1.0` |
| OpenAPI version | `3.0.3` |
| Retrieved | `2026-10-08` |
| Upstream revision | `b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f` |
| Coverage | 55 operations: 53 GET and two POST |

The source snapshot and generator inputs live in the source checkout:

| File | Role |
| --- | --- |
| `spec/openapi.json` | Unmodified snapshot from [OpenDota's public API contract](https://api.opendota.com/api). |
| `spec/contract.json` | Contract version, retrieval date, source revision, and SHA-256 used to verify the snapshot. |
| `spec/overrides.json` | Reviewed corrections for client types and runtime serialization. |
| `spec/operations.lock.json` | Reviewed method, route, and operation-ID inventory. |
| `scripts/generate.mjs` | Applies corrections in memory and generates TypeScript, operation metadata, runtime override data, and documentation. |
| `scripts/generate-docs.mjs` | Renders the endpoint index, endpoint references, and response-schema catalog from the corrected contract. |

The official API reference is [docs.opendota.com](https://docs.opendota.com/). The snapshot is tied to [OpenDota core revision `b87e065`](https://github.com/odota/core/commit/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f). Vendored material retains its [MIT notice](../spec/NOTICE.md).

## Corrections

`spec/openapi.json` is the unmodified OpenDota 31.1.0 schema snapshot. The generator applies `spec/overrides.json` to an in-memory copy, keeping upstream material intact and making each correction reviewable. The source links are recorded in that override file and in `spec/contract.json`.

| Correction | Reason and evidence |
| --- | --- |
| Decimal identity values use `DecimalId` strings | The API documentation describes player, match, league, and team identifiers as integer values, while OpenDota's storage schema uses 64-bit `bigint` IDs. Keeping these values as strings avoids JavaScript precision loss. Hero and item response IDs remain numeric; the `/rankings` query retains the contract's string `hero_id` type. |
| Parse-job status `id` is route-specific | The pinned handlers expose the parsing queue ID as `jobId` in submission responses and as both `id` and `jobId` in status responses. The status `id` alias is normalized only on `/request/{jobId}` so unrelated numeric `id` fields remain numbers. Source: [pinned request handlers](https://github.com/odota/core/blob/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f/svc/api/spec.ts#L1559). |
| Benchmark `hero_id` is numeric; benchmark metrics may be nullable | The published benchmark parameter schema says `string`, while the API identifies heroes through numeric IDs. Some benchmark metric samples can be absent or `null`; the generated response type keeps that state distinct from zero. |
| Array query parameters use repeated keys | OpenDota documents account and hero filters as arrays, and `/findMatches` accepts `teamA` and `teamB` hero-ID arrays. The client serializes each array item as a repeated query key and preserves item order. |
| Boolean conveniences encode as numeric flags | Player `win` and `is_radiant` filters are documented as integers. Boolean inputs are accepted as a convenience and sent as `1` or `0`. |
| `/topPlayers` turbo false is omitted | OpenDota documents `turbo` as an integer selector for ratings based on turbo matches. `true` is sent as `1`; `false` is omitted so the ordinary top-player request does not become a present-but-false selector. |
| `/explorer` requires `sql` | This endpoint submits a SQL query; the corrected type requires the documented `sql` argument even though the source schema leaves it optional. The documentation also exposes the operation as “Submit arbitrary SQL queries to the database.” |
| Missing parse-job status is nullable | The pinned job-status handler returns JSON `null` when the requested job does not exist. The response type therefore preserves `null` so callers must handle missing jobs before reading job fields. Source: [pinned job-status handler](https://github.com/odota/core/blob/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f/svc/api/spec.ts#L1563). |
| Malformed nested response references and primitive ID arrays are repaired | The recent-matches route refers to a nonexistent response component in the source schema. The override points it to the existing `PlayerRecentMatchesResponse` model. League match IDs are emitted as `DecimalId` strings; `/parsedMatches` uses its `match_id` field and the general identity mapping. |
| Collection and row response shapes follow the pinned handlers | The OpenDota 31.1.0 handlers return one league object for `/leagues/{league_id}`, arrays of rows for league and team collection routes, and a flat row array for `/heroes/{hero_id}/players`. Route-specific response schemas correct the malformed nested/singular declarations; the hero-player and team-hero rows include the fields returned by their SQL handlers. Source: [pinned API implementation](https://github.com/odota/core/blob/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f/svc/api/spec.ts). |

The [storage schema at the pinned revision](https://github.com/odota/core/blob/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f/sql/create_tables.sql) records identifier columns as `bigint`.

These corrections are deliberately narrow. They do not infer missing match fields, turn absent values into defaults, or add endpoint behavior that is not present in the saved contract.

## Updating the contract

Generation is offline. It reads the saved files and never fetches a newer provider schema automatically.

1. Review a newer upstream contract and its corresponding source revision.
2. Replace `spec/openapi.json` with the unmodified snapshot and update `spec/contract.json`, including its hash and retrieval metadata.
3. Review the full operation diff and the existing corrections. Update `spec/operations.lock.json` deliberately after accepting inventory changes. The generator rejects an unreviewed operation list and guards the current operation counts.
4. Update the generator's count guards and relevant verification expectations when an accepted inventory change affects them.
5. Run `npm run generate`, inspect the generated types and documentation, and complete the [local checks](development.md#local-checks).

`npm run generate:check` fails when the snapshot metadata or hash does not match, the operation inventory differs from the lock, or a generated output is stale. Build and prepack regenerate these outputs. Keep corrections in the override file rather than editing the vendored snapshot or generated reference pages.

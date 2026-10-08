# Contract corrections

`spec/openapi.json` is the unmodified OpenDota 31.1.0 schema snapshot. The generator applies `spec/overrides.json` to an in-memory copy, keeping upstream material intact and making each correction reviewable. The source links are recorded in that override file and in `spec/contract.json`.

| Correction | Reason and evidence |
| --- | --- |
| Decimal identity values use `DecimalId` strings | The API documentation describes player, match, league, and team identifiers as integer values, while OpenDota's storage schema uses 64-bit `bigint` IDs. Keeping these values as strings avoids JavaScript precision loss. `hero_id` and `item_id` remain numeric. |
| Benchmark `hero_id` is numeric; benchmark metrics may be nullable | The published benchmark parameter schema says `string`, while the API identifies heroes through numeric IDs. Some benchmark metric samples can be absent or `null`; the generated response type keeps that state distinct from zero. |
| Array query parameters use repeated keys | OpenDota documents account and hero filters as arrays, and `/findMatches` accepts `teamA` and `teamB` hero-ID arrays. The client serializes each array item as a repeated query key and preserves item order. |
| Boolean conveniences encode as numeric flags | Player `win` and `is_radiant` filters are documented as integers. Boolean inputs are accepted as a convenience and sent as `1` or `0`. |
| `/topPlayers` turbo false is omitted | OpenDota documents `turbo` as an integer selector for ratings based on turbo matches. `true` is sent as `1`; `false` is omitted so the ordinary top-player request does not become a present-but-false selector. |
| `/explorer` requires `sql` | This endpoint submits a SQL query; the corrected type requires the documented `sql` argument even though the source schema leaves it optional. The documentation also exposes the operation as “Submit arbitrary SQL queries to the database.” |
| Malformed nested response references and primitive ID arrays are repaired | The recent-matches route refers to a nonexistent response component in the source schema. The override points it to the existing `PlayerRecentMatchesResponse` model. League match IDs are emitted as `DecimalId` strings; `/parsedMatches` uses its `match_id` field and the general identity mapping. |

The official API reference is [docs.opendota.com](https://docs.opendota.com/). The contract snapshot is tied to [OpenDota core revision `b87e065`](https://github.com/odota/core/commit/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f); the [storage schema at that revision](https://github.com/odota/core/blob/b87e0659b958c8b34ca9f38ddc3aab2dc2b52f5f/sql/create_tables.sql) records identifier columns as `bigint`.

These corrections are deliberately narrow. They do not infer missing match fields, turn absent values into defaults, or add endpoint behavior that is not present in the saved contract.

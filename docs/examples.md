# Examples

[Documentation home](README.md) · [Client API](client.md) · [Endpoints](operations.md)

The snippets below assume a client created with `new OpenDotaClient()`. Close it when finished, as shown in the [quick start](../README.md#quick-start). All identifiers shown are illustrative; use the account, match, or parsing-job ID relevant to your request.

## Player match history

```js
const { data, meta } = await client.get('/players/{account_id}/matches', {
  path: { account_id: '123456789' },
  query: { limit: 5, significant: 1, project: ['match_id', 'hero_id'] },
});
```

Use `limit` and `offset` to page through history. `project` selects extra columns and is encoded as repeated query keys. An empty result does not establish profile privacy or the absence of matches. See [player endpoints](endpoints/players.md).

## Match details

```js
const { data } = await client.get('/matches/{match_id}', {
  path: { match_id: '90071992547409931' },
});
```

Keep the match ID as a string, including when it exceeds JavaScript's safe integer range. A response can be partial or unparsed; inspect available fields before using them. Preserve field absence and provider-derived roles as returned. See [match endpoints](endpoints/matches.md).

## Benchmarks

```js
const { data } = await client.get('/benchmarks', {
  query: { hero_id: 1, bracket: 8, role: 'core' },
});
```

This endpoint accepts numeric hero IDs. Benchmark percentiles and values may be null, and describe whole-match metrics rather than minute-specific trajectories. Preserve nulls rather than substituting zero, and do not assume an unreported sample count. See [hero endpoints](endpoints/heroes.md).

## Ward density

```js
const { data } = await client.get('/players/{account_id}/wardmap', {
  path: { account_id: '123456789' },
  query: { win: false, is_radiant: false },
});
```

Boolean filters become `0` or `1`. Wardmaps describe aggregate historical density and do not include placement timestamps. The saved response schema is incomplete; narrow the value before interpreting its fields.

## Submit a parse request and inspect status

Submission is an explicit POST that changes provider state:

```js
const submission = await client.post('/request/{match_id}', {
  path: { match_id: '90071992547409931' },
});
```

The saved submission schema does not describe its fields. Inspect the returned provider data to obtain its `jobId`; do not assume it equals the match ID. Status lookup uses that opaque string, which may be a UUID:

```js
const { data: status } = await client.get('/request/{jobId}', {
  path: { jobId: 'job-id-returned-by-provider' },
});

if (status === null) {
  console.log('No queue record is available for this job.');
} else {
  console.log(status);
}
```

A null status does not prove parsing succeeded. Fetch the match details to inspect the available parsed data. The client does not poll automatically or retry submissions. See [parse endpoints](endpoints/matches.md) and [errors](errors.md).

## Runnable examples

From a source checkout, install dependencies and build before running the scripts:

```sh
npm ci
npm run build
```

Set `OPENDOTA_API_KEY` in your environment if you want the scripts to use a key. GET examples read provider data. The submission example sends a POST when explicitly run with a match ID.

| Script | Command | Operation |
| --- | --- | --- |
| Player history | `node examples/player-history.mjs 123456789` | GET player matches |
| Benchmarks | `node examples/benchmarks.mjs` | GET hero benchmarks |
| Wardmap | `node examples/wardmap.mjs 123456789` | GET player ward density |
| Parsed matches | `node examples/parsed-matches.mjs` | GET parsed match IDs |
| Match detail | `node examples/match-detail.mjs 90071992547409931` | GET match details |
| Parse submission | `node examples/submit-parse.mjs 90071992547409931` | POST a parse request |
| Parse status | `node examples/parse-status.mjs job-id-returned-by-provider` | GET status for an opaque parsing-job ID |

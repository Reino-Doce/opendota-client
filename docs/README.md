# API documentation

[`@reino-doce/opendota-client`](../README.md) exposes a typed, route-based API for the saved OpenDota 31.1.0 contract: 53 GET operations and two POST operations.

## Reference

| Page | Use it to |
| --- | --- |
| [Client API](client.md) | Configure a client, call its methods, and inspect result metadata |
| [Endpoint reference](operations.md) | Find a route and its required path and query parameters |
| [Response schemas](schemas.md) | Look up documented response fields and their types |
| [Request behavior](requests.md) | Understand serialization, precision, scheduling, retries, caching, and cancellation |
| [Errors](errors.md) | Handle `OpenDotaError` by its stable code |
| [Examples](examples.md) | Fetch player history, match details, benchmarks, wardmaps, and parsing status |
| [Contract and maintenance](contract-corrections.md) | Inspect the pinned schema and the client's deliberate corrections |
| [Development](development.md) | Build and verify the package or update generated documentation |

## Calling an endpoint

Start with the method and route in the [endpoint reference](operations.md). For example, `GET /heroes` becomes:

```js
import { OpenDotaClient } from '@reino-doce/opendota-client';

const client = new OpenDotaClient();
try {
  const { data, meta } = await client.get('/heroes', {});
  console.log(data, meta);
} finally {
  client.close();
}
```

Each endpoint page separates `path` parameters from `query` filters and describes the successful `data` value. All methods return the same [`OpenDotaResult<Data>` envelope](client.md#results-and-metadata), and failures use the same [error reference](errors.md).

The endpoint and schema pages are generated offline from the saved contract and its corrections. They describe this package's supported API; they do not promise live provider availability, complete match telemetry, or current account entitlements.

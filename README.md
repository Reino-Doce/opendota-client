# @reino-doce/opendota-client

Typed Node.js client for the OpenDota REST API. It covers all 55 operations in the saved OpenDota 31.1.0 contract, uses native `fetch`, and returns provider data with lossless identifier handling.

## Installation

Requires Node.js `>=24.21.0 <25` and npm `>=12.1.0`.

```sh
npm install @reino-doce/opendota-client
```

## Quick start

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

Use a route template exactly as listed in the [endpoint reference](docs/operations.md); supply its placeholders in `path` and its filters in `query`. Every `get()` and `post()` call requires an options object, including `{}` for routes without parameters.

Player account IDs are Steam32 IDs. Pass account, match, team, and league IDs as decimal strings. Hero inputs usually use numbers; `/rankings` expects a string `hero_id`. Follow each endpoint's parameter types. An API key is optional and is sent in the `Authorization` header.

## Documentation

| Reference | Contents |
| --- | --- |
| [Documentation home](docs/README.md) | Navigation and common tasks |
| [Client API](docs/client.md) | Constructor options, methods, results, metadata, and exported types |
| [Endpoints](docs/operations.md) | All routes, parameters, calls, and response shapes |
| [Response schemas](docs/schemas.md) | Fields described by the saved contract |
| [Request behavior](docs/requests.md) | IDs, query encoding, retries, caching, cancellation, and data interpretation |
| [Errors](docs/errors.md) | Stable error codes and error handling |
| [Examples](docs/examples.md) | Common workflows and runnable examples |
| [Contract and maintenance](docs/contract-corrections.md) | Schema provenance, corrections, and update policy |
| [Development](docs/development.md) | Build, generation, verification, and smoke check |

Response types describe the saved contract; the client does not validate response fields against a schema. Partial data, nulls, and additional provider fields are preserved. Service limits and authentication entitlements are controlled by OpenDota.

The package is licensed under [ISC](LICENSE). Vendored OpenDota material has a separate [MIT notice](spec/NOTICE.md); see [NOTICE.md](NOTICE.md).

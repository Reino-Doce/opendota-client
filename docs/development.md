# Development and verification

[Documentation home](README.md) · [Contract and maintenance](contract-corrections.md)

Use Node.js `>=24.21.0 <25` and npm `>=12.1.0`, as declared in `package.json`.

## Local checks

```sh
npm ci
npm run generate:check
npm run typecheck
npm run lint
npm test
npm pack --dry-run --json
```

| Command | Purpose |
| --- | --- |
| `npm run generate` | Regenerate API types, operation metadata, runtime overrides, and API reference pages from the saved contract. |
| `npm run generate:check` | Fail if any generated file differs from the saved contract and corrections. Does not fetch upstream data. |
| `npm run build` | Generate files and compile the package into `dist/`. |
| `npm run build:types` | Compile existing generated files without regeneration. |
| `npm run typecheck` | Check source types without emitting output. |
| `npm run typecheck:consumer` | Check consumer examples and rejected-input cases against built declarations. |
| `npm run lint` | Check source, scripts, tests, and runnable examples. |
| `npm test` | Build, check consumer types, and run the offline test suite. |
| `npm pack --dry-run --json` | Build through the prepack hook and inspect the package file inventory without creating an archive. |

## Documentation generation

The endpoint index, endpoint pages, and response schemas are generated. Update their generator or the reviewed contract inputs, then run `npm run generate`; manual edits to generated pages are overwritten by build and prepack.

The documentation home, client reference, request behavior, errors, examples, maintenance guide, and this page are maintained by hand. Check their descriptions against the public exports and implementation when behavior changes.

## Opt-in provider smoke check

```sh
npm run smoke
```

This bounded, read-only check calls `/metadata`, `/heroes`, and `/benchmarks` for hero `1`: three GET requests subject to the client's rate interval. It does not require a player, match, Steam account, parsing submission, or history refresh. Set `OPENDOTA_API_KEY` only when choosing to use a configured key.

Offline checks establish local package behavior and contract consistency. The smoke check establishes only that its selected calls worked at the time; it does not verify all endpoints or provider entitlements.

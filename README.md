# Savour

A Letterboxd for restaurants: log visits, keep a diary and a want-to-go list, and follow friends whose taste you trust. The product scope lives in [`docs/product/savour-v1.md`](docs/product/savour-v1.md).

Savour is built with Effect and Alchemy, following the [rat-stack](https://ratstack.sh) rules: typed work and errors in Effect, one schema-typed contract per capability, Cloudflare infrastructure declared with Alchemy, and a lint and type fence that rejects banned code. Project rules and the deliberate deviations from the starter are in [`AGENTS.md`](AGENTS.md). Credit for imported code is in [`PROVENANCE.md`](PROVENANCE.md).

## Prerelease pins

Alchemy `2.0.0-beta.83` declares the Cloudflare Stack in `apps/infra/alchemy.run.ts`. It is pinned exactly.

## Layout

- `apps/api`: the Cloudflare Worker that serves every capability over HTTP, with `/openapi.json`.
- `apps/infra`: the Alchemy Stack.
- `packages/core`: Savour's contracts and capabilities. Adapters stay outside it.
- `packages/capability`: `defineContract`, `implement`, and the HTTP projection.
- `scripts/`, `tools/`, `oxlint.config.ts`, `lefthook.yml`: the fence.

## Getting started

```sh
nvm use
pnpm install
pnpm turbo run check test build
```

## Validation

| Command | Purpose |
| --- | --- |
| `pnpm lint` | Type-aware lint and format check |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm test` | Run the Vitest suites |
| `pnpm turbo run check test build` | The acceptance gate, run before every push |
| `pnpm acceptance:cold-clone` | Clone, rename the scope, add a throwaway capability, and run the gate |

## Infrastructure

```sh
pnpm infra:plan --stage staging
pnpm infra:deploy --stage staging
```

Review every plan before applying it. `pnpm infra:destroy` needs the owner's approval.

# Savour

A Letterboxd for restaurants: log visits, keep a diary and a want-to-go list, and follow friends whose taste you trust. The product scope lives in [`docs/product/savour-v1.md`](docs/product/savour-v1.md).

Savour is built on the [rat-stack](https://ratstack.sh) scaffold: Effect for typed work and errors, XState for lifecycles, one schema-typed contract per capability projected to CLI, HTTP and MCP, Alchemy for Cloudflare infrastructure, and a lint and type fence that rejects banned code. Project rules and the deliberate deviations from the starter are in [`AGENTS.md`](AGENTS.md). Credit for imported code is in [`PROVENANCE.md`](PROVENANCE.md).

## Prerelease pins

Some of the stack runs on prerelease versions, pinned exactly:

- XState `6.0.0-alpha.65` owns lifecycle states.
- `@xstate/effect` `0.1.0-alpha.7` runs machines as scoped Effects through `createEffectActor`.
- Alchemy `2.0.0-beta.83` declares the Cloudflare Stack in `apps/infra/alchemy.run.ts`.

## Layout

- `apps/api`: the Cloudflare Worker that serves every capability over HTTP, with `/openapi.json` and `/docs`.
- `apps/cli`: the local composition root. `serve`, `mcp`, `openapi`, `catalog`, and one command per capability.
- `apps/infra`: the Alchemy Stack.
- `packages/capability`: `defineContract`, `implement`, and the CLI, HTTP, MCP, RPC and code-mode projections.
- `packages/core`: Savour's contracts and job-shaped ports. Adapters stay outside it.
- `packages/auth`, `packages/database`, `packages/events`, `packages/flags`, `packages/devtools`: auth, persistence, request analytics, feature flags, and local call recording.
- `.brain/` and `skills/`: rat-stack's reference material and agent playbooks, kept as upstream documentation.

## Getting started

```sh
nvm use
pnpm install
pnpm turbo run check test build
```

Run the capabilities locally:

```sh
pnpm cli health --json
pnpm cli serve --port 3000
pnpm cli mcp
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

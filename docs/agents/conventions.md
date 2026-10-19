# Conventions

Project rules learned while shipping cards. Skills follow them without asking.

## Native Promise boundaries

`typescript/promise-function-async` wants `async`, and the Effect diagnostic `asyncFunction` bans it. Where a function must hand a Promise to a framework (a Worker `fetch`, a TanStack Query `queryFn`, a router loader, `Effect.tryPromise`), keep the arrow non-async and escape the lint rule on that line with the boundary named:

```ts
// oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
queryFn: () => Effect.runPromise(program),
```

Inside Effect code, avoid Promises instead of escaping: stub `HttpClient` rather than `fetch`, and bind methods (`server.close.bind(server)`) where no arguments are needed.

## Cloudflare Vite plugin under Alchemy

`Cloudflare.Website.Vite` injects Alchemy's own Cloudflare plugin and sets `ALCHEMY_CLOUDFLARE_VITE_INJECTED=1`. A Vite app adds `@cloudflare/vite-plugin` in `vite.config.ts` only when that variable is unset, so standalone `vite build`, `vite dev` and tests still get it, and an Alchemy run never loads two copies:

```ts
process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1" ? null : cloudflare({ ... })
```

## Alchemy RuntimeContext in adapters

Alchemy's Worker bridge provides `RuntimeContext` per event, next to the request `Scope`, not to the Worker's startup effect, whose type rejects it. Startup also runs at deploy, while Alchemy builds the stack. An adapter wrapping an API that requires `RuntimeContext` (such as `@alchemy.run/better-auth`) reads it on each call and keeps it out of the port's types:

```ts
const withRuntime = <A, E>(
  effect: Effect.Effect<A, E, RuntimeContext>
): Effect.Effect<A, E> =>
  Effect.flatMap(
    Effect.serviceOption(RuntimeContext),
    Option.match({
      onNone: () => Effect.die(new MissingRuntimeContext({ adapter })),
      onSome: (runtime) =>
        Effect.provideService(effect, RuntimeContext, runtime),
    })
  );
```

Never capture it at layer construction to satisfy the startup type. Tests provide a stub with `Layer.succeed(RuntimeContext, ...)`, as in `apps/api/test/fixtures/memory-accounts.ts`.

## Worker secrets

A Worker reads each secret in its startup code with `Config.Redacted("NAME")`. Alchemy binds a `Redacted` value as a `secret_text` at deploy, and a missing value fails the Stack compile. Declare every secret in `.env.schema` with `@sensitive=true`. Adapters receive the `Redacted` value, and only unwrap it with `Redacted.value` at the request that sends it:

```ts
const placeSearch = googlePlaceSearch(
  yield * Config.Redacted("GOOGLE_PLACES_API_KEY")
).pipe(Layer.provide(FetchHttpClient.layer));
```

Infra tests that compile a Stack supply secrets with `ConfigProvider.layer(ConfigProvider.fromUnknown({ NAME: "test-key" }))`, as in `apps/infra/test/provider-coverage.test.ts`. That file also pins the compile refusal when a secret is missing.

## Staging deploys

`.github/workflows/ci.yml` owns staging. On every pull request from this repo, `plan-staging` runs `alchemy plan --stage staging` and keeps one PR comment updated with the plan. Reviewing the PR includes reviewing that plan. On every push to `main`, `deploy-staging` runs after `checks`, deploys with `alchemy deploy --stage staging --yes --no-input`, then runs `scripts/smoke-staging.sh` against `vars.STAGING_API_URL`.

- CI skips pull requests and pushes that only change Markdown, outside `AGENTS.md` and `README.md` (which `packages/core/test/docs-pins.test.ts` reads). A doc-only merge doesn't deploy, and the pre-commit hook is the only format check for those files. A new file that tests or the build read must not be Markdown under `docs/`, or the `paths` filter in `ci.yml` needs it added.
- Deploys never run in parallel (`concurrency: deploy-staging`). Never deploy staging by hand while a run is in flight.
- A new capability that staging can reach gets a line in `scripts/smoke-staging.sh`.
- A new Worker secret gets a repository secret with the same name and a line in both jobs' `env`, beside its `.env.schema` entry (see Worker secrets).
- The smoke test signs up one synthetic `smoke_<run id>` account per deploy, with an `@example.test` email.

## Splitting a pushed card

When a parked card is split after its branch was pushed, the first half ships from its own card and branch. Once it merges, the remaining half goes up on a new branch (`<card id>-<slice>`, such as `issue-22-screens`), rebased onto `main`, because rewriting the pushed branch would need a force-push. The old remote branch is left for the human to delete.

## Agent worktrees

Parallel sessions (`claude --worktree`) check out full copies of the repo under `.claude/worktrees/`. Lint and format must never see them. `oxfmt.config.ts` ignores `.claude/**`, and `ultracite check` and `ultracite fix` run with `--disable-nested-config`, because oxlint otherwise loads every worktree's `oxlint.config.ts` as a nested config and refuses to run. The repo has one lint config, at the root. Keep it that way instead of adding nested ones.

## iCloud duplicates

The repo sits in an iCloud-synced folder, and iCloud sometimes writes conflict copies named `<name> 2.<ext>` next to the original. In `apps/web` they are not harmless: a copied route adds a route such as `/sign-in 2`, and a copied test runs twice. Before validating, check `git status` for untracked `* 2.*` files, compare each with its original, and move them out of the repo. Never commit them, and never delete one that differs from its original without asking. Copies inside `dist/` and `.turbo/` are build output and can be left alone.

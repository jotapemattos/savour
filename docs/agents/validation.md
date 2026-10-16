# Validation

Commands come from the rat-stack scaffold. The gate runs all of them and must pass before every push.

```
lint: pnpm lint
typecheck: pnpm typecheck
test: pnpm test
gate: pnpm turbo run check test build
pr_size_budget: 500            # max changed production lines per PR (tests/fixtures/generated excluded)
guidelines: AGENTS.md
```

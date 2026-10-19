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

## Estimating the PR size

Before coding, estimate the card's production lines and double the estimate. React screens, forms and their fence-driven shapes (tagged schemas, `Match`, boundary decoding) land at about twice the first guess. When the doubled estimate passes `pr_size_budget`, plan the split at pickup instead of parking mid-implementation.

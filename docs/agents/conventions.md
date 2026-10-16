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

import { cloudflare } from "@cloudflare/vite-plugin";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";

const appRoot = new URL("..", import.meta.url).pathname;

const fakeApi = new URL("fixtures/fake-api.ts", import.meta.url).pathname;

// @effect-diagnostics-next-line asyncFunction:off -- Vite's dev server starts through a native Promise API.
const startWorkerWithApi = async (mode: string) => {
  process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED = "1";

  const server = await createServer({
    logLevel: "silent",
    plugins: [
      cloudflare({
        auxiliaryWorkers: [
          {
            config: {
              compatibility_date: "2026-05-28",
              compatibility_flags: ["nodejs_compat"],
              main: fakeApi,
              name: "savour-api",
              vars: { MODE: mode },
            },
          },
        ],
        config: {
          compatibility_date: "2026-05-28",
          compatibility_flags: ["nodejs_compat"],
          main: "./src/server.ts",
          name: "savour-web",
          services: [{ binding: "API", service: "savour-api" }],
        },
        inspectorPort: false,
        persistState: false,
        viteEnvironment: { name: "ssr" },
      }),
    ],
    root: appRoot,
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });

  return await server.listen();
};

const workerWithApi = (mode: string) =>
  Effect.acquireRelease(
    Effect.promise(startWorkerWithApi.bind(undefined, mode)),
    (server: ViteDevServer) => Effect.promise(server.close.bind(server))
  ).pipe(Effect.map((server) => server.resolvedUrls?.local[0] ?? ""));

const send = (origin: string, request: HttpClientRequest.HttpClientRequest) =>
  HttpClient.execute(
    HttpClientRequest.prependUrl(request, origin.replace(/\/$/u, ""))
  );

const forwarded = (origin: string, path: string) =>
  send(origin, HttpClientRequest.get(path)).pipe(
    Effect.flatMap((response) => response.json)
  );

describe("web worker under a hostile API", () => {
  describe("contract: the /api proxy", () => {
    it.live(
      "forwards prefix, root, query and body exactly, and nothing outside /api",
      () =>
        Effect.gen(function* proxiesExactly() {
          const origin = yield* workerWithApi("echo");

          expect(yield* forwarded(origin, "/api/health?x=1")).toMatchObject({
            method: "GET",
            path: "/health",
            search: "?x=1",
          });
          expect(yield* forwarded(origin, "/api")).toMatchObject({
            path: "/",
          });
          expect(yield* forwarded(origin, "/api/")).toMatchObject({
            path: "/",
          });

          const posted = yield* send(
            origin,
            HttpClientRequest.post("/api/visits").pipe(
              HttpClientRequest.bodyJsonUnsafe({ name: "Café 🍜" })
            )
          ).pipe(Effect.flatMap((response) => response.json));

          expect(posted).toMatchObject({
            body: JSON.stringify({ name: "Café 🍜" }),
            method: "POST",
            path: "/visits",
          });

          const outside = yield* send(origin, HttpClientRequest.get("/apiary"));
          const outsideBody = yield* outside.text;

          expect(outsideBody).not.toContain('"path":"/apiary"');
          expect(outsideBody).not.toContain('"path":"ary"');
        }).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))
    );
  });

  describe("hostile dependency: the API misbehaves", () => {
    it.live(
      "renders the shell as unavailable when the API answers 500 junk",
      () =>
        Effect.gen(function* rendersOnBrokenApi() {
          const origin = yield* workerWithApi("broken");

          const response = yield* send(origin, HttpClientRequest.get("/"));
          const html = yield* response.text;

          expect(response.status).toBe(200);
          expect(html).toContain("unavailable");
        }).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))
    );

    it.live(
      "answers the shell in bounded time when the API never responds",
      () =>
        Effect.gen(function* rendersOnHangingApi() {
          const origin = yield* workerWithApi("hang");

          const response = yield* send(origin, HttpClientRequest.get("/")).pipe(
            Effect.timeout(Duration.seconds(15))
          );

          const html = yield* response.text;

          expect(response.status).toBe(200);
          expect(html).toContain("unavailable");
        }).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))
    );
  });
});

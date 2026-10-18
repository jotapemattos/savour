import { cloudflare } from "@cloudflare/vite-plugin";
import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";

const appRoot = new URL("../..", import.meta.url).pathname;

const fakeApi = new URL("fake-api.ts", import.meta.url).pathname;

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

export const workerWithApi = (mode: string) =>
  Effect.acquireRelease(
    Effect.promise(startWorkerWithApi.bind(undefined, mode)),
    (server: ViteDevServer) => Effect.promise(server.close.bind(server))
  ).pipe(Effect.map((server) => server.resolvedUrls?.local[0] ?? ""));

export const send = (
  origin: string,
  request: HttpClientRequest.HttpClientRequest
) =>
  HttpClient.execute(
    HttpClientRequest.prependUrl(request, origin.replace(/\/$/u, ""))
  );

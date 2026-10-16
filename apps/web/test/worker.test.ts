import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";

const appRoot = new URL("..", import.meta.url).pathname;

// @effect-diagnostics-next-line asyncFunction:off -- Vite's dev server starts through a native Promise API.
const startWorker = async () => {
  const server = await createServer({
    logLevel: "silent",
    root: appRoot,
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });

  return await server.listen();
};

const runningWorker = Effect.acquireRelease(
  Effect.promise(startWorker),
  (server: ViteDevServer) => Effect.promise(server.close.bind(server))
);

describe("web worker", () => {
  it.live("serves the Savour shell", () =>
    Effect.gen(function* servesShell() {
      const server = yield* runningWorker;
      const origin = server.resolvedUrls?.local[0] ?? "";

      const response = yield* HttpClient.get(new URL("/", origin));
      const html = yield* response.text;

      expect(response.status).toBe(200);
      expect(html).toMatch(/<title>[^<]*Savour[^<]*<\/title>/u);
    }).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))
  );
});

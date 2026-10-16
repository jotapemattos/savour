import Api from "@savour/api/worker";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "Savour",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* stack() {
    const api = yield* Api;

    const web = yield* Cloudflare.Website.Vite("Web", {
      compatibility: { date: "2026-05-28" },
      env: { API: api },
      main: "src/server.ts",
      rootDir: new URL("../web", import.meta.url).pathname,
      workersDev: true,
    });

    return { apiUrl: api.url, webUrl: web.url };
  })
);

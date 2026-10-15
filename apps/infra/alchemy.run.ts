import Api from "@savour/api/worker";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "Savour",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* stack() {
    const api = yield* Api;

    return { apiUrl: api.url };
  })
);

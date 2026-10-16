import Api from "@savour/api/worker";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { PreviewStage, previewResourcesAllowed } from "./src/preview.js";

export const previewProgram = Effect.gen(function* previewStack() {
  yield* Schema.decodeEffect(PreviewStage)(yield* Stage).pipe(Effect.orDie);
  const api = yield* Api;
  const stack = yield* Alchemy.Stack;

  if (!previewResourcesAllowed(stack.resources)) {
    return yield* Effect.die(
      new Error(
        "Preview may declare only the Api Worker and its database branch"
      )
    );
  }

  return { apiUrl: api.url };
});

export default Alchemy.Stack(
  "SavourPreview",
  {
    providers: Layer.merge(Cloudflare.providers(), Neon.providers()),
    state: Cloudflare.state(),
  },
  previewProgram
);

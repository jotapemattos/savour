import { Context, Effect, Layer } from "effect";

import { Resource } from "./resource.js";

export class ReadAccess extends Context.Service<ReadAccess, number>()(
  "@savour/core/test/ReadAccess"
) {
  static readonly layer = Layer.effect(
    this,
    Resource.pipe(Effect.map((resource) => resource.id))
  );
}

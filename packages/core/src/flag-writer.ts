import { Context, Effect, Layer } from "effect";

import { FlagStorageError } from "./flag-storage-error.js";
import type { Flag } from "./flags.js";
import type { InvalidFlagValue } from "./invalid-flag-value.js";

export class FlagWriter extends Context.Service<
  FlagWriter,
  {
    readonly set: <A>(
      flag: Flag<A>,
      value: A
    ) => Effect.Effect<void, InvalidFlagValue | FlagStorageError>;
  }
>()("@rat-stack/core/FlagWriter") {
  static disabled = Layer.succeed(FlagWriter, {
    set: (flag) =>
      Effect.fail(
        new FlagStorageError({
          cause: "This composition has no live flag writer.",
          fallback: null,
          name: flag.name,
          operation: "write",
          repair:
            "Use an approved operator composition with a writable flags adapter.",
        })
      ),
  });
}

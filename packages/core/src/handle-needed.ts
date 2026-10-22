import { Effect, Schema } from "effect";

import { NextAction } from "./health-contracts.js";

export const handleNeededNextActions = [
  {
    description:
      "Send the same `idToken` to `POST /sessions/google` again with a `handle` (3 to 20 lowercase letters, digits or underscores) to create the account.",
    href: "/sessions/google",
    rel: "create-form",
  },
] as const;

export class HandleNeeded extends Schema.TaggedError<HandleNeeded>()(
  "HandleNeeded",
  {
    field: Schema.Literal("handle").pipe(
      Schema.withConstructorDefault(Effect.succeed("handle"))
    ),
    next: Schema.Array(NextAction).pipe(
      Schema.withConstructorDefault(Effect.succeed(handleNeededNextActions))
    ),
  },
  { description: "HandleNeeded", httpApiStatus: 409 }
) {}

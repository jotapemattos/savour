import { Schema } from "effect";

import { Handle } from "./account-schemas.js";

export class HandleTaken extends Schema.TaggedError<HandleTaken>()(
  "HandleTaken",
  { handle: Handle },
  { description: "HandleTaken", httpApiStatus: 409 }
) {}

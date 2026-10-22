import { Schema } from "effect";

export class TooManySignInAttempts extends Schema.TaggedError<TooManySignInAttempts>()(
  "TooManySignInAttempts",
  {},
  { description: "TooManySignInAttempts", httpApiStatus: 429 }
) {}

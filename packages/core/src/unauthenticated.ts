import { Schema } from "effect";

export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()(
  "Unauthenticated",
  {},
  { description: "Unauthenticated", httpApiStatus: 401 }
) {}

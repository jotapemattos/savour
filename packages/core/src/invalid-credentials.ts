import { Schema } from "effect";

export class InvalidCredentials extends Schema.TaggedError<InvalidCredentials>()(
  "InvalidCredentials",
  {},
  { description: "InvalidCredentials", httpApiStatus: 401 }
) {}

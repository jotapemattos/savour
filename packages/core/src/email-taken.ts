import { Schema } from "effect";

export class EmailTaken extends Schema.TaggedError<EmailTaken>()(
  "EmailTaken",
  {},
  { description: "EmailTaken", httpApiStatus: 409 }
) {}

import { Schema } from "effect";

export class NotAReview extends Schema.TaggedError<NotAReview>()(
  "NotAReview",
  { visitId: Schema.String },
  { description: "NotAReview", httpApiStatus: 409 }
) {}

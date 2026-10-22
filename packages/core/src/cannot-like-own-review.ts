import { Schema } from "effect";

export class CannotLikeOwnReview extends Schema.TaggedError<CannotLikeOwnReview>()(
  "CannotLikeOwnReview",
  { visitId: Schema.String },
  { description: "CannotLikeOwnReview", httpApiStatus: 403 }
) {}

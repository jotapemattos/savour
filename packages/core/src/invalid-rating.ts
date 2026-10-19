import { Schema } from "effect";

export class InvalidRating extends Schema.TaggedError<InvalidRating>()(
  "InvalidRating",
  { rating: Schema.Finite },
  { description: "InvalidRating", httpApiStatus: 400 }
) {}

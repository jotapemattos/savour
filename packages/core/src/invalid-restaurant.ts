import { Schema } from "effect";

export class InvalidRestaurant extends Schema.TaggedError<InvalidRestaurant>()(
  "InvalidRestaurant",
  { field: Schema.Literals(["name", "address"]) },
  { description: "InvalidRestaurant", httpApiStatus: 400 }
) {}

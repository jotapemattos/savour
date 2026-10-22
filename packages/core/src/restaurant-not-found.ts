import { Schema } from "effect";

export class RestaurantNotFound extends Schema.TaggedError<RestaurantNotFound>()(
  "RestaurantNotFound",
  { restaurantId: Schema.String },
  { description: "RestaurantNotFound", httpApiStatus: 404 }
) {}

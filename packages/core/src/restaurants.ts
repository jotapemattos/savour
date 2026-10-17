import { Context, Schema } from "effect";
import type { Effect } from "effect";

import type { DatabaseUnavailable } from "./database-health-contracts.js";
import { PlaceId } from "./place-schemas.js";

export const Restaurant = Schema.Struct({
  id: Schema.String,
  placeId: PlaceId,
  source: Schema.Literal("provider"),
});

export interface RestaurantsService {
  readonly materialize: (
    placeId: string
  ) => Effect.Effect<typeof Restaurant.Type, DatabaseUnavailable>;
}

export class Restaurants extends Context.Service<
  Restaurants,
  RestaurantsService
>()("@savour/core/Restaurants") {}

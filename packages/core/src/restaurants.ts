import { Context, Schema } from "effect";
import type { Effect } from "effect";

import { Handle } from "./account-schemas.js";
import type { DatabaseUnavailable } from "./database-health-contracts.js";
import { PlaceId } from "./place-schemas.js";
import type { RestaurantNotFound } from "./restaurant-not-found.js";

export const ProviderRestaurant = Schema.Struct({
  id: Schema.String,
  placeId: PlaceId,
  source: Schema.Literal("provider"),
});

export const UserAddedRestaurant = Schema.Struct({
  addedBy: Handle,
  address: Schema.String,
  id: Schema.String,
  name: Schema.String,
  source: Schema.Literal("user"),
}).annotate({
  description:
    "A restaurant a user added by hand. Nobody has checked its name or address.",
});

export const Restaurant = Schema.Union([
  ProviderRestaurant,
  UserAddedRestaurant,
]);

export type NewUserAddedRestaurant = Omit<
  typeof UserAddedRestaurant.Type,
  "id" | "source"
>;

export interface RestaurantsService {
  readonly add: (
    restaurant: NewUserAddedRestaurant
  ) => Effect.Effect<typeof UserAddedRestaurant.Type, DatabaseUnavailable>;
  readonly addedByUsersMatching: (
    query: string
  ) => Effect.Effect<
    readonly (typeof UserAddedRestaurant.Type)[],
    DatabaseUnavailable
  >;
  readonly find: (
    restaurantId: string
  ) => Effect.Effect<
    typeof Restaurant.Type,
    RestaurantNotFound | DatabaseUnavailable
  >;
  readonly materialize: (
    placeId: string
  ) => Effect.Effect<typeof ProviderRestaurant.Type, DatabaseUnavailable>;
}

export class Restaurants extends Context.Service<
  Restaurants,
  RestaurantsService
>()("@savour/core/Restaurants") {}

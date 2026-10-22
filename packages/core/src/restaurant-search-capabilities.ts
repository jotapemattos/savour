import { implement } from "@savour/capability/implement";
import { Effect, Option } from "effect";

import { PlaceSearch } from "./place-search.js";
import { searchRestaurantsContract } from "./restaurant-search-contracts.js";
import { Restaurants } from "./restaurants.js";

export const addRestaurantAction = {
  description:
    "Add a restaurant the search missed by hand with `POST /restaurants`, its `name` and `address`, and the bearer token.",
  href: "/restaurants",
  rel: "create-form",
} as const;

export const searchRestaurants = implement(
  searchRestaurantsContract,
  ({ near, q }) =>
    Effect.gen(function* searchPlaces() {
      const placeSearch = yield* PlaceSearch;
      const restaurants = yield* Restaurants;

      const { places, userAdded } = yield* Effect.all(
        {
          places: placeSearch.search(q, Option.fromUndefinedOr(near)),
          userAdded: restaurants.addedByUsersMatching(q),
        },
        { concurrency: "unbounded" }
      );

      return {
        next: [addRestaurantAction],
        results: [
          ...userAdded.map(({ addedBy, address, id, name }) => ({
            addedBy,
            address,
            name,
            restaurantId: id,
            userAdded: true as const,
          })),
          ...places.map((place) => ({ ...place, userAdded: false as const })),
        ],
      };
    })
);

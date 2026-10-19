import { implement } from "@savour/capability/implement";
import { Effect, Option } from "effect";

import { PlaceSearch } from "./place-search.js";
import { searchRestaurantsContract } from "./restaurant-search-contracts.js";

export const addRestaurantAction = {
  description:
    "Add a restaurant the search missed by hand with `POST /restaurants`.",
  href: "/restaurants",
  rel: "create-form",
} as const;

export const searchRestaurants = implement(
  searchRestaurantsContract,
  ({ near, q }) =>
    Effect.gen(function* searchPlaces() {
      const placeSearch = yield* PlaceSearch;

      const results = yield* placeSearch.search(
        q,
        Option.fromUndefinedOr(near)
      );

      return { next: [addRestaurantAction], results };
    })
);

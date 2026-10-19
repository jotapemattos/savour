import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { NextAction } from "./health-contracts.js";
import { Near, Place, SearchQuery } from "./place-schemas.js";
import { PlaceSearchUnavailable } from "./place-search-unavailable.js";

export const RestaurantSearchResults = Schema.Struct({
  next: Schema.Array(NextAction),
  results: Schema.Array(Place),
});

export const searchRestaurantsContract = defineContract("searchRestaurants", {
  annotations: { idempotent: true, openWorld: true, readOnly: true },
  description:
    "Search restaurants in Brazil by free text, such as `pizzaria bragança paulista`, through Google Places. Pass `near` to rank places close to the searcher first.",
  failure: PlaceSearchUnavailable,
  http: { method: "GET", path: "/restaurants/search" },
  input: Schema.Struct({ near: Schema.optionalKey(Near), q: SearchQuery }),
  output: RestaurantSearchResults,
});

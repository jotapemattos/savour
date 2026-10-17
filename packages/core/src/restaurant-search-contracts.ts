import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { NextAction } from "./health-contracts.js";
import { Place, SearchQuery } from "./place-schemas.js";
import { PlaceSearchUnavailable } from "./place-search-unavailable.js";

export const RestaurantSearchResults = Schema.Struct({
  next: Schema.Array(NextAction),
  results: Schema.Array(Place),
});

export const searchRestaurantsContract = defineContract("searchRestaurants", {
  annotations: { idempotent: true, openWorld: true, readOnly: true },
  description:
    "Search restaurants anywhere by free text, such as `pizzaria bragança paulista`, through Google Places.",
  failure: PlaceSearchUnavailable,
  http: { method: "GET", path: "/restaurants/search" },
  input: Schema.Struct({ q: SearchQuery }),
  output: RestaurantSearchResults,
});

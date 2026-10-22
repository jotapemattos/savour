import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { Handle } from "./account-schemas.js";
import { DatabaseUnavailable } from "./database-health-contracts.js";
import { NextAction } from "./health-contracts.js";
import { Near, Place, SearchQuery } from "./place-schemas.js";
import { PlaceSearchUnavailable } from "./place-search-unavailable.js";

export const ProviderResult = Schema.Struct({
  ...Place.fields,
  userAdded: Schema.Literal(false),
});

export const UserAddedResult = Schema.Struct({
  addedBy: Handle,
  address: Schema.String,
  name: Schema.String,
  restaurantId: Schema.String,
  userAdded: Schema.Literal(true),
}).annotate({
  description:
    "A restaurant a user added by hand, so nobody has checked it. Log a visit to it by its `restaurantId`.",
});

export const SearchResult = Schema.Union([ProviderResult, UserAddedResult]);

export const RestaurantSearchResults = Schema.Struct({
  next: Schema.Array(NextAction),
  results: Schema.Array(SearchResult),
});

export const searchRestaurantsContract = defineContract("searchRestaurants", {
  annotations: { idempotent: true, openWorld: true, readOnly: true },
  description:
    "Search restaurants in Brazil by free text, such as `pizzaria bragança paulista`, through Google Places, plus restaurants users added by hand whose name is close to the text. User-added results come first with `userAdded: true`. Pass `near` to rank places close to the searcher first.",
  failure: Schema.Union([PlaceSearchUnavailable, DatabaseUnavailable]),
  http: { method: "GET", path: "/restaurants/search" },
  input: Schema.Struct({ near: Schema.optionalKey(Near), q: SearchQuery }),
  output: RestaurantSearchResults,
});

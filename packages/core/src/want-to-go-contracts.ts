import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { DatabaseUnavailable } from "./database-health-contracts.js";
import { NextAction } from "./health-contracts.js";
import { Place, PlaceId } from "./place-schemas.js";
import { Restaurant } from "./restaurants.js";
import { Unauthenticated } from "./unauthenticated.js";

export const WantToGoEntry = Schema.Struct({
  place: Schema.NullOr(Place),
  restaurant: Restaurant,
});

export const WantToGoList = Schema.Struct({
  next: Schema.Array(NextAction),
  restaurants: Schema.Array(WantToGoEntry),
});

export const SavedToWantToGo = Schema.Struct({
  next: Schema.Array(NextAction),
  saved: WantToGoEntry,
});

export const RemovedFromWantToGo = Schema.Struct({
  next: Schema.Array(NextAction),
});

export const addToWantToGoContract = defineContract("addToWantToGo", {
  annotations: { idempotent: true },
  description:
    "Save a restaurant found with `GET /restaurants/search` to your want-to-go list, by its `placeId`, with the bearer token. Saving it again keeps it once, where it was.",
  failure: Schema.Union([Unauthenticated, DatabaseUnavailable]),
  http: { method: "POST", path: "/want-to-go" },
  input: Schema.Struct({ placeId: PlaceId }),
  output: SavedToWantToGo,
});

export const removeFromWantToGoContract = defineContract("removeFromWantToGo", {
  annotations: { idempotent: true },
  description:
    "Take a restaurant off your want-to-go list by its restaurant `id`, with the bearer token. Logging a visit never does this for you.",
  failure: Schema.Union([Unauthenticated, DatabaseUnavailable]),
  http: { method: "DELETE", path: "/want-to-go/:id" },
  input: Schema.Struct({ id: Schema.String }),
  output: RemovedFromWantToGo,
});

export const wantToGoContract = defineContract("wantToGo", {
  annotations: { idempotent: true, readOnly: true },
  description:
    "Read your want-to-go list with the bearer token, newest saved first.",
  failure: Schema.Union([Unauthenticated, DatabaseUnavailable]),
  http: { method: "GET", path: "/want-to-go" },
  input: Schema.Struct({}),
  output: WantToGoList,
});

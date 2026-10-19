import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { LatLng, Place } from "./place-schemas.js";
import type { PlaceSearchUnavailable } from "./place-search-unavailable.js";

export interface PlaceSearchService {
  readonly details: (
    placeId: string
  ) => Effect.Effect<typeof Place.Type, PlaceSearchUnavailable>;
  readonly search: (
    query: string,
    near: Option.Option<typeof LatLng.Type>
  ) => Effect.Effect<readonly (typeof Place.Type)[], PlaceSearchUnavailable>;
}

export class PlaceSearch extends Context.Service<
  PlaceSearch,
  PlaceSearchService
>()("@savour/core/PlaceSearch") {}

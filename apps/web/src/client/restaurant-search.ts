import { Place } from "@savour/core/contracts";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { Effect, Schema } from "effect";

import { savourApi } from "./savour-api";
import type { ApiTransport } from "./savour-api";

export const PlacesFound = Schema.TaggedStruct("PlacesFound", {
  canAddByHand: Schema.Boolean,
  places: Schema.Array(Place),
});

export const SearchUnavailable = Schema.TaggedStruct("SearchUnavailable", {});

export type SearchOutcome =
  | typeof PlacesFound.Type
  | typeof SearchUnavailable.Type;

const ADD_BY_HAND = "create-form";

const searchPlaces = (transport: ApiTransport, q: string) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.searchRestaurants({ query: { q } })
    ),
    Effect.map((found): SearchOutcome =>
      PlacesFound.make({
        canAddByHand: found.next.some((action) => action.rel === ADD_BY_HAND),
        places: found.results,
      })
    ),
    Effect.catchTag("PlaceSearchUnavailable", () =>
      Effect.succeed<SearchOutcome>(SearchUnavailable.make({}))
    ),
    Effect.provide(transport.layer)
  );

export const restaurantSearchQuery = (
  transport: ApiTransport,
  q: string | undefined
) =>
  queryOptions({
    queryFn:
      q === undefined
        ? skipToken
        : // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
          () => Effect.runPromise(searchPlaces(transport, q)),
    queryKey: ["restaurants", "search", q],
    retry: false,
    staleTime: "static",
  });

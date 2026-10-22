import { implement } from "@savour/capability/implement";
import { Effect } from "effect";

import { PlaceSearch } from "./place-search.js";
import type { Restaurant } from "./restaurants.js";
import { Restaurants } from "./restaurants.js";
import { logVisitAction, signedInAccountId } from "./visit-capabilities.js";
import {
  addToWantToGoContract,
  removeFromWantToGoContract,
  wantToGoContract,
} from "./want-to-go-contracts.js";
import { WantToGo } from "./want-to-go.js";

export const readWantToGoAction = {
  description:
    "Read your want-to-go list with `GET /want-to-go` and the bearer token.",
  href: "/want-to-go",
  rel: "collection",
} as const;

export const addToWantToGoAction = {
  description:
    "Save a restaurant with `POST /want-to-go` and the bearer token, after finding it with `GET /restaurants/search`.",
  href: "/want-to-go",
  rel: "create-form",
} as const;

export const removeFromWantToGoAction = {
  description:
    "Take a restaurant off your list with `DELETE /want-to-go/{id}` and the bearer token.",
  href: "/want-to-go/{id}",
  rel: "delete",
} as const;

const PLACE_LOOKUPS = 4;

const entryOf = (restaurant: typeof Restaurant.Type) =>
  PlaceSearch.use((placeSearch) =>
    placeSearch.details(restaurant.placeId)
  ).pipe(
    Effect.catchTag("PlaceSearchUnavailable", () =>
      Effect.logWarning("want_to_go.place_unresolved").pipe(
        Effect.annotateLogs({ placeId: restaurant.placeId }),
        Effect.as(null)
      )
    ),
    Effect.map((place) => ({ place, restaurant }))
  );

export const addToWantToGo = implement(addToWantToGoContract, ({ placeId }) =>
  Effect.gen(function* saveToWantToGo() {
    const accountId = yield* signedInAccountId;

    const restaurant = yield* Restaurants.use((store) =>
      store.materialize(placeId)
    );

    yield* WantToGo.use((store) => store.add(accountId, restaurant.id));

    yield* Effect.logInfo("want_to_go.added").pipe(
      Effect.annotateLogs({ restaurantId: restaurant.id })
    );

    return {
      next: [readWantToGoAction, removeFromWantToGoAction],
      saved: yield* entryOf(restaurant),
    };
  })
);

export const removeFromWantToGo = implement(
  removeFromWantToGoContract,
  ({ id }) =>
    Effect.gen(function* takeOffWantToGo() {
      const accountId = yield* signedInAccountId;

      yield* WantToGo.use((store) => store.remove(accountId, id));

      yield* Effect.logInfo("want_to_go.removed").pipe(
        Effect.annotateLogs({ restaurantId: id })
      );

      return { next: [readWantToGoAction, addToWantToGoAction] };
    })
);

export const wantToGo = implement(wantToGoContract, () =>
  Effect.gen(function* readWantToGo() {
    const accountId = yield* signedInAccountId;
    const saved = yield* WantToGo.use((store) => store.list(accountId));

    return {
      next: [addToWantToGoAction, removeFromWantToGoAction, logVisitAction],
      restaurants: yield* Effect.forEach(saved, entryOf, {
        concurrency: PLACE_LOOKUPS,
      }),
    };
  })
);

import {
  Restaurants,
  Visits,
  currentRatingFrom,
  diaryOrder,
} from "@savour/core";
import type { StoredVisit } from "@savour/core";
import { Effect, Layer } from "effect";

interface OwnedVisit extends StoredVisit {
  readonly accountId: string;
}

const MemoryRestaurants = Layer.succeed(Restaurants, {
  materialize: (placeId) =>
    Effect.succeed({
      id: `restaurant-${placeId}`,
      placeId,
      source: "provider",
    }),
});

export const memoryVisits = () => {
  const stored: OwnedVisit[] = [];

  const ownedBy = (accountId: string) =>
    Effect.sync(() =>
      stored
        .filter((owned) => owned.accountId === accountId)
        .toSorted(diaryOrder)
    );

  const visits = Layer.succeed(Visits, {
    currentRating: (accountId, restaurantId) =>
      ownedBy(accountId).pipe(
        Effect.map((owned) =>
          currentRatingFrom(
            owned.filter(({ visit }) => visit.restaurant.id === restaurantId)
          )
        )
      ),
    diary: ownedBy,
    log: (accountId, visit) =>
      Effect.sync(() => {
        const loggedAt = stored.length + 1;
        const logged = { ...visit, id: `visit-${String(loggedAt)}` };

        stored.push({ accountId, loggedAt, visit: logged });

        return logged;
      }),
  });

  return { layer: Layer.merge(MemoryRestaurants, visits), stored };
};

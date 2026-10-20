import {
  Restaurants,
  VisitNotFound,
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
  let logged = 0;

  const ownedBy = (accountId: string) =>
    Effect.sync(() =>
      stored
        .filter((owned) => owned.accountId === accountId)
        .toSorted(diaryOrder)
    );

  const ownedVisit = (accountId: string, visitId: string) =>
    Effect.suspend(() => {
      const owned = stored.find(
        (candidate) =>
          candidate.accountId === accountId && candidate.visit.id === visitId
      );

      return owned === undefined
        ? Effect.fail(new VisitNotFound({ visitId }))
        : Effect.succeed(owned);
    });

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
    edit: (accountId, visitId, changes) =>
      ownedVisit(accountId, visitId).pipe(
        Effect.map((owned) => {
          const visit = { ...owned.visit, ...changes };

          stored.splice(stored.indexOf(owned), 1, { ...owned, visit });

          return visit;
        })
      ),
    log: (accountId, visit) =>
      Effect.sync(() => {
        logged += 1;
        const loggedAt = logged;
        const loggedVisit = { ...visit, id: `visit-${String(loggedAt)}` };

        stored.push({ accountId, loggedAt, visit: loggedVisit });

        return loggedVisit;
      }),
    remove: (accountId, visitId) =>
      ownedVisit(accountId, visitId).pipe(
        Effect.map((owned) => stored.splice(stored.indexOf(owned), 1)),
        Effect.asVoid
      ),
  });

  return { layer: Layer.merge(MemoryRestaurants, visits), stored };
};

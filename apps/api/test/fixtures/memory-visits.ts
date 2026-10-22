import {
  Restaurants,
  ReviewLikes,
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

interface StoredLike {
  readonly accountId: string;
  readonly visitId: string;
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
  const likes: StoredLike[] = [];
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
        Effect.flatMap((owned) =>
          Effect.sync(() => {
            stored.splice(stored.indexOf(owned), 1);
            likes.splice(
              0,
              likes.length,
              ...likes.filter((like) => like.visitId !== visitId)
            );
          })
        )
      ),
  });

  const unlike = (accountId: string, visitId: string) =>
    Effect.sync(() => {
      const index = likes.findIndex(
        (like) => like.accountId === accountId && like.visitId === visitId
      );

      if (index !== -1) {
        likes.splice(index, 1);
      }
    });

  const reviewLikes = Layer.succeed(ReviewLikes, {
    like: (accountId, visitId) =>
      unlike(accountId, visitId).pipe(
        Effect.andThen(
          Effect.sync(() => {
            likes.push({ accountId, visitId });
          })
        )
      ),
    likeTarget: (visitId) =>
      Effect.suspend(() => {
        const owned = stored.find(({ visit }) => visit.id === visitId);

        return owned === undefined
          ? Effect.fail(new VisitNotFound({ visitId }))
          : Effect.succeed({
              authorId: owned.accountId,
              hasReview: owned.visit.review !== null,
            });
      }),
    tallies: (accountId, visitIds) =>
      Effect.sync(
        () =>
          new Map(
            visitIds.flatMap((visitId) => {
              const liked = likes.filter((like) => like.visitId === visitId);

              return liked.length === 0
                ? []
                : [
                    [
                      visitId,
                      {
                        likeCount: liked.length,
                        likedByMe: liked.some(
                          (like) => like.accountId === accountId
                        ),
                      },
                    ] as const,
                  ];
            })
          )
      ),
    unlike,
  });

  return {
    layer: Layer.mergeAll(MemoryRestaurants, visits, reviewLikes),
    likes,
    stored,
  };
};

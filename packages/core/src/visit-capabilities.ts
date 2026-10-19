import { implement } from "@savour/capability/implement";
import { DateTime, Effect, Schema } from "effect";

import { requireSessionToken } from "./account-capabilities.js";
import { Accounts } from "./accounts.js";
import { InvalidRating } from "./invalid-rating.js";
import { InvalidVisitDate } from "./invalid-visit-date.js";
import type { Place } from "./place-schemas.js";
import { PlaceSearch } from "./place-search.js";
import { Restaurants } from "./restaurants.js";
import { diaryContract, logVisitContract } from "./visit-contracts.js";
import { Rating, VisitDate, diaryOrder } from "./visit-schemas.js";
import type { Visit } from "./visit-schemas.js";
import { Visits } from "./visits.js";

export const readDiaryAction = {
  description: "Read your diary with `GET /diary` and the bearer token.",
  href: "/diary",
  rel: "collection",
} as const;

export const logVisitAction = {
  description:
    "Log a visit with `POST /visits` and the bearer token, after finding the restaurant with `GET /restaurants/search`.",
  href: "/visits",
  rel: "create-form",
} as const;

const signedInAccountId = Effect.gen(function* signedInAccountId() {
  const accounts = yield* Accounts;
  const token = yield* requireSessionToken;
  const { accountId } = yield* accounts.accountForSession(token);

  return accountId;
});

const visitDayOf = (date: string) =>
  Effect.gen(function* checkVisitDay() {
    const day = yield* Schema.decodeEffect(VisitDate)(date).pipe(
      Effect.mapError(() => new InvalidVisitDate({ date, reason: "not-a-day" }))
    );

    const today = DateTime.formatIsoDateUtc(yield* DateTime.now);

    if (day > today) {
      return yield* new InvalidVisitDate({ date, reason: "in-the-future" });
    }

    return day;
  });

const ratingOf = (rating: number | undefined) =>
  rating === undefined
    ? Effect.succeed(null)
    : Schema.decodeEffect(Rating)(rating).pipe(
        Effect.mapError(() => new InvalidRating({ rating }))
      );

const PLACE_LOOKUPS = 4;

const placeOf = (
  placeId: string
): Effect.Effect<typeof Place.Type | null, never, PlaceSearch> =>
  PlaceSearch.use((placeSearch) => placeSearch.details(placeId)).pipe(
    Effect.catchTag("PlaceSearchUnavailable", () =>
      Effect.logWarning("diary.place_unresolved").pipe(
        Effect.annotateLogs({ placeId }),
        Effect.as(null)
      )
    )
  );

const withPlaces = (visits: readonly (typeof Visit.Type)[]) =>
  Effect.gen(function* resolvePlaces() {
    const placeIds = [
      ...new Set(visits.map(({ restaurant }) => restaurant.placeId)),
    ];

    const places = yield* Effect.forEach(placeIds, placeOf, {
      concurrency: PLACE_LOOKUPS,
    });

    const byPlaceId = new Map(
      placeIds.map((placeId, index) => [placeId, places[index] ?? null])
    );

    return visits.map((visit) => ({
      ...visit,
      place: byPlaceId.get(visit.restaurant.placeId) ?? null,
    }));
  });

export const logVisit = implement(logVisitContract, (input) =>
  Effect.gen(function* logVisitToDiary() {
    const accountId = yield* signedInAccountId;
    const date = yield* visitDayOf(input.date);
    const rating = yield* ratingOf(input.rating);
    const restaurants = yield* Restaurants;
    const restaurant = yield* restaurants.materialize(input.placeId);
    const visits = yield* Visits;

    const visit = yield* visits.log(accountId, {
      date,
      dishes: input.dishes ?? [],
      lovedIt: input.lovedIt ?? false,
      rating,
      restaurant,
      review: input.review ?? null,
      revisit: input.revisit ?? false,
      tags: input.tags ?? [],
    });

    yield* Effect.logInfo("visit.logged").pipe(
      Effect.annotateLogs({
        hasDishes: visit.dishes.length > 0,
        hasRating: visit.rating !== null,
        hasReview: visit.review !== null,
        visitId: visit.id,
      })
    );

    const place = yield* placeOf(visit.restaurant.placeId);

    return { next: [readDiaryAction], visit: { ...visit, place } };
  })
);

export const diary = implement(diaryContract, () =>
  Effect.gen(function* readDiary() {
    const accountId = yield* signedInAccountId;
    const visits = yield* Visits;
    const stored = yield* visits.diary(accountId);

    const visitsNewestFirst = stored
      .toSorted(diaryOrder)
      .map(({ visit }) => visit);

    return {
      next: [logVisitAction],
      visits: yield* withPlaces(visitsNewestFirst),
    };
  })
);

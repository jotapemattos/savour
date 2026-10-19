import {
  DatabaseUnavailable,
  Visit,
  Visits,
  currentRatingFrom,
} from "@savour/core";
import type { StoredVisit } from "@savour/core";
import { and, desc, eq } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Schema } from "effect";

import { restaurants, visits } from "./schema.js";

const decodeVisit = Schema.decodeUnknownEffect(Visit);

const unavailable =
  (event: string) =>
  <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.tapError((failure) =>
        Effect.logError(event).pipe(
          Effect.annotateLogs({ reason: failure._tag })
        )
      ),
      Effect.mapError(() => new DatabaseUnavailable({ reason: "unreachable" }))
    );

type RestaurantRow = Pick<
  typeof restaurants.$inferSelect,
  "id" | "placeId" | "source"
>;

const storedVisitOf = (
  row: typeof visits.$inferSelect,
  restaurant: RestaurantRow
) =>
  decodeVisit({
    date: row.visitedOn,
    dishes: row.dishes,
    id: row.id,
    lovedIt: row.lovedIt,
    rating: row.rating,
    restaurant,
    review: row.review,
    revisit: row.revisit,
    tags: row.tags,
  }).pipe(
    Effect.map((visit): StoredVisit => ({
      loggedAt: row.createdAt.getTime(),
      visit,
    })),
    Effect.mapError(
      () => new DatabaseUnavailable({ reason: "unexpected-answer" })
    )
  );

export const PostgresVisits = Layer.effect(
  Visits,
  Effect.gen(function* makePostgresVisits() {
    const db = yield* PgDrizzle.makeWithDefaults();

    const storedVisits = (accountId: string, restaurantId?: string) =>
      db
        .select({
          restaurant: {
            id: restaurants.id,
            placeId: restaurants.placeId,
            source: restaurants.source,
          },
          visit: visits,
        })
        .from(visits)
        .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
        .where(
          and(
            eq(visits.accountId, accountId),
            restaurantId === undefined
              ? undefined
              : eq(visits.restaurantId, restaurantId)
          )
        )
        .orderBy(desc(visits.visitedOn), desc(visits.createdAt))
        .pipe(
          unavailable("visit.read_failed"),
          Effect.flatMap(
            Effect.forEach(({ restaurant, visit }) =>
              storedVisitOf(visit, restaurant)
            )
          )
        );

    return Visits.of({
      currentRating: (accountId, restaurantId) =>
        storedVisits(accountId, restaurantId).pipe(
          Effect.map(currentRatingFrom)
        ),
      diary: (accountId) => storedVisits(accountId),
      log: (accountId, visit) =>
        db
          .insert(visits)
          .values({
            accountId,
            dishes: [...visit.dishes],
            lovedIt: visit.lovedIt,
            rating: visit.rating,
            restaurantId: visit.restaurant.id,
            review: visit.review,
            revisit: visit.revisit,
            tags: [...visit.tags],
            visitedOn: visit.date,
          })
          .returning()
          .pipe(
            unavailable("visit.log_failed"),
            Effect.flatMap(([row]) =>
              row === undefined
                ? Effect.fail(
                    new DatabaseUnavailable({ reason: "unexpected-answer" })
                  )
                : storedVisitOf(row, visit.restaurant)
            ),
            Effect.map(({ visit: logged }) => logged)
          ),
    });
  })
);

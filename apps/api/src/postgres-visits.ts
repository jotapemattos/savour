import {
  DatabaseUnavailable,
  Visit,
  VisitNotFound,
  Visits,
  currentRatingFrom,
} from "@savour/core";
import type { Restaurant, StoredVisit, VisitChanges } from "@savour/core";
import { and, desc, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Schema } from "effect";

import { restaurantColumns } from "./postgres-restaurants.js";
import type { RestaurantRow } from "./postgres-restaurants.js";
import { restaurants, visits } from "./schema.js";

const decodeVisit = Schema.decodeUnknownEffect(Visit);

const isVisitId = Schema.is(Schema.String.check(Schema.isUUID()));

const knownVisitId = (visitId: string): Effect.Effect<void, VisitNotFound> =>
  isVisitId(visitId)
    ? Effect.void
    : Effect.fail(new VisitNotFound({ visitId }));

const ownVisit = (accountId: string, visitId: string) =>
  and(eq(visits.accountId, accountId), eq(visits.id, visitId));

const columnsOf = ({ date, dishes, tags, ...same }: VisitChanges) => {
  const columns: Partial<typeof visits.$inferInsert> = { ...same };

  if (date !== undefined) {
    columns.visitedOn = date;
  }

  if (dishes !== undefined) {
    columns.dishes = [...dishes];
  }

  if (tags !== undefined) {
    columns.tags = [...tags];
  }

  return columns;
};

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

const storedVisitOf = (
  row: typeof visits.$inferSelect,
  restaurant: RestaurantRow | typeof Restaurant.Type
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

    const storedVisits = (where: SQL | undefined) =>
      db
        .select({
          restaurant: restaurantColumns,
          visit: visits,
        })
        .from(visits)
        .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
        .where(where)
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
        storedVisits(
          and(
            eq(visits.accountId, accountId),
            eq(visits.restaurantId, restaurantId)
          )
        ).pipe(Effect.map(currentRatingFrom)),
      diary: (accountId) => storedVisits(eq(visits.accountId, accountId)),
      edit: (accountId, visitId, changes) =>
        knownVisitId(visitId).pipe(
          Effect.andThen(() =>
            Object.keys(changes).length === 0
              ? Effect.void
              : db
                  .update(visits)
                  .set(columnsOf(changes))
                  .where(ownVisit(accountId, visitId))
                  .pipe(unavailable("visit.edit_failed"))
          ),
          Effect.andThen(() => storedVisits(ownVisit(accountId, visitId))),
          Effect.flatMap(([owned]) =>
            owned === undefined
              ? Effect.fail(new VisitNotFound({ visitId }))
              : Effect.succeed(owned.visit)
          )
        ),
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
      remove: (accountId, visitId) =>
        knownVisitId(visitId).pipe(
          Effect.andThen(() =>
            db
              .delete(visits)
              .where(ownVisit(accountId, visitId))
              .returning({ id: visits.id })
              .pipe(unavailable("visit.delete_failed"))
          ),
          Effect.flatMap((deleted) =>
            deleted.length === 0
              ? Effect.fail(new VisitNotFound({ visitId }))
              : Effect.void
          )
        ),
    });
  })
);

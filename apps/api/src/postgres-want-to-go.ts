import { DatabaseUnavailable, Restaurant, WantToGo } from "@savour/core";
import { and, desc, eq } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Schema } from "effect";

import { restaurants, wantToGo } from "./schema.js";

const decodeRestaurants = Schema.decodeUnknownEffect(Schema.Array(Restaurant));

const isRestaurantId = Schema.is(Schema.String.check(Schema.isUUID()));

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

export const PostgresWantToGo = Layer.effect(
  WantToGo,
  Effect.gen(function* makePostgresWantToGo() {
    const db = yield* PgDrizzle.makeWithDefaults();

    return WantToGo.of({
      add: (accountId, restaurantId) =>
        db
          .insert(wantToGo)
          .values({ accountId, restaurantId })
          .onConflictDoNothing()
          .pipe(unavailable("want_to_go.add_failed"), Effect.asVoid),
      list: (accountId) =>
        db
          .select({
            id: restaurants.id,
            placeId: restaurants.placeId,
            source: restaurants.source,
          })
          .from(wantToGo)
          .innerJoin(restaurants, eq(wantToGo.restaurantId, restaurants.id))
          .where(eq(wantToGo.accountId, accountId))
          .orderBy(desc(wantToGo.savedAt))
          .pipe(
            unavailable("want_to_go.read_failed"),
            Effect.flatMap((rows) =>
              decodeRestaurants(rows).pipe(
                Effect.mapError(
                  () => new DatabaseUnavailable({ reason: "unexpected-answer" })
                )
              )
            )
          ),
      remove: (accountId, restaurantId) =>
        isRestaurantId(restaurantId)
          ? db
              .delete(wantToGo)
              .where(
                and(
                  eq(wantToGo.accountId, accountId),
                  eq(wantToGo.restaurantId, restaurantId)
                )
              )
              .pipe(unavailable("want_to_go.remove_failed"), Effect.asVoid)
          : Effect.void,
    });
  })
);

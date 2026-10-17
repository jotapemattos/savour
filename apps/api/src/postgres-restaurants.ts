import {
  DatabaseUnavailable,
  PlaceId,
  Restaurant,
  Restaurants,
} from "@savour/core";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Schema } from "effect";

import { restaurants } from "./schema.js";

const decodePlaceId = Schema.decodeUnknownEffect(PlaceId);

const decodeRestaurant = Schema.decodeUnknownEffect(Restaurant);

export const PostgresRestaurants = Layer.effect(
  Restaurants,
  Effect.gen(function* makePostgresRestaurants() {
    const db = yield* PgDrizzle.makeWithDefaults();

    return Restaurants.of({
      materialize: (placeId) =>
        decodePlaceId(placeId).pipe(
          Effect.orDie,
          Effect.flatMap((validPlaceId) =>
            db
              .insert(restaurants)
              .values({ placeId: validPlaceId, source: "provider" })
              .onConflictDoUpdate({
                set: { placeId: validPlaceId },
                target: restaurants.placeId,
              })
              .returning({
                id: restaurants.id,
                placeId: restaurants.placeId,
                source: restaurants.source,
              })
          ),
          Effect.tapError((failure) =>
            Effect.logError("restaurant.materialize_failed").pipe(
              Effect.annotateLogs({ reason: failure._tag })
            )
          ),
          Effect.mapError(
            () => new DatabaseUnavailable({ reason: "unreachable" })
          ),
          Effect.flatMap(([row]) =>
            decodeRestaurant(row).pipe(
              Effect.mapError(
                () => new DatabaseUnavailable({ reason: "unexpected-answer" })
              )
            )
          )
        ),
    });
  })
);

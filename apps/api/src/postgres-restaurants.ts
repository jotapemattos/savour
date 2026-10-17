import {
  DatabaseUnavailable,
  PlaceId,
  Restaurant,
  Restaurants,
} from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

const decodePlaceId = Schema.decodeUnknownEffect(PlaceId);

const decodeRestaurantRows = Schema.decodeUnknownEffect(
  Schema.Tuple([Restaurant])
);

export const PostgresRestaurants = Layer.effect(
  Restaurants,
  Effect.gen(function* makePostgresRestaurants() {
    const sql = yield* SqlClient.SqlClient;

    return Restaurants.of({
      materialize: (placeId) =>
        decodePlaceId(placeId).pipe(
          Effect.orDie,
          Effect.flatMap(
            (validPlaceId) => sql`
              insert into restaurants (source, place_id)
              values ('provider', ${validPlaceId})
              on conflict (place_id) do update set place_id = excluded.place_id
              returning id::text as id, place_id as "placeId", source
            `
          ),
          Effect.tapError((failure) =>
            Effect.logError("restaurant.materialize_failed").pipe(
              Effect.annotateLogs({ reason: failure.reason._tag })
            )
          ),
          Effect.mapError(
            () => new DatabaseUnavailable({ reason: "unreachable" })
          ),
          Effect.flatMap((rows) =>
            decodeRestaurantRows(rows).pipe(
              Effect.mapError(
                () => new DatabaseUnavailable({ reason: "unexpected-answer" })
              )
            )
          ),
          Effect.map(([restaurant]) => restaurant)
        ),
    });
  })
);

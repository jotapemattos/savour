import {
  DatabaseUnavailable,
  PlaceId,
  ProviderRestaurant,
  Restaurant,
  RestaurantNotFound,
  Restaurants,
  UserAddedRestaurant,
} from "@savour/core";
import { and, desc, eq, sql } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Effect, Layer, Schema } from "effect";

import { restaurants } from "./schema.js";

export const USER_ADDED_MATCHES = 10;

const decodePlaceId = Schema.decodeUnknownEffect(PlaceId);

const isRestaurantId = Schema.is(Schema.String.check(Schema.isUUID()));

const knownRestaurantId = (
  restaurantId: string
): Effect.Effect<void, RestaurantNotFound> =>
  isRestaurantId(restaurantId)
    ? Effect.void
    : Effect.fail(new RestaurantNotFound({ restaurantId }));

export const restaurantColumns = {
  addedBy: restaurants.addedBy,
  address: restaurants.address,
  id: restaurants.id,
  name: restaurants.name,
  placeId: restaurants.placeId,
  source: restaurants.source,
};

export type RestaurantRow = Pick<
  typeof restaurants.$inferSelect,
  keyof typeof restaurantColumns
>;

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

const decodedAs =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (row: RestaurantRow | undefined) =>
    Schema.decodeUnknownEffect(schema)(row).pipe(
      Effect.mapError(
        () => new DatabaseUnavailable({ reason: "unexpected-answer" })
      )
    );

export const PostgresRestaurants = Layer.effect(
  Restaurants,
  Effect.gen(function* makePostgresRestaurants() {
    const db = yield* PgDrizzle.makeWithDefaults();

    return Restaurants.of({
      add: ({ addedBy, address, name }) =>
        db
          .insert(restaurants)
          .values({ addedBy, address, name, source: "user" })
          .returning(restaurantColumns)
          .pipe(
            unavailable("restaurant.add_failed"),
            Effect.flatMap(([row]) => decodedAs(UserAddedRestaurant)(row))
          ),
      addedByUsersMatching: (query) =>
        db
          .select(restaurantColumns)
          .from(restaurants)
          .where(
            and(
              eq(restaurants.source, "user"),
              sql`${query} <% ${restaurants.name}`
            )
          )
          .orderBy(
            desc(sql`word_similarity(${query}, ${restaurants.name})`),
            desc(sql`similarity(${query}, ${restaurants.name})`),
            restaurants.id
          )
          .limit(USER_ADDED_MATCHES)
          .pipe(
            unavailable("restaurant.search_failed"),
            Effect.flatMap(Effect.forEach(decodedAs(UserAddedRestaurant)))
          ),
      find: (restaurantId) =>
        Effect.gen(function* findRestaurant() {
          yield* knownRestaurantId(restaurantId);

          const [row] = yield* db
            .select(restaurantColumns)
            .from(restaurants)
            .where(eq(restaurants.id, restaurantId))
            .pipe(unavailable("restaurant.find_failed"));

          return row === undefined
            ? yield* new RestaurantNotFound({ restaurantId })
            : yield* decodedAs(Restaurant)(row);
        }),
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
              .returning(restaurantColumns)
          ),
          unavailable("restaurant.materialize_failed"),
          Effect.flatMap(([row]) => decodedAs(ProviderRestaurant)(row))
        ),
    });
  })
);

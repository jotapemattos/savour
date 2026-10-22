import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseUnavailable,
  RestaurantNotFound,
  Restaurants,
} from "@savour/core";
import { Effect, Exit, Layer, Logger, Redacted } from "effect";
import { SqlClient } from "effect/sql";

import { PostgresRestaurants } from "../src/postgres-restaurants.js";
import { PglitePostgres } from "./fixtures/pglite-postgres.js";

const UNREACHABLE_URL = "postgres://savour:sup3r-s3cret@127.0.0.1:1/savour";

type StructuredLog = ReturnType<typeof Logger.formatStructured.log>;

const RestaurantsOnPglite = Layer.provideMerge(
  PostgresRestaurants,
  PglitePostgres
);

const materialize = (placeId: string) =>
  Restaurants.use((restaurants) => restaurants.materialize(placeId));

const addByHand = (
  name: string,
  address = "Rua X, 10, Bragança Paulista - SP"
) =>
  Restaurants.use((restaurants) =>
    restaurants.add({ addedBy: "ana", address, name })
  );

const namesMatching = (query: string) =>
  Restaurants.use((restaurants) =>
    restaurants.addedByUsersMatching(query)
  ).pipe(Effect.map((found) => found.map(({ name }) => name)));

describe("Postgres restaurants store on Drizzle", () => {
  it.effect("adds a user-added restaurant and finds it by id", () =>
    Effect.gen(function* addsByHand() {
      const added = yield* addByHand("Bar do Zé");
      const found = yield* Restaurants.use((store) => store.find(added.id));

      expect(added).toStrictEqual({
        addedBy: "ana",
        address: "Rua X, 10, Bragança Paulista - SP",
        id: added.id,
        name: "Bar do Zé",
        source: "user",
      });
      expect(found).toStrictEqual(added);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("finds a provider restaurant by id", () =>
    Effect.gen(function* findsProvider() {
      const materialized = yield* materialize("ChIJbraganca");

      expect(
        yield* Restaurants.use((store) => store.find(materialized.id))
      ).toStrictEqual(materialized);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("answers RestaurantNotFound for an unknown id", () =>
    Effect.gen(function* refusesUnknownId() {
      const exits = yield* Effect.forEach(
        ["not-a-uuid", "6f1c1c6e-8f43-4c55-9b1e-0d6f7c1d2a3b"],
        (restaurantId) =>
          Restaurants.use((store) => store.find(restaurantId)).pipe(Effect.exit)
      );

      expect(exits).toStrictEqual([
        Exit.fail(new RestaurantNotFound({ restaurantId: "not-a-uuid" })),
        Exit.fail(
          new RestaurantNotFound({
            restaurantId: "6f1c1c6e-8f43-4c55-9b1e-0d6f7c1d2a3b",
          })
        ),
      ]);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("matches user-added names despite typos and partial names", () =>
    Effect.gen(function* matchesTrigrams() {
      yield* addByHand("Bar do Zé");
      yield* addByHand("Pastelaria Central");
      yield* materialize("ChIJbraganca");

      expect(yield* namesMatching("Bar do Zé")).toStrictEqual(["Bar do Zé"]);
      expect(yield* namesMatching("bar do ze")).toStrictEqual(["Bar do Zé"]);
      expect(yield* namesMatching("Pastelaria")).toStrictEqual([
        "Pastelaria Central",
      ]);
      expect(yield* namesMatching("pastelria centrl")).toStrictEqual([
        "Pastelaria Central",
      ]);
      expect(yield* namesMatching("sushi")).toStrictEqual([]);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("ranks the closest user-added name first", () =>
    Effect.gen(function* ranksMatches() {
      yield* addByHand("Bar do Zé Mineiro");
      yield* addByHand("Bar do Zé");

      expect(yield* namesMatching("Bar do Zé")).toStrictEqual([
        "Bar do Zé",
        "Bar do Zé Mineiro",
      ]);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("materializes a Restaurant keyed by place ID only once", () =>
    Effect.gen(function* materializesOnce() {
      const first = yield* materialize("ChIJbraganca");
      const second = yield* materialize("ChIJbraganca");
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql`select count(*)::int as count from restaurants`;

      expect(first).toStrictEqual(second);
      expect(first).toMatchObject({
        placeId: "ChIJbraganca",
        source: "provider",
      });
      expect(rows).toStrictEqual([{ count: 1 }]);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("keeps different places apart", () =>
    Effect.gen(function* keepsPlacesApart() {
      const braganca = yield* materialize("ChIJbraganca");
      const campinas = yield* materialize("ChIJcampinas");

      expect(braganca.id).not.toBe(campinas.id);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("fails with DatabaseUnavailable when Postgres is unreachable", () =>
    Effect.gen(function* failsUnreachable() {
      const entries: StructuredLog[] = [];

      const logs = Logger.layer([
        Logger.make((options) => {
          entries.push(Logger.formatStructured.log(options));
        }),
      ]);

      const unreachable = PostgresRestaurants.pipe(
        Layer.provide(
          PgClient.layer({
            connectTimeout: "1 second",
            url: Redacted.make(UNREACHABLE_URL),
          })
        )
      );

      const exit = yield* materialize("ChIJbraganca").pipe(
        Effect.provide(Layer.merge(unreachable, logs)),
        Effect.exit
      );

      expect(exit).toStrictEqual(
        Exit.fail(new DatabaseUnavailable({ reason: "unreachable" }))
      );
      expect(entries[0]).toMatchObject({
        level: "ERROR",
        message: "restaurant.materialize_failed",
      });
      expect(JSON.stringify(entries)).not.toContain("sup3r-s3cret");
    })
  );
});

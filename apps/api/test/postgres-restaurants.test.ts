import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { DatabaseUnavailable, Restaurants } from "@savour/core";
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

describe("Postgres restaurants store on Drizzle", () => {
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

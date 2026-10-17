import { describe, expect, it } from "@effect/vitest";
import { Restaurants } from "@savour/core";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

import { PostgresRestaurants } from "../src/postgres-restaurants.js";
import { MigratedPglite } from "./fixtures/pglite-sql.js";

const RestaurantsOnPglite = Layer.provideMerge(
  PostgresRestaurants,
  MigratedPglite
);

const materialize = (placeId: string) =>
  Restaurants.use((restaurants) => restaurants.materialize(placeId));

describe("Postgres restaurants store", () => {
  it.effect("materializes a Restaurant keyed by place ID only once", () =>
    Effect.gen(function* materializesOnce() {
      const first = yield* materialize("ChIJbraganca");
      const second = yield* materialize("ChIJbraganca");
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql`select id from restaurants`;

      expect(first).toStrictEqual(second);
      expect(first).toMatchObject({
        placeId: "ChIJbraganca",
        source: "provider",
      });
      expect(rows).toHaveLength(1);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );

  it.effect("keeps different places apart", () =>
    Effect.gen(function* keepsPlacesApart() {
      const braganca = yield* materialize("ChIJbraganca");
      const campinas = yield* materialize("ChIJcampinas");

      expect(braganca.id).not.toBe(campinas.id);
    }).pipe(Effect.provide(RestaurantsOnPglite))
  );
});

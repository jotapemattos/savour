import { describe, expect, it } from "@effect/vitest";
import { Rating, Restaurants, VisitDate, Visits } from "@savour/core";
import type { NewVisit } from "@savour/core";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { PostgresRestaurants } from "../src/postgres-restaurants.js";
import { PostgresVisits } from "../src/postgres-visits.js";
import { PglitePostgres } from "./fixtures/pglite-postgres.js";

const VisitsOnPglite = Layer.mergeAll(PostgresRestaurants, PostgresVisits).pipe(
  Layer.provideMerge(PglitePostgres)
);

const day = Schema.decodeSync(VisitDate);

const rated = Schema.decodeSync(Rating);

const logOn = (date: string, rating: number | null) =>
  Effect.gen(function* logVisitOn() {
    const restaurant = yield* Restaurants.use((store) =>
      store.materialize("ChIJbraganca")
    );

    const visit: NewVisit = {
      date: day(date),
      dishes: ["margherita"],
      lovedIt: false,
      rating: rating === null ? null : rated(rating),
      restaurant,
      review: null,
      revisit: true,
      tags: ["pizza"],
    };

    return yield* Visits.use((store) => store.log("account-ana", visit));
  });

describe("Postgres visits store on Drizzle", () => {
  it.effect("reads the diary newest visit date first", () =>
    Effect.gen(function* readsDiary() {
      yield* logOn("2026-10-09", 4);
      const early = yield* logOn("2026-10-01", 3.5);
      const diary = yield* Visits.use((store) => store.diary("account-ana"));

      expect(diary.map(({ visit }) => visit.date)).toStrictEqual([
        "2026-10-09",
        "2026-10-01",
      ]);
      expect(diary[1]?.visit).toStrictEqual(early);
      expect(
        yield* Visits.use((store) => store.diary("account-bia"))
      ).toStrictEqual([]);
    }).pipe(Effect.provide(VisitsOnPglite))
  );

  it.effect("answers the current rating from the latest rated visit", () =>
    Effect.gen(function* answersCurrentRating() {
      const { restaurant } = yield* logOn("2026-10-05", 4);
      yield* logOn("2026-10-09", null);

      expect(
        yield* Visits.use((store) =>
          store.currentRating("account-ana", restaurant.id)
        )
      ).toStrictEqual(Option.some(4));
    }).pipe(Effect.provide(VisitsOnPglite))
  );

  it.effect("stores the visit day in a date column", () =>
    Effect.gen(function* storesDateOnly() {
      yield* logOn("2026-10-10", null);
      const sql = yield* SqlClient.SqlClient;

      const columns = yield* sql`
        select data_type from information_schema.columns
        where table_name = 'visits' and column_name = 'visited_on'`;

      expect(columns).toStrictEqual([{ data_type: "date" }]);
    }).pipe(Effect.provide(VisitsOnPglite))
  );

  it.effect("refuses a rating off the half-star scale", () =>
    Effect.gen(function* refusesBadRating() {
      const { restaurant } = yield* logOn("2026-10-10", null);
      const sql = yield* SqlClient.SqlClient;

      const insert = yield* sql`
        insert into visits (account_id, restaurant_id, visited_on, rating, loved_it, revisit, tags, dishes)
        values ('account-ana', ${restaurant.id}, '2026-10-10', 4.25, false, false, '{}', '{}')`.pipe(
        Effect.as("inserted"),
        Effect.orElseSucceed(() => "refused")
      );

      expect(insert).toBe("refused");
    }).pipe(Effect.provide(VisitsOnPglite))
  );
});

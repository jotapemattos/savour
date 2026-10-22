import { describe, expect, it } from "@effect/vitest";
import {
  Restaurants,
  ReviewLikes,
  VisitDate,
  VisitNotFound,
  Visits,
} from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { PostgresRestaurants } from "../src/postgres-restaurants.js";
import { PostgresReviewLikes } from "../src/postgres-review-likes.js";
import { PostgresVisits } from "../src/postgres-visits.js";
import { PglitePostgres } from "./fixtures/pglite-postgres.js";

const LikesOnPglite = Layer.mergeAll(
  PostgresRestaurants,
  PostgresVisits,
  PostgresReviewLikes
).pipe(Layer.provideMerge(PglitePostgres));

const reviewBy = (accountId: string, review: string | null) =>
  Effect.gen(function* logReview() {
    const restaurant = yield* Restaurants.use((store) =>
      store.materialize("ChIJbraganca")
    );

    return yield* Visits.use((store) =>
      store.log(accountId, {
        date: Schema.decodeSync(VisitDate)("2026-10-10"),
        dishes: [],
        lovedIt: false,
        rating: null,
        restaurant,
        review,
        revisit: false,
        tags: [],
      })
    );
  });

const tallyOf = (accountId: string, visitId: string) =>
  ReviewLikes.use((store) => store.tallies(accountId, [visitId])).pipe(
    Effect.map((tallies) => tallies.get(visitId))
  );

describe("Postgres review likes store on Drizzle", () => {
  it.effect("counts one like per account however often it is sent", () =>
    Effect.gen(function* countsOnce() {
      const { id } = yield* reviewBy("account-bia", "Crispy crust.");

      yield* ReviewLikes.use((store) =>
        Effect.all(
          [
            store.like("account-ana", id),
            store.like("account-ana", id),
            store.like("account-caio", id),
          ],
          { concurrency: "unbounded" }
        )
      );

      expect(yield* tallyOf("account-ana", id)).toStrictEqual({
        likeCount: 2,
        likedByMe: true,
      });
      expect(yield* tallyOf("account-bia", id)).toStrictEqual({
        likeCount: 2,
        likedByMe: false,
      });
    }).pipe(Effect.provide(LikesOnPglite))
  );

  it.effect("takes the like back on unlike", () =>
    Effect.gen(function* unlikes() {
      const { id } = yield* reviewBy("account-bia", "Crispy crust.");

      yield* ReviewLikes.use((store) => store.like("account-ana", id));
      yield* ReviewLikes.use((store) => store.unlike("account-ana", id));
      yield* ReviewLikes.use((store) => store.unlike("account-ana", id));

      expect(yield* tallyOf("account-ana", id)).toBeUndefined();
    }).pipe(Effect.provide(LikesOnPglite))
  );

  it.effect("names the author and whether the visit has a review", () =>
    Effect.gen(function* readsTarget() {
      const reviewed = yield* reviewBy("account-bia", "Crispy crust.");
      const silent = yield* reviewBy("account-bia", null);

      const targets = yield* ReviewLikes.use((store) =>
        Effect.all([
          store.likeTarget(reviewed.id),
          store.likeTarget(silent.id),
          store.likeTarget("not-a-uuid").pipe(Effect.flip),
        ])
      );

      expect(targets).toStrictEqual([
        { authorId: "account-bia", hasReview: true },
        { authorId: "account-bia", hasReview: false },
        new VisitNotFound({ visitId: "not-a-uuid" }),
      ]);
    }).pipe(Effect.provide(LikesOnPglite))
  );

  it.effect("deletes a visit's likes with the visit", () =>
    Effect.gen(function* cascades() {
      const { id } = yield* reviewBy("account-bia", "Crispy crust.");

      yield* ReviewLikes.use((store) => store.like("account-ana", id));
      yield* Visits.use((store) => store.remove("account-bia", id));

      const sql = yield* SqlClient.SqlClient;
      const left = yield* sql`select visit_id from review_likes`;

      expect(left).toStrictEqual([]);
    }).pipe(Effect.provide(LikesOnPglite))
  );
});

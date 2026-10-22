import { describe, expect, it } from "@effect/vitest";
import { Restaurants, WantToGo } from "@savour/core";
import { Effect, Layer } from "effect";

import { PostgresRestaurants } from "../src/postgres-restaurants.js";
import { PostgresWantToGo } from "../src/postgres-want-to-go.js";
import { PglitePostgres } from "./fixtures/pglite-postgres.js";

const WantToGoOnPglite = Layer.mergeAll(
  PostgresRestaurants,
  PostgresWantToGo
).pipe(Layer.provideMerge(PglitePostgres));

const saved = (placeId: string) =>
  Effect.gen(function* saveRestaurant() {
    const restaurant = yield* Restaurants.use((store) =>
      store.materialize(placeId)
    );

    yield* WantToGo.use((store) => store.add("account-ana", restaurant.id));

    return restaurant;
  });

const listOf = (accountId: string) =>
  WantToGo.use((store) => store.list(accountId));

describe("Postgres want-to-go store on Drizzle", () => {
  it.effect("lists the newest saved restaurant first, once each", () =>
    Effect.gen(function* listsNewestFirst() {
      const braganca = yield* saved("ChIJbraganca");
      const campinas = yield* saved("ChIJcampinas");

      yield* saved("ChIJbraganca");

      expect(yield* listOf("account-ana")).toStrictEqual([campinas, braganca]);
      expect(yield* listOf("account-bia")).toStrictEqual([]);
    }).pipe(Effect.provide(WantToGoOnPglite))
  );

  it.effect("removes only the given account's restaurant", () =>
    Effect.gen(function* removesOwnEntry() {
      const braganca = yield* saved("ChIJbraganca");

      yield* WantToGo.use((store) => store.remove("account-bia", braganca.id));

      expect(yield* listOf("account-ana")).toStrictEqual([braganca]);

      yield* WantToGo.use((store) => store.remove("account-ana", braganca.id));
      yield* WantToGo.use((store) => store.remove("account-ana", "not-a-uuid"));

      expect(yield* listOf("account-ana")).toStrictEqual([]);
    }).pipe(Effect.provide(WantToGoOnPglite))
  );
});

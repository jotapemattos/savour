import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Database,
  RemovedFromWantToGo,
  SavedToWantToGo,
  SignedIn,
  Unauthenticated,
  WantToGoList,
  addToWantToGoAction,
  readWantToGoAction,
  removeFromWantToGoAction,
} from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { HttpBody, HttpClient, HttpRouter } from "effect/http";

import { apiRoutes } from "../src/app.js";
import {
  FakePlaceSearch,
  pizzariaBraganca,
} from "./fixtures/fake-place-search.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";
import { memoryVisits } from "./fixtures/memory-visits.js";
import { MemoryWantToGo } from "./fixtures/memory-want-to-go.js";

const ServedApi = HttpRouter.serve(
  apiRoutes.pipe(
    Layer.provide(MemoryAccounts),
    Layer.provide(FakePlaceSearch),
    Layer.provide(memoryVisits().layer),
    Layer.provide(MemoryWantToGo),
    Layer.provide(Layer.succeed(Database, { selectOne: Effect.succeed<1>(1) }))
  ),
  { disableListenLog: true, disableLogger: true }
).pipe(Layer.provideMerge(NodeHttpServer.layerTest), withTestRuntime);

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

const signUpAna = Effect.gen(function* signUp() {
  const response = yield* HttpClient.post("/accounts", {
    body: HttpBody.jsonUnsafe({
      email: "ana@example.test",
      handle: "ana",
      password: "correct horse 9",
    }),
  });

  return (yield* Schema.decodeUnknownEffect(SignedIn)(yield* response.json))
    .session.token;
});

const addAs = (token: string, placeId: string) =>
  HttpClient.post("/want-to-go", {
    body: HttpBody.jsonUnsafe({ placeId }),
    headers: bearer(token),
  }).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(SavedToWantToGo))
  );

const removeAs = (token: string, restaurantId: string) =>
  HttpClient.del(`/want-to-go/${restaurantId}`, { headers: bearer(token) });

const listOf = (token: string) =>
  HttpClient.get("/want-to-go", { headers: bearer(token) }).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(WantToGoList))
  );

const placeIdsOf = (list: typeof WantToGoList.Type) =>
  list.restaurants.map(({ restaurant }) => restaurant.placeId);

describe("want-to-go", () => {
  it.effect("adds a restaurant", () =>
    Effect.gen(function* addsRestaurant() {
      const token = yield* signUpAna;
      const added = yield* addAs(token, "ChIJbraganca");
      const list = yield* listOf(token);

      expect(added.next).toStrictEqual([
        readWantToGoAction,
        removeFromWantToGoAction,
      ]);
      expect(list.restaurants).toStrictEqual([
        {
          place: pizzariaBraganca,
          restaurant: {
            id: "restaurant-ChIJbraganca",
            placeId: "ChIJbraganca",
            source: "provider",
          },
        },
      ]);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("removes a restaurant", () =>
    Effect.gen(function* removesRestaurant() {
      const token = yield* signUpAna;
      const { saved } = yield* addAs(token, "ChIJbraganca");
      const response = yield* removeAs(token, saved.restaurant.id);

      expect(response.status).toBe(200);
      expect(
        yield* Schema.decodeUnknownEffect(RemovedFromWantToGo)(
          yield* response.json
        )
      ).toStrictEqual({ next: [readWantToGoAction, addToWantToGoAction] });
      expect((yield* listOf(token)).restaurants).toStrictEqual([]);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("is idempotent on add", () =>
    Effect.gen(function* addsOnce() {
      const token = yield* signUpAna;

      yield* addAs(token, "ChIJbraganca");
      yield* addAs(token, "ChIJbraganca");

      expect(placeIdsOf(yield* listOf(token))).toStrictEqual(["ChIJbraganca"]);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("lists newest saved first", () =>
    Effect.gen(function* listsNewestFirst() {
      const token = yield* signUpAna;

      yield* addAs(token, "ChIJbraganca");
      yield* addAs(token, "ChIJcampinas");

      expect(placeIdsOf(yield* listOf(token))).toStrictEqual([
        "ChIJcampinas",
        "ChIJbraganca",
      ]);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("keeps a restaurant after a visit to it is logged", () =>
    Effect.gen(function* keepsAfterVisit() {
      const token = yield* signUpAna;

      yield* addAs(token, "ChIJbraganca");
      yield* HttpClient.post("/visits", {
        body: HttpBody.jsonUnsafe({
          date: "2026-10-01",
          placeId: "ChIJbraganca",
        }),
        headers: bearer(token),
      });

      expect(placeIdsOf(yield* listOf(token))).toStrictEqual(["ChIJbraganca"]);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("requires sign-in to change the list", () =>
    Effect.gen(function* refusesAnonymous() {
      const responses = yield* Effect.all([
        HttpClient.post("/want-to-go", {
          body: HttpBody.jsonUnsafe({ placeId: "ChIJbraganca" }),
        }),
        HttpClient.del("/want-to-go/restaurant-ChIJbraganca"),
        HttpClient.get("/want-to-go"),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
        expect(
          yield* Schema.decodeUnknownEffect(Unauthenticated)(
            yield* response.json
          )
        ).toStrictEqual(new Unauthenticated());
      }
    }).pipe(Effect.provide(ServedApi))
  );
});

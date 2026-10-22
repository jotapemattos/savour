import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  AddedRestaurant,
  Database,
  InvalidRestaurant,
  LoggedVisit,
  SignedIn,
  Unauthenticated,
  logVisitToRestaurantAction,
} from "@savour/core";
import { Effect, Layer, Logger, Schema } from "effect";
import { HttpBody, HttpClient, HttpRouter } from "effect/http";
import { TestClock } from "effect/testing";

import { apiRoutes } from "../src/app.js";
import { FakePlaceSearch } from "./fixtures/fake-place-search.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";
import { memoryVisits } from "./fixtures/memory-visits.js";

type StructuredLog = ReturnType<typeof Logger.formatStructured.log>;

const barDoZe = {
  address: "Rua X, 10, Bragança Paulista - SP",
  name: "Bar do Zé",
};

const served = () => {
  const visits = memoryVisits();
  const logs: StructuredLog[] = [];

  const layer = HttpRouter.serve(
    apiRoutes.pipe(
      Layer.provide(MemoryAccounts),
      Layer.provide(FakePlaceSearch),
      Layer.provide(visits.layer),
      Layer.provide(
        Layer.succeed(Database, { selectOne: Effect.succeed<1>(1) })
      )
    ),
    { disableListenLog: true, disableLogger: true }
  ).pipe(
    Layer.provide(
      Logger.layer([
        Logger.make((options) => {
          logs.push(Logger.formatStructured.log(options));
        }),
      ])
    ),
    Layer.provideMerge(NodeHttpServer.layerTest),
    withTestRuntime
  );

  return { layer, logs, visits };
};

const signUpAs = (handle: string) =>
  HttpClient.post("/accounts", {
    body: HttpBody.jsonUnsafe({
      email: `${handle}@example.test`,
      handle,
      password: "correct horse 9",
    }),
  }).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(SignedIn)),
    Effect.map(({ session }) => session.token)
  );

const addAs = (token: string | null, body: typeof barDoZe) =>
  HttpClient.post("/restaurants", {
    body: HttpBody.jsonUnsafe(body),
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });

const addedBy = (token: string, body: typeof barDoZe) =>
  addAs(token, body).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(AddedRestaurant))
  );

describe("add a missing restaurant", () => {
  it.effect("creates a user-added restaurant", () => {
    const api = served();

    return Effect.gen(function* createsUserAdded() {
      const token = yield* signUpAs("ana");
      const added = yield* addedBy(token, barDoZe);

      expect(added.restaurant).toStrictEqual({
        addedBy: "ana",
        address: "Rua X, 10, Bragança Paulista - SP",
        id: added.restaurant.id,
        name: "Bar do Zé",
        source: "user",
      });
      expect(
        api.logs.find(({ message }) => message === "restaurant.user_added")
      ).toMatchObject({
        annotations: { handle: "ana", restaurantId: added.restaurant.id },
        level: "INFO",
      });
    }).pipe(Effect.provide(api.layer));
  });

  it.effect("trims the name and address", () =>
    Effect.gen(function* trimsText() {
      const token = yield* signUpAs("ana");

      const added = yield* addedBy(token, {
        address: "  Rua X, 10  ",
        name: " Bar do Zé ",
      });

      expect(added.restaurant).toMatchObject({
        address: "Rua X, 10",
        name: "Bar do Zé",
      });
    }).pipe(Effect.provide(served().layer))
  );

  it.effect("is loggable immediately", () =>
    Effect.gen(function* logsAddedRestaurant() {
      yield* TestClock.setTime(Date.parse("2026-10-22T12:00:00Z"));

      const token = yield* signUpAs("ana");
      const added = yield* addedBy(token, barDoZe);

      expect(added.next).toStrictEqual([
        logVisitToRestaurantAction(added.restaurant.id),
      ]);

      const logged = yield* HttpClient.post("/visits", {
        body: HttpBody.jsonUnsafe({
          date: "2026-10-22",
          restaurantId: added.restaurant.id,
        }),
        headers: { authorization: `Bearer ${token}` },
      }).pipe(
        Effect.flatMap((response) => response.json),
        Effect.flatMap(Schema.decodeUnknownEffect(LoggedVisit))
      );

      expect(logged.visit.restaurant).toStrictEqual(added.restaurant);
    }).pipe(Effect.provide(served().layer))
  );

  it.effect("requires name and address", () => {
    const api = served();

    return Effect.gen(function* refusesBlankText() {
      const token = yield* signUpAs("ana");

      const refusals = yield* Effect.forEach(
        [
          { ...barDoZe, name: "" },
          { ...barDoZe, address: "   " },
          { ...barDoZe, name: "x".repeat(201) },
        ],
        (body) =>
          addAs(token, body).pipe(
            Effect.flatMap((response) => {
              expect(response.status).toBe(400);

              return response.json;
            }),
            Effect.flatMap(Schema.decodeUnknownEffect(InvalidRestaurant))
          )
      );

      expect(refusals).toStrictEqual([
        new InvalidRestaurant({ field: "name" }),
        new InvalidRestaurant({ field: "address" }),
        new InvalidRestaurant({ field: "name" }),
      ]);
      expect(api.visits.restaurants).toStrictEqual([]);
    }).pipe(Effect.provide(api.layer));
  });

  it.effect("requires sign-in", () => {
    const api = served();

    return Effect.gen(function* refusesSignedOut() {
      const response = yield* addAs(null, barDoZe);

      expect(response.status).toBe(401);
      expect(
        yield* Schema.decodeUnknownEffect(Unauthenticated)(yield* response.json)
      ).toStrictEqual(new Unauthenticated());
      expect(api.visits.restaurants).toStrictEqual([]);
    }).pipe(Effect.provide(api.layer));
  });
});

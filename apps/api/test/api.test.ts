import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Database,
  PlaceSearchUnavailable,
  RestaurantSearchResults,
  addRestaurantAction,
  DatabaseHealthReport,
  DatabaseUnavailable,
  HealthReport,
  capabilities,
  databaseHealthNextActions,
  healthNextActions,
} from "@savour/core";
import type { PlaceSearch } from "@savour/core";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpClient, HttpRouter } from "effect/http";

import { apiRoutes } from "../src/app.js";
import {
  FakePlaceSearch,
  pizzariaBraganca,
  recordingPlaceSearch,
} from "./fixtures/fake-place-search.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";
import { memoryVisits } from "./fixtures/memory-visits.js";

const decodeHealth = Schema.decodeUnknownEffect(HealthReport);

const decodeDatabaseHealth = Schema.decodeUnknownEffect(DatabaseHealthReport);

const decodeUnavailable = Schema.decodeUnknownEffect(DatabaseUnavailable);

const decodeOpenApi = Schema.decodeUnknownEffect(
  Schema.Struct({ paths: Schema.Record(Schema.String, Schema.Unknown) })
);

const serveApi = (
  selectOne: Database["Service"]["selectOne"],
  places: Layer.Layer<PlaceSearch> = FakePlaceSearch
) =>
  HttpRouter.serve(
    apiRoutes.pipe(
      Layer.provide(Layer.succeed(Database, { selectOne })),
      Layer.provide(MemoryAccounts),
      Layer.provide(places),
      Layer.provide(memoryVisits().layer)
    ),
    { disableListenLog: true, disableLogger: true }
  ).pipe(Layer.provideMerge(NodeHttpServer.layerTest), withTestRuntime);

const ServedApi = serveApi(Effect.succeed(1));

describe("savour api", () => {
  it.effect("serves a health route with next-action links", () =>
    Effect.gen(function* servesHealth() {
      const response = yield* HttpClient.get("/health");

      expect(response.status).toBe(200);
      expect(yield* decodeHealth(yield* response.json)).toStrictEqual({
        next: healthNextActions,
        service: "savour-api",
        status: "ok",
      });
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("publishes the OpenAPI document with every capability", () =>
    Effect.gen(function* publishesOpenApi() {
      const response = yield* HttpClient.get("/openapi.json");
      const document = yield* decodeOpenApi(yield* response.json);

      expect(response.status).toBe(200);
      expect(Object.keys(document.paths)).toStrictEqual(
        capabilities.map((capability) => capability.contract.http.path)
      );
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("answers select 1 through the database port", () =>
    Effect.gen(function* servesDatabaseHealth() {
      const response = yield* HttpClient.get("/health/database");

      expect(response.status).toBe(200);
      expect(yield* decodeDatabaseHealth(yield* response.json)).toStrictEqual({
        next: databaseHealthNextActions,
        result: 1,
        status: "ok",
      });
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("answers 503 DatabaseUnavailable when the database is down", () =>
    Effect.gen(function* servesDatabaseUnavailable() {
      const response = yield* HttpClient.get("/health/database");

      expect(response.status).toBe(503);
      expect(yield* decodeUnavailable(yield* response.json)).toStrictEqual(
        new DatabaseUnavailable({ reason: "unreachable" })
      );
    }).pipe(
      Effect.provide(
        serveApi(
          Effect.fail(new DatabaseUnavailable({ reason: "unreachable" }))
        )
      )
    )
  );

  it.effect("answers an unknown route with 404", () =>
    Effect.gen(function* rejectsUnknownRoute() {
      const response = yield* HttpClient.get("/nope");

      expect(response.status).toBe(404);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("serves restaurant search with the add-a-restaurant link", () =>
    Effect.gen(function* servesSearch() {
      const response = yield* HttpClient.get("/restaurants/search", {
        urlParams: { q: "pizzaria bragança paulista" },
      });

      expect(response.status).toBe(200);
      expect(
        yield* Schema.decodeUnknownEffect(RestaurantSearchResults)(
          yield* response.json
        )
      ).toStrictEqual({
        next: [addRestaurantAction],
        results: [pizzariaBraganca],
      });
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("answers 503 PlaceSearchUnavailable when the provider fails", () =>
    Effect.gen(function* servesSearchUnavailable() {
      const response = yield* HttpClient.get("/restaurants/search", {
        urlParams: { q: "offline" },
      });

      expect(response.status).toBe(503);
      expect(
        yield* Schema.decodeUnknownEffect(PlaceSearchUnavailable)(
          yield* response.json
        )
      ).toStrictEqual(new PlaceSearchUnavailable({ reason: "unreachable" }));
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("refuses an empty search with 400", () =>
    Effect.gen(function* refusesEmptySearch() {
      const response = yield* HttpClient.get("/restaurants/search", {
        urlParams: { q: "   " },
      });

      expect(response.status).toBe(400);
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("biases search toward the near location", () => {
    const places = recordingPlaceSearch();

    return Effect.gen(function* servesNearSearch() {
      const response = yield* HttpClient.get("/restaurants/search", {
        urlParams: { near: "-22.95,-46.54", q: "pizzaria" },
      });

      expect(response.status).toBe(200);
      expect(places.nears).toStrictEqual([
        Option.some({ latitude: -22.95, longitude: -46.54 }),
      ]);
    }).pipe(Effect.provide(serveApi(Effect.succeed(1), places.layer)));
  });

  it.effect("refuses a location outside the globe with 400", () => {
    const places = recordingPlaceSearch();

    return Effect.gen(function* refusesBadNear() {
      const statuses: number[] = [];

      for (const near of ["-91,10", "abc"]) {
        const response = yield* HttpClient.get("/restaurants/search", {
          urlParams: { near, q: "pizzaria" },
        });

        statuses.push(response.status);
      }

      expect(statuses).toStrictEqual([400, 400]);
      expect(places.nears).toStrictEqual([]);
    }).pipe(Effect.provide(serveApi(Effect.succeed(1), places.layer)));
  });
});

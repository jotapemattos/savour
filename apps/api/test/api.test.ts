import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Database,
  DatabaseHealthReport,
  DatabaseUnavailable,
  HealthReport,
  capabilities,
  databaseHealthNextActions,
  healthNextActions,
} from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpRouter } from "effect/http";

import { apiRoutes } from "../src/app.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";

const decodeHealth = Schema.decodeUnknownEffect(HealthReport);

const decodeDatabaseHealth = Schema.decodeUnknownEffect(DatabaseHealthReport);

const decodeUnavailable = Schema.decodeUnknownEffect(DatabaseUnavailable);

const decodeOpenApi = Schema.decodeUnknownEffect(
  Schema.Struct({ paths: Schema.Record(Schema.String, Schema.Unknown) })
);

const serveApi = (selectOne: Database["Service"]["selectOne"]) =>
  HttpRouter.serve(
    apiRoutes.pipe(
      Layer.provide(Layer.succeed(Database, { selectOne })),
      Layer.provide(MemoryAccounts)
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
});

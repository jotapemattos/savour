import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { HealthReport, capabilities, healthNextActions } from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpRouter } from "effect/http";

import { apiRoutes } from "../src/app.js";

const decodeHealth = Schema.decodeUnknownEffect(HealthReport);

const decodeOpenApi = Schema.decodeUnknownEffect(
  Schema.Struct({ paths: Schema.Record(Schema.String, Schema.Unknown) })
);

const ServedApi = HttpRouter.serve(apiRoutes, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

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
        capabilities.map((capability) => `/${capability.contract.name}`)
      );
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("answers an unknown route with 404", () =>
    Effect.gen(function* rejectsUnknownRoute() {
      const response = yield* HttpClient.get("/nope");

      expect(response.status).toBe(404);
    }).pipe(Effect.provide(ServedApi))
  );
});

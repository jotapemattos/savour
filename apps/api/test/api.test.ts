import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { HealthReport, healthNextActions } from "@savour/core";
import { EventSinkMemory, memoryEventsLayer } from "@savour/events/memory";
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpRouter } from "effect/http";
import * as HttpServerRequest from "effect/http/HttpServerRequest";

import { apiRoutes, capturedApiApp } from "../src/app.js";

const decodeHealth = Schema.decodeUnknownEffect(HealthReport);

const decodeOpenApi = Schema.decodeUnknownEffect(
  Schema.Struct({ paths: Schema.Record(Schema.String, Schema.Unknown) })
);

const ServedApi = HttpRouter.serve(apiRoutes, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

const requestTo = (path: string) =>
  HttpServerRequest.fromWeb(
    new Request(`https://api.savour.test${path}`, {
      headers: { "cf-connecting-ip": "203.0.113.7", "user-agent": "api-test" },
    })
  );

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

  it.effect("publishes the OpenAPI document", () =>
    Effect.gen(function* publishesOpenApi() {
      const response = yield* HttpClient.get("/openapi.json");

      expect(response.status).toBe(200);
      expect(
        Object.keys((yield* decodeOpenApi(yield* response.json)).paths)
      ).toContain("/health");
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("records one request event per HTTP request", () =>
    Effect.gen(function* recordsEvents() {
      const app = yield* capturedApiApp({
        identityMode: "daily",
        runInBackground: (effect) => effect,
      });

      const serveHealth = app.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          requestTo("/health")
        )
      );

      yield* serveHealth;
      yield* serveHealth;

      const events = yield* (yield* EventSinkMemory).events;

      expect(events).toHaveLength(2);
      expect(events).toMatchObject([
        { body: { path: "/health", status: 200, type: "request" } },
        { body: { path: "/health", status: 200, type: "request" } },
      ]);
    }).pipe(Effect.provide(memoryEventsLayer("test-salt")))
  );
});

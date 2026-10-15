import { describe, expect, it } from "@effect/vitest";
import { healthNextActions } from "@savour/core";
import { EventSinkMemory, memoryEventsLayer } from "@savour/events/memory";
import { Effect } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { apiApp, capturedApiApp } from "../src/app.js";

const requestTo = (path: string) =>
  HttpServerRequest.fromWeb(
    new Request(`https://api.savour.test${path}`, {
      headers: { "cf-connecting-ip": "203.0.113.7", "user-agent": "api-test" },
    })
  );

const serve = <E, R>(
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  path: string
) =>
  app.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, requestTo(path)),
    Effect.map((response) => HttpServerResponse.toWeb(response))
  );

describe("savour api", () => {
  it.effect("serves a health route with next-action links", () =>
    Effect.gen(function* servesHealth() {
      const app = yield* apiApp;
      const response = yield* serve(app, "/health");

      expect(response.status).toBe(200);
      expect(
        yield* Effect.promise(async () => await response.json())
      ).toStrictEqual({
        next: healthNextActions,
        service: "savour-api",
        status: "ok",
      });
    })
  );

  it.effect("records one request event per HTTP request", () =>
    Effect.gen(function* recordsEvents() {
      const app = yield* capturedApiApp({
        identityMode: "daily",
        runInBackground: (effect) => effect,
      });

      yield* serve(app, "/health");
      yield* serve(app, "/health");

      const events = yield* (yield* EventSinkMemory).events;

      expect(events).toHaveLength(2);
      expect(events).toMatchObject([{ path: "/health" }, { path: "/health" }]);
    }).pipe(Effect.provide(memoryEventsLayer("test-salt")))
  );

  it.effect("publishes the OpenAPI document", () =>
    Effect.gen(function* publishesOpenApi() {
      const app = yield* apiApp;
      const response = yield* serve(app, "/openapi.json");

      expect(response.status).toBe(200);
      expect(
        yield* Effect.promise(async () => await response.text())
      ).toContain('"/health"');
    })
  );
});

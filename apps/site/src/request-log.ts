import { Clock, Effect } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/http/HttpServerResponse";

export const observeRequestLog = <E, R>(
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>
) =>
  Effect.gen(function* observeRequest() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const started = yield* Clock.currentTimeMillis;
    const response = yield* app;
    const finished = yield* Clock.currentTimeMillis;

    yield* Effect.logInfo("HTTP request", {
      method: request.method,
      ms: finished - started,
      path: new URL(request.url, "https://ratstack.sh").pathname,
      status: response.status,
    });

    return response;
  });

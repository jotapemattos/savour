import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { healthNextActions } from "@savour/core";
import { Flags, eventFlags } from "@savour/core/flags";
import { CallLog, OutcomeSchema, devtoolsLayer } from "@savour/devtools";
import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpRouter, HttpServer } from "effect/http";
import { HttpApiClient } from "effect/http-api";

import {
  capabilities,
  devtoolsRoutes,
  http,
  routes,
  serverLayer,
} from "../src/surfaces.js";

const decodeOpenApi = Schema.decodeUnknownSync(
  Schema.Struct({ paths: Schema.Record(Schema.String, Schema.Unknown) })
);

const AppLayer = HttpRouter.serve(routes, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(
  Layer.provide(Flags.defaults(eventFlags)),
  Layer.provideMerge(NodeHttpServer.layerTest)
);

describe("serve routes", () => {
  it.effect(
    "evaluates declared flag defaults through the generated REST client",
    () =>
      Effect.gen(function* readsFlagOverHttp() {
        const client = yield* HttpApiClient.make(http.api);
        const flags = yield* client.capabilities.listFlags({ payload: {} });
        expect(flags.map((flag) => flag.name)).toStrictEqual(
          eventFlags.map((flag) => flag.name)
        );
        expect(
          yield* client.capabilities.getFlag({
            payload: { context: {}, name: "EVENTS_ENABLED" },
          })
        ).toBe(false);
        expect(
          yield* client.capabilities.getFlag({
            payload: { context: {}, name: "EVENTS_IDENTITY_MODE" },
          })
        ).toBe("daily");
      }).pipe(Effect.provide(AppLayer))
  );

  it.effect("binds serve to the loopback interface only", () =>
    Effect.gen(function* bindsLoopback() {
      const server = yield* HttpServer.HttpServer;

      expect(HttpServer.formatAddress(server.address)).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+$/u
      );
    }).pipe(Effect.provide(serverLayer(0)))
  );

  it.effect("publishes the OpenAPI document and the docs page", () =>
    Effect.gen(function* publishesDocs() {
      const openapi = yield* HttpClient.get("/openapi.json");
      expect(openapi.status).toBe(200);
      const document = decodeOpenApi(yield* openapi.json);
      expect(Object.keys(document.paths)).toEqual(
        capabilities.map((capability) => `/${capability.contract.name}`)
      );

      const docs = yield* HttpClient.get("/docs");
      expect(docs.status).toBe(200);
      expect(docs.headers["content-type"]).toContain("text/html");
    }).pipe(Effect.provide(AppLayer))
  );

  it.effect("runs a capability through the generated client", () =>
    Effect.gen(function* runsCapability() {
      const client = yield* HttpApiClient.make(http.api);

      const report = yield* client.capabilities.health({ query: {} });

      const error = yield* client.capabilities
        .getFlag({ payload: { context: {}, name: "NOT_A_FLAG" } })
        .pipe(Effect.flip);

      expect(report).toStrictEqual({
        next: healthNextActions,
        service: "savour-api",
        status: "ok",
      });
      expect(error._tag).toBe("UnknownFlag");
    }).pipe(Effect.provide(AppLayer))
  );

  it.effect("records REST calls when served with devtools", () =>
    Effect.gen(function* recordsRestCalls() {
      const client = yield* HttpApiClient.make(http.api);
      yield* client.capabilities.health({ query: {} });

      const { entries } = yield* (yield* CallLog).snapshot;

      const [entry] = entries;

      expect(entries).toHaveLength(1);
      expect(entry).toMatchObject({ capability: "health", input: {} });
      expect(
        entry !== undefined && OutcomeSchema.guards.Succeeded(entry.outcome)
          ? entry.outcome.output
          : undefined
      ).toMatchObject({ service: "savour-api", status: "ok" });
    }).pipe(
      Effect.provide(
        HttpRouter.serve(devtoolsRoutes, {
          disableListenLog: true,
          disableLogger: true,
        }).pipe(
          Layer.provide(Flags.defaults(eventFlags)),
          Layer.provideMerge(NodeHttpServer.layerTest),
          Layer.provideMerge(devtoolsLayer())
        )
      )
    )
  );
});

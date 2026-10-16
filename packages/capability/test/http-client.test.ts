import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { makeHttpApiClient } from "../src/http-client.js";
import { toHttpApi } from "../src/index.js";
import { Greeter, NotFound, echo, greet } from "./fixtures.js";

const projection = toHttpApi("ClientApi", [echo, greet]);

const ServedApi = HttpRouter.serve(
  HttpApiBuilder.layer(projection.api).pipe(
    Layer.provide(projection.layer),
    Layer.provide(Greeter.layer)
  ),
  { disableListenLog: true, disableLogger: true }
).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

const contractsOnlyClient = makeHttpApiClient(
  "ClientApi",
  [echo.contract, greet.contract],
  ""
);

describe("makeHttpApiClient", () => {
  it.effect("calls a capability from its contract alone", () =>
    Effect.gen(function* callsFromContract() {
      const client = yield* contractsOnlyClient;

      const output = yield* client.capabilities.echo({
        payload: { text: "ab", times: 2 },
      });

      expect(output).toStrictEqual({ text: "abab" });
    }).pipe(Effect.provide(ServedApi))
  );

  it.effect("decodes a declared failure into its schema", () =>
    Effect.gen(function* decodesFailure() {
      const client = yield* contractsOnlyClient;

      const failure = yield* Effect.flip(
        client.capabilities.greet({ payload: { name: "nobody" } })
      );

      expect(failure).toStrictEqual(new NotFound({ name: "nobody" }));
    }).pipe(Effect.provide(ServedApi))
  );
});

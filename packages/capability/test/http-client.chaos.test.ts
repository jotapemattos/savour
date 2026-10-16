import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { makeHttpApiClient } from "../src/http-client.js";
import {
  Approval,
  ApprovalDenied,
  defineContract,
  implement,
  toHttpApi,
} from "../src/index.js";
import { approved } from "./fixtures.js";

const itemContract = defineContract("item", {
  description: "Read an item by its slug",
  failure: Schema.Never,
  http: { method: "GET", path: "/items/:item" },
  input: Schema.Struct({ item: Schema.String, view: Schema.String }),
  output: Schema.Struct({ item: Schema.String, view: Schema.String }),
});

const renameContract = defineContract("rename", {
  description: "Rename an item",
  failure: Schema.Never,
  http: { method: "PUT", path: "/items/:item/name" },
  input: Schema.Struct({ item: Schema.String, name: Schema.String }),
  output: Schema.Struct({ item: Schema.String, name: Schema.String }),
});

const item = implement(itemContract, (input) => Effect.succeed(input));

const rename = implement(renameContract, (input) => Effect.succeed(input));

const routes = toHttpApi("RoutedApi", [item, rename]);

const RoutedServer = HttpRouter.serve(
  HttpApiBuilder.layer(routes.api).pipe(Layer.provide(routes.layer)),
  { disableListenLog: true, disableLogger: true }
).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

const approvalProjection = toHttpApi("ApprovalApi", [approved]);

const DenyingServer = HttpRouter.serve(
  HttpApiBuilder.layer(approvalProjection.api).pipe(
    Layer.provide(approvalProjection.layer),
    Layer.provide(Approval.denyAll)
  ),
  { disableListenLog: true, disableLogger: true }
).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

describe("contracts-only client against hostile inputs", () => {
  describe("contract: routed endpoints", () => {
    it.effect(
      "sends path params and query for a routed GET, with hostile text",
      () =>
        Effect.gen(function* routedGet() {
          const client = yield* makeHttpApiClient(
            "RoutedApi",
            [itemContract, renameContract],
            ""
          );

          const output = yield* client.capabilities.item({
            params: { item: "café 🍜/ç" },
            query: { view: "a&b=c" },
          });

          expect(output).toStrictEqual({ item: "café 🍜/ç", view: "a&b=c" });
        }).pipe(Effect.provide(RoutedServer))
    );

    it.effect("sends path params and body for a routed PUT", () =>
      Effect.gen(function* routedPut() {
        const client = yield* makeHttpApiClient(
          "RoutedApi",
          [itemContract, renameContract],
          ""
        );

        const output = yield* client.capabilities.rename({
          params: { item: "osteria" },
          payload: { name: '<b>Osteria</b> "Nonna"' },
        });

        expect(output).toStrictEqual({
          item: "osteria",
          name: '<b>Osteria</b> "Nonna"',
        });
      }).pipe(Effect.provide(RoutedServer))
    );
  });

  describe("unexpected state: approval is denied", () => {
    it.effect("decodes the denial into ApprovalDenied", () =>
      Effect.gen(function* deniedApproval() {
        const client = yield* makeHttpApiClient(
          "ApprovalApi",
          [approved.contract],
          ""
        );

        const failure = yield* Effect.flip(
          client.capabilities.approved({ payload: { message: "go" } })
        );

        expect(failure).toBeInstanceOf(ApprovalDenied);
      }).pipe(Effect.provide(DenyingServer))
    );
  });
});

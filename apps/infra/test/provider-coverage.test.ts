import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { AuthProviders, Stage } from "alchemy";
import { AlchemyContextLive } from "alchemy/AlchemyContext";
import { tryFindProviderRegistrationByType } from "alchemy/Provider";
import { ConfigProvider, Effect, Layer, Option, Schema } from "effect";
import * as HttpClient from "effect/http/HttpClient";

import stack from "../alchemy.run.js";

const services = Layer.mergeAll(
  AlchemyContextLive.pipe(Layer.provideMerge(NodeServices.layer)),
  Layer.succeed(Stage, "staging"),
  Layer.succeed(AuthProviders, {}),
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() =>
      Effect.die("provider-coverage-must-not-call-cloud-api")
    )
  )
);

it.effect.prop(
  "the Stack declares one Api Worker and a provider for every resource, with events on and off",
  { events: Schema.Boolean },
  ({ events }) =>
    Effect.gen(function* checkStackProviders() {
      for (const eventsEnabled of [events, !events]) {
        const compiled = yield* stack.pipe(
          Effect.provide(services),
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ EVENTS_ENABLED: eventsEnabled })
          )
        );

        const resources = Object.values(compiled.resources);

        expect(
          resources
            .filter((resource) => resource.Type === "Cloudflare.Worker")
            .map((resource) => resource.LogicalId)
        ).toStrictEqual(["Api"]);

        for (const resource of resources) {
          const provider = yield* tryFindProviderRegistrationByType(
            resource.Type
          ).pipe(Effect.provideContext(compiled.services));

          expect(
            Option.isSome(provider),
            `${resource.FQN}: provider missing for ${resource.Type}; EVENTS_ENABLED=${eventsEnabled}`
          ).toBe(true);
        }

        for (const action of Object.values(compiled.actions)) {
          expect(action.Kind, action.FQN).toBe("action");
          expect(action.Run, action.FQN).toBeTypeOf("function");
        }
      }
    }),
  { arbitrary: { runs: 2 } }
);

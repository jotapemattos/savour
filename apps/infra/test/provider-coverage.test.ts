import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { AuthProviders, Stage } from "alchemy";
import { AlchemyContextLive } from "alchemy/AlchemyContext";
import { tryFindProviderRegistrationByType } from "alchemy/Provider";
import {
  Cause,
  ConfigProvider,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
} from "effect";
import * as HttpClient from "effect/http/HttpClient";

import stack from "../alchemy.run.js";

const decodeBranchName = Schema.decodeUnknownSync(
  Schema.Struct({ name: Schema.String })
);

const decodeProjectRetention = Schema.decodeUnknownSync(
  Schema.Struct({ historyRetentionSeconds: Schema.Finite })
);

const withPlacesKey = (env: Readonly<Record<string, string>>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(env));

const services = Layer.mergeAll(
  withPlacesKey({ GOOGLE_PLACES_API_KEY: "test-key" }),
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

it.effect(
  "the staging Stack declares the Workers, a Neon branch behind Hyperdrive, no D1, and a provider for every resource",
  () =>
    Effect.gen(function* checkStackProviders() {
      const compiled = yield* stack.pipe(Effect.provide(services));
      const resources = Object.values(compiled.resources);

      expect(
        resources
          .filter((resource) => resource.Type === "Cloudflare.Worker")
          .map((resource) => resource.LogicalId)
      ).toStrictEqual(["Api", "Web"]);

      expect(
        resources
          .filter((resource) => resource.Type !== "Cloudflare.Worker")
          .map((resource) => [resource.LogicalId, resource.Type])
      ).toStrictEqual([
        ["Neon", "Neon.Project"],
        ["Database", "Neon.Branch"],
        ["Hyperdrive", "Cloudflare.Hyperdrive"],
        ["BetterAuthSecret", "Alchemy.Random"],
      ]);
      expect(
        decodeProjectRetention(compiled.resources.Neon?.Props)
          .historyRetentionSeconds
      ).toBe(21_600);
      expect(decodeBranchName(compiled.resources.Database?.Props).name).toBe(
        "staging"
      );
      expect(
        resources.filter((resource) =>
          resource.Type.startsWith("Cloudflare.D1")
        )
      ).toStrictEqual([]);

      for (const resource of resources) {
        const provider = yield* tryFindProviderRegistrationByType(
          resource.Type
        ).pipe(Effect.provideContext(compiled.services));

        expect(
          Option.isSome(provider),
          `${resource.FQN}: provider missing for ${resource.Type}`
        ).toBe(true);
      }

      for (const action of Object.values(compiled.actions)) {
        expect(action.Kind, action.FQN).toBe("action");
        expect(action.Run, action.FQN).toBeTypeOf("function");
      }
    })
);

it.effect(
  "the staging Stack refuses to compile without a Google Places key",
  () =>
    Effect.gen(function* refusesWithoutPlacesKey() {
      const exit = yield* stack.pipe(
        Effect.provide(Layer.merge(services, withPlacesKey({}))),
        Effect.exit
      );

      expect(
        Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "compiled"
      ).toContain("GOOGLE_PLACES_API_KEY");
    })
);

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { AuthProviders, Stage } from "alchemy";
import { AlchemyContextLive } from "alchemy/AlchemyContext";
import { tryFindProviderRegistrationByType } from "alchemy/Provider";
import { Effect, Layer, Option, Schema } from "effect";
import * as HttpClient from "effect/http/HttpClient";

import stack from "../alchemy.run.js";

const decodeBranchName = Schema.decodeUnknownSync(
  Schema.Struct({ name: Schema.String })
);

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
      ]);
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

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as Alchemy from "alchemy";
import { importStack, StackModuleLoader } from "alchemy/Alchemist/Session";
import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import { collection } from "alchemy/Provider";
import { Stage } from "alchemy/Stage";
import { inMemoryState } from "alchemy/State";
import { Effect, Layer, Schema } from "effect";
import * as Arbitrary from "effect/Arbitrary";

import previewDefinition, { previewProgram } from "../alchemy.preview.js";
import { PreviewStage, previewResourcesAllowed } from "../src/preview.js";

it.effect("loads the preview through Alchemy's entrypoint boundary", () =>
  importStack("alchemy.preview.ts").pipe(
    Effect.provideService(StackModuleLoader, {
      // @effect-diagnostics-next-line asyncFunction:off -- Alchemy's module loader is a native Promise boundary.
      import: async () => await Promise.resolve({ default: previewDefinition }),
    }),
    Effect.provide(NodeServices.layer)
  )
);

it.effect.prop(
  "preview declarations contain only the Api Worker",
  { stage: Arbitrary.schema(PreviewStage) },
  ({ stage }) =>
    Alchemy.Stack(
      "SavourPreview",
      {
        providers: Layer.effect(Cloudflare.Providers, collection([])),
        state: inMemoryState(),
      },
      previewProgram
    ).pipe(
      Effect.tap((stack) =>
        Effect.sync(() => {
          expect(previewResourcesAllowed(stack.resources)).toBe(true);
          expect(Object.keys(stack.resources)).toStrictEqual(["Api"]);
        })
      ),
      Effect.provideService(Stage, stage),
      Effect.provideService(AlchemyContext, {
        adopt: false,
        dev: false,
        dotAlchemy: ".alchemy",
      }),
      Effect.provide(NodeServices.layer),
      Effect.scoped,
      Effect.asVoid
    )
);

it.prop(
  "preview rejects every additional resource, including prod-only resources",
  {
    id: Schema.NonEmptyString,
    type: Schema.Literals([
      "Cloudflare.Zone",
      "Cloudflare.DNS.Record",
      "Cloudflare.Email.Routing",
      "Cloudflare.Ruleset",
      "Cloudflare.R2.Bucket",
      "Cloudflare.Worker",
    ]),
  },
  ({ id, type }) => {
    expect(
      previewResourcesAllowed({
        Api: { Type: "Cloudflare.Worker" },
        [`extra/${id}`]: { Type: type },
      })
    ).toBe(false);
  }
);

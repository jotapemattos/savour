import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as Alchemy from "alchemy";
import { importStack, StackModuleLoader } from "alchemy/Alchemist/Session";
import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
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

const compilePreview = (stage: string) =>
  Alchemy.Stack(
    "SavourPreview",
    {
      providers: Layer.effect(Cloudflare.Providers, collection([])),
      state: inMemoryState(),
    },
    previewProgram
  ).pipe(
    Effect.provideService(Stage, stage),
    Effect.provideService(AlchemyContext, {
      adopt: false,
      dev: false,
      dotAlchemy: ".alchemy",
    }),
    Effect.provide(NodeServices.layer),
    Effect.scoped
  );

const OutputValue = Schema.declare((value): value is Output.Output =>
  Output.isOutput(value)
);

const BranchProps = Schema.Struct({
  name: Schema.String,
  parentBranch: OutputValue,
  project: Schema.Struct({ projectId: OutputValue }),
  protected: Schema.optional(Schema.Boolean),
});

const HyperdriveProps = Schema.Struct({ origin: OutputValue });

const decodeBranchProps = Schema.decodeUnknownSync(BranchProps);

const decodeHyperdriveProps = Schema.decodeUnknownSync(HyperdriveProps);

const refTarget = (value: Output.Output) =>
  Output.isRefExpr(value)
    ? { id: value.resourceId, stack: value.stack, stage: value.stage }
    : undefined;

const refProp = (value: Output.Output) =>
  Output.isPropExpr(value) && Output.isOutput(value.expr)
    ? { prop: value.identifier, ref: refTarget(value.expr) }
    : undefined;

const propSource = (value: Output.Output) =>
  Output.isPropExpr(value) && Output.isResourceExpr(value.expr)
    ? { id: value.expr.src.LogicalId, prop: value.identifier }
    : undefined;

it.effect.prop(
  "preview declares the Api Worker, its own Neon branch and a Hyperdrive config on it",
  { stage: Arbitrary.schema(PreviewStage) },
  ({ stage }) =>
    compilePreview(stage).pipe(
      Effect.tap((stack) =>
        Effect.sync(() => {
          const branch = decodeBranchProps(stack.resources.Database?.Props);

          const hyperdrive = decodeHyperdriveProps(
            stack.resources.Hyperdrive?.Props
          );

          expect(previewResourcesAllowed(stack.resources)).toBe(true);
          expect(Object.keys(stack.resources)).toStrictEqual([
            "Api",
            "Database",
            "Hyperdrive",
          ]);
          expect(branch.name).toBe(stage);
          expect(refTarget(branch.parentBranch)).toStrictEqual({
            id: "Database",
            stack: "Savour",
            stage: "staging",
          });
          expect(propSource(hyperdrive.origin)).toStrictEqual({
            id: "Database",
            prop: "origin",
          });
        })
      ),
      Effect.asVoid
    )
);

it.effect.prop(
  "preview owns only its branch, so destroying the stage deletes that branch and nothing shared",
  { stage: Arbitrary.schema(PreviewStage) },
  ({ stage }) =>
    compilePreview(stage).pipe(
      Effect.tap((stack) =>
        Effect.sync(() => {
          const neonResources = Object.values(stack.resources).filter(
            (resource) => resource.Type.startsWith("Neon.")
          );

          expect(
            neonResources.map((resource) => resource.LogicalId)
          ).toStrictEqual(["Database"]);
          const branch = decodeBranchProps(neonResources[0]?.Props);

          expect(neonResources[0]?.Type).toBe("Neon.Branch");
          expect(branch.protected).toBeUndefined();
          expect(refProp(branch.project.projectId)).toStrictEqual({
            prop: "projectId",
            ref: { id: "Database", stack: "Savour", stage: "staging" },
          });
        })
      ),
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
      "Cloudflare.D1.Database",
      "Neon.Project",
    ]),
  },
  ({ id, type }) => {
    expect(
      previewResourcesAllowed({
        Api: { Type: "Cloudflare.Worker" },
        Database: { Type: "Neon.Branch" },
        Hyperdrive: { Type: "Cloudflare.Hyperdrive" },
        [`extra/${id}`]: { Type: type },
      })
    ).toBe(false);
  }
);

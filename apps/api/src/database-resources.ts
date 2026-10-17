import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import { Effect, Schema } from "effect";

export const DATABASE_OWNER_STAGE = "staging";

export const FREE_TIER_HISTORY_RETENTION_SECONDS = 21_600;

export const PreviewStage = Schema.String.check(
  Schema.isPattern(/^pr-[1-9][0-9]*$/u)
);

const isPreviewStage = Schema.is(PreviewStage);

const migrationsDirectory = () =>
  new URL("../migrations", import.meta.url).pathname;

const ownedBranch = (stage: string) =>
  Effect.gen(function* declareOwnedBranch() {
    const project = yield* Neon.Project("Neon", {
      historyRetentionSeconds: FREE_TIER_HISTORY_RETENTION_SECONDS,
    });

    return yield* Neon.Branch("Database", {
      migrations: migrationsDirectory(),
      name: stage,
      project,
    });
  });

const previewBranch = (stage: string) =>
  Effect.gen(function* declarePreviewBranch() {
    const staging = yield* Neon.Branch.ref("Database", {
      stack: "Savour",
      stage: DATABASE_OWNER_STAGE,
    });

    return yield* Neon.Branch("Database", {
      migrations: migrationsDirectory(),
      name: stage,
      parentBranch: staging,
      project: { projectId: staging.projectId },
    });
  });

export const DatabaseBranch = Effect.gen(function* declareDatabaseBranch() {
  const { stage } = yield* Alchemy.Stack;

  return yield* isPreviewStage(stage)
    ? previewBranch(stage)
    : ownedBranch(stage);
});

export const DatabaseConnection = Effect.gen(
  function* declareDatabaseConnection() {
    const branch = yield* DatabaseBranch;

    return yield* Cloudflare.Hyperdrive.Connection("Hyperdrive", {
      caching: { disabled: true },
      origin: branch.origin,
    });
  }
);

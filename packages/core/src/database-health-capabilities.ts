import { implement } from "@savour/capability/implement";
import { Clock, Effect } from "effect";

import { databaseHealthContract } from "./database-health-contracts.js";
import { Database } from "./database.js";

export const databaseHealthNextActions = [
  {
    description: "Read whether the Savour API itself is up.",
    href: "/health",
    rel: "up",
  },
] as const;

export const databaseHealth = implement(databaseHealthContract, () =>
  Effect.gen(function* checkDatabaseHealth() {
    const database = yield* Database;
    const startedAt = yield* Clock.currentTimeMillis;

    const result = yield* database.selectOne.pipe(
      Effect.tapError((failure) =>
        Effect.logError("database.health_checked").pipe(
          Effect.annotateLogs({ failure: failure._tag, reason: failure.reason })
        )
      )
    );

    const latencyMs = (yield* Clock.currentTimeMillis) - startedAt;

    yield* Effect.logInfo("database.health_checked").pipe(
      Effect.annotateLogs({ latencyMs })
    );

    return {
      next: databaseHealthNextActions,
      result,
      status: "ok" as const,
    };
  })
);

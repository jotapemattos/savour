import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Logger, Schema } from "effect";

import {
  Database,
  DatabaseUnavailable,
  databaseHealth,
  databaseHealthNextActions,
  healthNextActions,
} from "../src/index.js";

const decodeLatency = Schema.decodeUnknownSync(
  Schema.Struct({ latencyMs: Schema.Finite })
);

type StructuredLog = ReturnType<typeof Logger.formatStructured.log>;

const capturedLogs = () => {
  const entries: StructuredLog[] = [];

  const layer = Logger.layer([
    Logger.make((options) => {
      entries.push(Logger.formatStructured.log(options));
    }),
  ]);

  return { entries, layer };
};

const databaseAnswering = (selectOne: Database["Service"]["selectOne"]) =>
  Layer.succeed(Database, { selectOne });

describe("databaseHealth", () => {
  it.effect("answers 1 with a link back to the API health", () =>
    Effect.gen(function* answersOne() {
      const logs = capturedLogs();

      const report = yield* databaseHealth
        .handler({})
        .pipe(
          Effect.provide(
            Layer.merge(databaseAnswering(Effect.succeed(1)), logs.layer)
          )
        );

      expect(report).toStrictEqual({
        next: databaseHealthNextActions,
        result: 1,
        status: "ok",
      });
      expect(logs.entries).toHaveLength(1);
      expect(logs.entries[0]).toMatchObject({
        level: "INFO",
        message: "database.health_checked",
      });
      expect(
        decodeLatency(logs.entries[0]?.annotations).latencyMs
      ).toBeGreaterThanOrEqual(0);
    })
  );

  it.effect(
    "fails with DatabaseUnavailable and logs the failure at Error",
    () =>
      Effect.gen(function* failsUnavailable() {
        const logs = capturedLogs();
        const unavailable = new DatabaseUnavailable({ reason: "unreachable" });

        const exit = yield* databaseHealth
          .handler({})
          .pipe(
            Effect.provide(
              Layer.merge(
                databaseAnswering(Effect.fail(unavailable)),
                logs.layer
              )
            ),
            Effect.exit
          );

        expect(exit).toStrictEqual(Exit.fail(unavailable));
        expect(logs.entries).toHaveLength(1);
        expect(logs.entries[0]).toMatchObject({
          annotations: {
            failure: "DatabaseUnavailable",
            reason: "unreachable",
          },
          level: "ERROR",
          message: "database.health_checked",
        });
      })
  );

  it("is linked from the API health next actions", () => {
    expect(healthNextActions.map((action) => action.href)).toContain(
      "/health/database"
    );
  });
});

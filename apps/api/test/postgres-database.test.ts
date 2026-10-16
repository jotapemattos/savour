import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { Database, DatabaseUnavailable } from "@savour/core";
import { Effect, Exit, Layer, Logger, Redacted, Stream } from "effect";
import { Reactivity } from "effect/reactivity";
import { SqlClient } from "effect/sql";
import type { SqlConnection } from "effect/sql";

import { PostgresDatabase } from "../src/postgres-database.js";

const UNREACHABLE_URL = "postgres://savour:sup3r-s3cret@127.0.0.1:1/savour";

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

const answering = (rows: readonly object[]): SqlConnection.Connection => ({
  execute: () => Effect.succeed(rows),
  executeRaw: () => Effect.succeed(rows),
  executeStream: () => Stream.fromIterable(rows),
  executeUnprepared: () => Effect.succeed(rows),
  executeValues: () => Effect.succeed([]),
  executeValuesUnprepared: () => Effect.succeed([]),
});

const sqlAnswering = (rows: readonly object[]) =>
  Layer.effect(
    SqlClient.SqlClient,
    SqlClient.make({
      acquirer: Effect.succeed(answering(rows)),
      compiler: PgClient.makeCompiler(),
      spanAttributes: [],
    })
  ).pipe(Layer.provide(Reactivity.layer));

const selectOne = Database.use((database) => database.selectOne);

describe("Hyperdrive Postgres adapter", () => {
  it.effect("answers 1 when Postgres answers select 1", () =>
    Effect.gen(function* answersOne() {
      const result = yield* selectOne.pipe(
        Effect.provide(
          PostgresDatabase.pipe(Layer.provide(sqlAnswering([{ one: 1 }])))
        )
      );

      expect(result).toBe(1);
    })
  );

  it.effect("fails with unexpected-answer when the row is not 1", () =>
    Effect.gen(function* failsUnexpectedAnswer() {
      const exit = yield* selectOne.pipe(
        Effect.provide(
          PostgresDatabase.pipe(Layer.provide(sqlAnswering([{ one: 2 }])))
        ),
        Effect.exit
      );

      expect(exit).toStrictEqual(
        Exit.fail(new DatabaseUnavailable({ reason: "unexpected-answer" }))
      );
    })
  );

  it.effect(
    "fails with unreachable through the real driver and never logs the connection string",
    () =>
      Effect.gen(function* failsUnreachable() {
        const logs = capturedLogs();

        const unreachableDatabase = PostgresDatabase.pipe(
          Layer.provide(
            PgClient.layer({
              connectTimeout: "1 second",
              url: Redacted.make(UNREACHABLE_URL),
            })
          )
        );

        const exit = yield* selectOne.pipe(
          Effect.provide(Layer.merge(unreachableDatabase, logs.layer)),
          Effect.exit
        );

        expect(exit).toStrictEqual(
          Exit.fail(new DatabaseUnavailable({ reason: "unreachable" }))
        );
        expect(logs.entries).toHaveLength(1);
        expect(logs.entries[0]).toMatchObject({
          annotations: { reason: "ConnectionError" },
          level: "ERROR",
          message: "database.connection_failed",
        });
        expect(JSON.stringify(logs.entries)).not.toContain("sup3r-s3cret");
        expect(JSON.stringify(logs.entries)).not.toContain(UNREACHABLE_URL);
      })
  );
});

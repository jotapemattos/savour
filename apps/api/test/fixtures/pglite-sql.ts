import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { PGlite } from "@electric-sql/pglite";
import { Effect, FileSystem, Layer, Stream } from "effect";
import { Reactivity } from "effect/reactivity";
import { SqlClient } from "effect/sql";
import type { SqlConnection } from "effect/sql";

const migration = new URL(
  "../../migrations/0001_restaurants.sql",
  import.meta.url
).pathname;

const connectionOver = (db: PGlite): SqlConnection.Connection => {
  const rows = (sql: string, params: readonly unknown[]) =>
    // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
    Effect.promise(() => db.query<object>(sql, [...params])).pipe(
      Effect.map((result) => result.rows)
    );

  const values = (sql: string, params: readonly unknown[]) =>
    Effect.promise(
      // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
      () => db.query<unknown[]>(sql, [...params], { rowMode: "array" })
    ).pipe(Effect.map((result) => result.rows));

  return {
    execute: rows,
    executeRaw: rows,
    executeStream: (sql, params) =>
      Stream.fromIterableEffect(rows(sql, params)),
    executeUnprepared: rows,
    executeValues: values,
    executeValuesUnprepared: values,
  };
};

export const MigratedPglite = Layer.effect(
  SqlClient.SqlClient,
  Effect.gen(function* makeMigratedPglite() {
    const fs = yield* FileSystem.FileSystem;
    const migrationSql = yield* fs.readFileString(migration);
    const db = new PGlite();

    // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
    yield* Effect.promise(() => db.exec(migrationSql));

    return yield* SqlClient.make({
      acquirer: Effect.succeed(connectionOver(db)),
      compiler: PgClient.makeCompiler(),
      spanAttributes: [],
    });
  })
).pipe(Layer.provide(Layer.merge(Reactivity.layer, NodeServices.layer)));

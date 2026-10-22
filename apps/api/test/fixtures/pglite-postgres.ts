import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { pg_trgm as pgTrgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { Effect, FileSystem, Layer, Path, Redacted } from "effect";

export const migrationsDirectory = new URL("../../migrations", import.meta.url)
  .pathname;

export const migratedPglite = Effect.gen(function* migratePglite() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const db = yield* Effect.acquireRelease(
    Effect.sync(() => new PGlite({ extensions: { pg_trgm: pgTrgm } })),
    (pglite) =>
      // oxlint-disable-next-line typescript/promise-function-async -- PGlite closes through a native Promise.
      Effect.promise(() => pglite.close())
  );

  const migrations = (yield* fs.readDirectory(migrationsDirectory)).toSorted();

  for (const migration of migrations) {
    const sql = yield* fs.readFileString(
      path.join(migrationsDirectory, migration, "migration.sql")
    );

    // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
    yield* Effect.promise(() => db.exec(sql));
  }

  return db;
});

const servedPglite = Effect.gen(function* servePglite() {
  const db = yield* migratedPglite;

  const server = yield* Effect.acquireRelease(
    Effect.sync(() => new PGLiteSocketServer({ db, port: 0 })),
    (socketServer) =>
      // oxlint-disable-next-line typescript/promise-function-async -- The PGlite socket server stops through a native Promise.
      Effect.promise(() => socketServer.stop())
  );

  // oxlint-disable-next-line typescript/promise-function-async -- The PGlite socket server starts through a native Promise.
  yield* Effect.promise(() => server.start());

  return Redacted.make(
    `postgres://postgres:postgres@${server.getServerConn()}/postgres`
  );
});

export const PglitePostgres = Layer.unwrap(
  servedPglite.pipe(
    Effect.map((url) => PgClient.layer({ maxConnections: 1, url }))
  )
).pipe(Layer.provide(NodeServices.layer));

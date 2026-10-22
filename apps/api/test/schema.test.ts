import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  generateDrizzleJson,
  generateMigration,
} from "drizzle-kit/api-postgres";
import { Effect, FileSystem, Path, Schema } from "effect";

import * as schema from "../src/schema.js";
import {
  migratedPglite,
  migrationsDirectory,
} from "./fixtures/pglite-postgres.js";

const decodeSnapshotJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
);

const latestSnapshot = Effect.gen(function* readLatestSnapshot() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const migrations = (yield* fs.readDirectory(migrationsDirectory)).toSorted();
  const latest = migrations.at(-1) ?? "";

  const committed = yield* decodeSnapshotJson(
    yield* fs.readFileString(
      path.join(migrationsDirectory, latest, "snapshot.json")
    )
  );

  // SAFETY: `drizzle-kit generate` wrote this snapshot.json at the same pinned drizzle-kit version that reads it here.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return committed as Parameters<typeof generateMigration>[0];
});

describe("restaurants schema", () => {
  it.effect("has no changes missing from the committed migrations", () =>
    Effect.gen(function* matchesMigrations() {
      const committed = yield* latestSnapshot;

      const current = yield* Effect.promise(
        // oxlint-disable-next-line typescript/promise-function-async -- drizzle-kit's API answers with native Promises.
        () => generateDrizzleJson(schema)
      );

      const pending = yield* Effect.promise(
        // oxlint-disable-next-line typescript/promise-function-async -- drizzle-kit's API answers with native Promises.
        () => generateMigration(committed, current)
      );

      expect(pending).toStrictEqual([]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("generates the restaurants table from schema.ts", () =>
    Effect.gen(function* createsRestaurants() {
      const db = yield* migratedPglite;

      const unique = yield* Effect.promise(
        // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
        () =>
          db.query<{ indexdef: string }>(
            "select indexdef from pg_indexes where tablename = 'restaurants'"
          )
      );

      const orphan = yield* Effect.promise(
        // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
        () =>
          db.query("insert into restaurants (source) values ('provider')").then(
            () => "inserted",
            () => "refused"
          )
      );

      const unsigned = yield* Effect.promise(
        // oxlint-disable-next-line typescript/promise-function-async -- PGlite answers queries as native Promises.
        () =>
          db
            .query(
              "insert into restaurants (source, name, address) values ('user', 'Bar do Zé', 'Rua X, 10')"
            )
            .then(
              () => "inserted",
              () => "refused"
            )
      );

      expect(
        unique.rows.some(
          ({ indexdef }) =>
            indexdef.includes("USING gin") && indexdef.includes("gin_trgm_ops")
        )
      ).toBe(true);
      expect(unsigned).toBe("refused");
      expect(
        unique.rows.some(
          ({ indexdef }) =>
            indexdef.includes("UNIQUE INDEX") && indexdef.includes("place_id")
        )
      ).toBe(true);
      expect(orphan).toBe("refused");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

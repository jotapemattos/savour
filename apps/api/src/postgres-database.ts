import { Database, DatabaseUnavailable } from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

const SelectOneRows = Schema.Tuple([Schema.Struct({ one: Schema.Literal(1) })]);

const decodeSelectOneRows = Schema.decodeUnknownEffect(SelectOneRows);

export const PostgresDatabase = Layer.effect(
  Database,
  Effect.gen(function* makePostgresDatabase() {
    const sql = yield* SqlClient.SqlClient;

    const selectOne = sql`select 1 as one`.pipe(
      Effect.tapError((failure) =>
        Effect.logError("database.connection_failed").pipe(
          Effect.annotateLogs({ reason: failure.reason._tag })
        )
      ),
      Effect.mapError(() => new DatabaseUnavailable({ reason: "unreachable" })),
      Effect.flatMap((rows) =>
        decodeSelectOneRows(rows).pipe(
          Effect.mapError(
            () => new DatabaseUnavailable({ reason: "unexpected-answer" })
          )
        )
      ),
      Effect.map(([row]) => row.one)
    );

    return Database.of({ selectOne });
  })
);

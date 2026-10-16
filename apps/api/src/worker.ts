import { Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as SQL from "alchemy/SQL/Postgres";
import * as Effect from "effect/Effect";
import { HttpRouter } from "effect/http";
import * as Layer from "effect/Layer";

import { apiRoutes } from "./app.js";
import { DatabaseConnection } from "./database-resources.js";
import { PostgresDatabase } from "./postgres-database.js";

const makeApiWorker = Effect.gen(function* makeApiWorker() {
  const stage = yield* Stage;

  const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(
    yield* DatabaseConnection
  );

  yield* Effect.logInfo("savour-api booted").pipe(
    Effect.annotateLogs({ stage })
  );

  const database = PostgresDatabase.pipe(
    Layer.provide(SQL.PostgresLayer({ url: hyperdrive.connectionString }))
  );

  return {
    fetch: yield* HttpRouter.toHttpEffect(
      apiRoutes.pipe(Layer.provide(database))
    ).pipe(Effect.orDie),
  };
}).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding));

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    compatibility: { date: "2026-05-28" },
    main: import.meta.url,
    workersDev: true,
  },
  makeApiWorker
) {}

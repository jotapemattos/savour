import { CloudflareHyperdrive } from "@alchemy.run/better-auth/CloudflareHyperdrive";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as SQL from "alchemy/SQL/Postgres";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import * as Layer from "effect/Layer";

import { apiRoutes } from "./app.js";
import { betterAuthAccounts } from "./better-auth-accounts.js";
import { DatabaseConnection } from "./database-resources.js";
import { googlePlaceSearch } from "./google-place-search.js";
import { PostgresDatabase } from "./postgres-database.js";

const makeApiWorker = Effect.gen(function* makeApiWorker() {
  const { stage } = yield* Alchemy.Stack;

  const { connection, migrationUrl } = yield* DatabaseConnection;
  const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(connection);

  yield* Effect.logInfo("savour-api booted").pipe(
    Effect.annotateLogs({ stage })
  );

  const database = PostgresDatabase.pipe(
    Layer.provide(SQL.PostgresLayer({ url: hyperdrive.connectionString }))
  );

  const accounts = betterAuthAccounts().pipe(
    Layer.provide(CloudflareHyperdrive(connection, { migrate: migrationUrl }))
  );

  const placeSearch = googlePlaceSearch(
    yield* Config.Redacted("GOOGLE_PLACES_API_KEY")
  ).pipe(Layer.provide(FetchHttpClient.layer));

  return {
    fetch: yield* HttpRouter.toHttpEffect(
      apiRoutes.pipe(
        Layer.provide(Layer.mergeAll(database, accounts, placeSearch))
      )
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

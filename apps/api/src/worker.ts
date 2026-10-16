import { Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { apiApp } from "./app.js";

const makeApiWorker = Effect.gen(function* makeApiWorker() {
  const stage = yield* Stage;

  yield* Effect.logInfo("savour-api booted").pipe(
    Effect.annotateLogs({ stage })
  );

  return { fetch: yield* apiApp.pipe(Effect.orDie) };
});

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    compatibility: { date: "2026-05-28" },
    main: import.meta.url,
    workersDev: true,
  },
  makeApiWorker
) {}

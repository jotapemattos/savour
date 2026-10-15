import {
  Flags,
  eventFlags,
  eventsEnabled,
  eventsIdentityMode,
} from "@savour/core/flags";
import type { Flag } from "@savour/core/flags";
import { Basin } from "@savour/events/basin";
import { Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { apiApp, capturedApiApp } from "./app.js";

const inBackground = (effect: Effect.Effect<void>) =>
  Effect.gen(function* registerBackgroundWork() {
    const execution = yield* Cloudflare.WorkerExecutionContext;

    yield* execution.waitUntil(effect);
  });

const readFlag = <A>(flag: Flag<A>) =>
  Flags.use((flags) => flags.get(flag, {}).pipe(Effect.orDie)).pipe(
    Effect.provide(Flags.defaults(eventFlags))
  );

const makeApiWorker = Effect.gen(function* makeApiWorker() {
  const stage = yield* Stage;

  yield* Effect.logInfo("savour-api booted").pipe(
    Effect.annotateLogs({ stage })
  );

  const enabled = yield* readFlag(eventsEnabled);

  if (!enabled) {
    return { fetch: yield* apiApp.pipe(Effect.orDie) };
  }

  const events = yield* Layer.build(Basin({ id: "Api" }));
  const identityMode = yield* readFlag(eventsIdentityMode);
  const app = yield* capturedApiApp({
    identityMode,
    runInBackground: inBackground,
  }).pipe(Effect.orDie);

  return { fetch: app.pipe(Effect.provideContext(events)) };
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

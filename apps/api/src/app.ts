import { toHttpApi } from "@savour/capability";
import { capabilities } from "@savour/core";
import { Flags, eventFlags } from "@savour/core/flags";
import { withEventCapture } from "@savour/events";
import type { CaptureOptions } from "@savour/events";
import * as AlchemyHttp from "alchemy/Http";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

export const http = toHttpApi("Savour", capabilities);

export const apiRoutes = HttpApiBuilder.layer(http.api, {
  openapiPath: "/openapi.json",
}).pipe(
  Layer.provide(http.layer),
  Layer.provide(Flags.defaults(eventFlags)),
  Layer.provide(AlchemyHttp.Platform)
);

export const apiApp = HttpRouter.toHttpEffect(apiRoutes);

export const capturedApiApp = <RB>(options: CaptureOptions<RB>) =>
  apiApp.pipe(Effect.map(withEventCapture(options)));

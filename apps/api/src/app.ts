import { toHttpApi } from "@savour/capability";
import { capabilities } from "@savour/core";
import { eventFlags } from "@savour/core/flags";
import { withEventCapture } from "@savour/events";
import type { CaptureOptions } from "@savour/events";
import { configFlagsLayer } from "@savour/flags/config";
import * as AlchemyHttp from "alchemy/Http";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

export const http = toHttpApi("Savour", capabilities);

export const apiFlags = configFlagsLayer(eventFlags);

export const apiRoutes = HttpApiBuilder.layer(http.api, {
  openapiPath: "/openapi.json",
}).pipe(
  Layer.provide(http.layer),
  Layer.provide(apiFlags),
  Layer.provide(AlchemyHttp.Platform)
);

export const apiApp = HttpRouter.toHttpEffect(apiRoutes);

export const capturedApiApp = <RB>(options: CaptureOptions<RB>) =>
  apiApp.pipe(Effect.map(withEventCapture(options)));

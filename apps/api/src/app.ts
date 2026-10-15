import { toHttpApi } from "@savour/capability";
import { capabilities } from "@savour/core";
import { Flags, eventFlags } from "@savour/core/flags";
import { withEventCapture } from "@savour/events";
import type { CaptureOptions } from "@savour/events";
import * as AlchemyHttp from "alchemy/Http";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

export const http = toHttpApi("Savour", capabilities);

export const apiRoutes = Layer.merge(
  HttpApiBuilder.layer(http.api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(http.layer)
  ),
  HttpApiScalar.layer(http.api, { path: "/docs" })
).pipe(
  Layer.provide(Flags.defaults(eventFlags)),
  Layer.provide(AlchemyHttp.Platform)
);

export const apiApp = HttpRouter.toHttpEffect(apiRoutes);

export const capturedApiApp = <RB>(options: CaptureOptions<RB>) =>
  apiApp.pipe(Effect.map(withEventCapture(options)));

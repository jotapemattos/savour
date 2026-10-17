import { toHttpApi } from "@savour/capability";
import { SessionCredential, capabilities } from "@savour/core";
import * as AlchemyHttp from "alchemy/Http";
import { Effect, Layer, Option, Schema } from "effect";
import type { HttpServerRequest } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

const BEARER = /^Bearer\s+(?<token>\S+)$/iu;

const bearerTokenOf = (request: HttpServerRequest.HttpServerRequest) =>
  Option.fromNullishOr(
    BEARER.exec(request.headers.authorization ?? "")?.groups?.token
  );

export const http = toHttpApi("Savour", capabilities, {
  provide: [
    {
      failure: Schema.Never,
      from: (request) => Effect.succeed(bearerTokenOf(request)),
      tag: SessionCredential,
    },
  ],
});

export const apiRoutes = HttpApiBuilder.layer(http.api, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(http.layer), Layer.provide(AlchemyHttp.Platform));

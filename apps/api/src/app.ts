import { toHttpApi } from "@savour/capability";
import { capabilities } from "@savour/core";
import * as AlchemyHttp from "alchemy/Http";
import { Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";

export const http = toHttpApi("Savour", capabilities);

export const apiRoutes = HttpApiBuilder.layer(http.api, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(http.layer), Layer.provide(AlchemyHttp.Platform));

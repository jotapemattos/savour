import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import type { ApiTransport } from "#/client/savour-api";

import { apiFetch } from "./api-binding";

export const bindingTransport = (): ApiTransport => ({
  baseUrl: "https://api.savour.internal",
  layer: FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, apiFetch))
  ),
});

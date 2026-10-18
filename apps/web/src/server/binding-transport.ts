import { getRequestHeader } from "@tanstack/react-start/server";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import type { ApiTransport } from "#/client/savour-api";

import { apiFetch } from "./api-binding";
import { withSessionBearer } from "./session-cookie";

// oxlint-disable-next-line typescript/promise-function-async -- The API service binding is a native Promise boundary.
const sessionFetch: typeof globalThis.fetch = (input, init) =>
  apiFetch(
    withSessionBearer(new Request(input, init), getRequestHeader("cookie"))
  );

export const bindingTransport = (): ApiTransport => ({
  baseUrl: "https://api.savour.internal",
  layer: FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, sessionFetch))
  ),
});

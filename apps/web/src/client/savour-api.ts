import { makeHttpApiClient } from "@savour/capability/http-client";
import { contracts } from "@savour/core/contracts";
import { queryOptions } from "@tanstack/react-query";
import { Duration, Effect } from "effect";
import type { Layer } from "effect";
import type { HttpClient } from "effect/http";

export interface ApiTransport {
  readonly baseUrl: string;
  readonly layer: Layer.Layer<HttpClient.HttpClient>;
}

export type ApiStatus = "ok" | "unavailable";

const HEALTH_READ_LIMIT = Duration.seconds(2);

export const savourApi = (transport: ApiTransport) =>
  makeHttpApiClient("Savour", contracts, transport.baseUrl);

const readApiStatus = (transport: ApiTransport) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) => client.capabilities.health({ query: {} })),
    Effect.map((report): ApiStatus => report.status),
    Effect.timeout(HEALTH_READ_LIMIT),
    Effect.orElseSucceed((): ApiStatus => "unavailable"),
    Effect.provide(transport.layer)
  );

export const apiStatusQuery = (transport: ApiTransport) =>
  queryOptions({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
    queryFn: () => Effect.runPromise(readApiStatus(transport)),
    queryKey: ["api", "health"],
  });

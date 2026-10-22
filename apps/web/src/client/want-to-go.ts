import { WantToGoEntry } from "@savour/core/contracts";
import { queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";

import { savourApi } from "./savour-api";
import type { ApiTransport } from "./savour-api";

export const WantToGoRead = Schema.TaggedStruct("WantToGoRead", {
  restaurants: Schema.Array(WantToGoEntry),
});

export const WantToGoSignedOut = Schema.TaggedStruct("WantToGoSignedOut", {});

export type WantToGoOutcome =
  | typeof WantToGoRead.Type
  | typeof WantToGoSignedOut.Type;

const readWantToGo = (transport: ApiTransport) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) => client.capabilities.wantToGo({ query: {} })),
    Effect.map((list): WantToGoOutcome =>
      WantToGoRead.make({ restaurants: list.restaurants })
    ),
    Effect.catchTag("Unauthenticated", () =>
      Effect.succeed<WantToGoOutcome>(WantToGoSignedOut.make({}))
    ),
    Effect.provide(transport.layer)
  );

export const wantToGoKey = ["want-to-go"] as const;

export const wantToGoQuery = (transport: ApiTransport) =>
  queryOptions({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
    queryFn: () => Effect.runPromise(readWantToGo(transport)),
    queryKey: wantToGoKey,
    retry: false,
  });

export const addToWantToGo = (transport: ApiTransport, placeId: string) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.addToWantToGo({ payload: { placeId } })
    ),
    Effect.asVoid,
    Effect.provide(transport.layer)
  );

export const removeFromWantToGo = (transport: ApiTransport, id: string) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.removeFromWantToGo({ params: { id }, query: {} })
    ),
    Effect.asVoid,
    Effect.provide(transport.layer)
  );

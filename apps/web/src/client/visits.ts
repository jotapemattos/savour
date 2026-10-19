import { DiaryEntry } from "@savour/core/contracts";
import { queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";

import { savourApi } from "./savour-api";
import type { ApiTransport } from "./savour-api";

export const DiaryRead = Schema.TaggedStruct("DiaryRead", {
  visits: Schema.Array(DiaryEntry),
});

export const DiarySignedOut = Schema.TaggedStruct("DiarySignedOut", {});

export type DiaryOutcome = typeof DiaryRead.Type | typeof DiarySignedOut.Type;

const readDiary = (transport: ApiTransport) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) => client.capabilities.diary({ query: {} })),
    Effect.map((diary): DiaryOutcome =>
      DiaryRead.make({ visits: diary.visits })
    ),
    Effect.catchTag("Unauthenticated", () =>
      Effect.succeed<DiaryOutcome>(DiarySignedOut.make({}))
    ),
    Effect.provide(transport.layer)
  );

export const diaryQuery = (transport: ApiTransport) =>
  queryOptions({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
    queryFn: () => Effect.runPromise(readDiary(transport)),
    queryKey: ["visits", "diary"],
    retry: false,
  });

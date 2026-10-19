import { DiaryEntry } from "@savour/core/contracts";
import type {
  InvalidRating,
  InvalidVisitDate,
  LogVisitInput,
} from "@savour/core/contracts";
import { queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";

import { savourApi } from "./savour-api";
import type { ApiTransport } from "./savour-api";

export const DiaryRead = Schema.TaggedStruct("DiaryRead", {
  visits: Schema.Array(DiaryEntry),
});

export const DiarySignedOut = Schema.TaggedStruct("DiarySignedOut", {});

export const VisitLogged = Schema.TaggedStruct("VisitLogged", {
  visit: DiaryEntry,
});

export type DiaryOutcome = typeof DiaryRead.Type | typeof DiarySignedOut.Type;

export type LogOutcome =
  | typeof VisitLogged.Type
  | InvalidRating
  | InvalidVisitDate;

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

export const logVisit = (
  transport: ApiTransport,
  input: typeof LogVisitInput.Type
) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.logVisit({ payload: input })
    ),
    Effect.map((logged): LogOutcome =>
      VisitLogged.make({ visit: logged.visit })
    ),
    Effect.catchTags({
      InvalidRating: (refusal) => Effect.succeed<LogOutcome>(refusal),
      InvalidVisitDate: (refusal) => Effect.succeed<LogOutcome>(refusal),
    }),
    Effect.provide(transport.layer)
  );

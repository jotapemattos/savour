import { DiaryEntry } from "@savour/core/contracts";
import type {
  EditVisitInput,
  InvalidRating,
  InvalidVisitDate,
  LogVisitInput,
  VisitNotFound,
} from "@savour/core/contracts";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";

import { savourApi } from "./savour-api";
import type { ApiTransport } from "./savour-api";

export const DiaryRead = Schema.TaggedStruct("DiaryRead", {
  q: Schema.String,
  visits: Schema.Array(DiaryEntry),
});

export const DiarySignedOut = Schema.TaggedStruct("DiarySignedOut", {});

export const VisitLogged = Schema.TaggedStruct("VisitLogged", {
  visit: DiaryEntry,
});

export const VisitEdited = Schema.TaggedStruct("VisitEdited", {
  visit: DiaryEntry,
});

export const VisitRemoved = Schema.TaggedStruct("VisitRemoved", {});

export type DiaryOutcome = typeof DiaryRead.Type | typeof DiarySignedOut.Type;

export type LogOutcome =
  | typeof VisitLogged.Type
  | InvalidRating
  | InvalidVisitDate;

export type EditOutcome =
  | typeof VisitEdited.Type
  | VisitNotFound
  | InvalidRating
  | InvalidVisitDate;

export type DeleteOutcome = typeof VisitRemoved.Type | VisitNotFound;

export type VisitChanges = Omit<typeof EditVisitInput.Type, "id">;

const readDiary = (transport: ApiTransport, q: string) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.diary({ query: q === "" ? {} : { q } })
    ),
    Effect.map((diary): DiaryOutcome =>
      DiaryRead.make({ q, visits: diary.visits })
    ),
    Effect.catchTag("Unauthenticated", () =>
      Effect.succeed<DiaryOutcome>(DiarySignedOut.make({}))
    ),
    Effect.provide(transport.layer)
  );

export const diaryKey = ["visits", "diary"] as const;

export const diaryQuery = (transport: ApiTransport, q = "") =>
  queryOptions({
    placeholderData: keepPreviousData,
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
    queryFn: () => Effect.runPromise(readDiary(transport, q.trim())),
    queryKey: [...diaryKey, q.trim()],
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

export const editVisit = (
  transport: ApiTransport,
  id: string,
  changes: VisitChanges
) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.editVisit({ params: { id }, payload: changes })
    ),
    Effect.map((edited): EditOutcome =>
      VisitEdited.make({ visit: edited.visit })
    ),
    Effect.catchTags({
      InvalidRating: (refusal) => Effect.succeed<EditOutcome>(refusal),
      InvalidVisitDate: (refusal) => Effect.succeed<EditOutcome>(refusal),
      VisitNotFound: (refusal) => Effect.succeed<EditOutcome>(refusal),
    }),
    Effect.provide(transport.layer)
  );

export const deleteVisit = (transport: ApiTransport, id: string) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.deleteVisit({ params: { id }, query: {} })
    ),
    Effect.map((): DeleteOutcome => VisitRemoved.make({})),
    Effect.catchTag("VisitNotFound", (refusal) =>
      Effect.succeed<DeleteOutcome>(refusal)
    ),
    Effect.provide(transport.layer)
  );

import {
  FlagChangeSchema,
  PendingFlagChangeSchema,
  CompletedFlagChangeSchema,
  FlagJournal,
  FlagWriter,
  validateFlagChangeQuery,
} from "@savour/core/flag-control";
import type { ListFlagChangesInput } from "@savour/core/flag-control";
import { FlagStorageError, Flags, InvalidFlagValue } from "@savour/core/flags";
import type { Flag } from "@savour/core/flags";
import { Clock, Effect, Layer, Schema } from "effect";

import { InvalidFlagJournal } from "./invalid-flag-journal.js";

export interface FlagKV<E> {
  readonly get: (key: string) => Effect.Effect<string | null, E>;
  readonly put: (key: string, value: string) => Effect.Effect<void, E>;
  readonly list: (input: {
    readonly prefix: string;
    readonly limit: number;
    readonly cursor?: string;
  }) => Effect.Effect<
    {
      readonly keys: readonly { readonly name: string }[];
      readonly cursor?: string | undefined;
      readonly list_complete: boolean;
    },
    E
  >;
}

const decodePending = Schema.decodeEffect(
  Schema.fromJsonString(PendingFlagChangeSchema)
);

const decodeCompleted = Schema.decodeEffect(
  Schema.fromJsonString(CompletedFlagChangeSchema)
);

const encodeChange = Schema.encodeEffect(
  Schema.fromJsonString(FlagChangeSchema)
);

const prefix = "attempts/";

const completionKey = (id: string) => `outcomes/${id}`;

export const kvFlagsLayer = <E>(
  registry: readonly Flag<unknown>[],
  kv: Pick<FlagKV<E>, "get">,
  deployOnly: readonly string[] = []
) =>
  Layer.effect(
    Flags,
    Effect.gen(function* makeKVFlags() {
      const fallback = yield* Flags;

      return Flags.of({
        get: (flag, context) =>
          Effect.gen(function* readKVFlag() {
            const defaultValue = yield* fallback.get(flag, context);

            if (deployOnly.includes(flag.name)) {
              return defaultValue;
            }

            const encoded = yield* Schema.encodeEffect(flag.schema)(
              defaultValue
            ).pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(Schema.Json)),
              Effect.mapError(
                () =>
                  new InvalidFlagValue({
                    name: flag.name,
                    repair: "Declare a flag with a JSON encoding.",
                  })
              )
            );

            const stored = yield* kv.get(`values/${flag.name}`).pipe(
              Effect.mapError(
                (cause) =>
                  new FlagStorageError({
                    cause,
                    fallback: encoded,
                    name: flag.name,
                    operation: "read",
                    repair:
                      "Restore KV access. The recorded fallback is the composition's Config value or declared default.",
                  })
              )
            );

            if (stored === null) {
              return defaultValue;
            }

            return yield* Schema.decodeEffect(
              Schema.fromJsonString(flag.schema)
            )(stored).pipe(
              Effect.mapError(
                () =>
                  new InvalidFlagValue({
                    name: flag.name,
                    repair:
                      "Replace the stored KV value with its declared JSON encoding.",
                  })
              )
            );
          }),
        registry,
      });
    })
  );

export const kvFlagControlLayer = <E>(
  kv: FlagKV<E>,
  deployOnly: readonly string[] = []
) =>
  Layer.merge(
    Layer.succeed(FlagWriter, {
      set: (flag, value) =>
        Effect.gen(function* writeKVFlag() {
          if (deployOnly.includes(flag.name)) {
            return yield* new FlagStorageError({
              cause: "This flag selects deployment resources.",
              fallback: null,
              name: flag.name,
              operation: "write",
              repair:
                "Change deployment Config and review the infrastructure plan instead of writing this flag live.",
            });
          }

          const encoded = yield* Schema.encodeEffect(
            Schema.fromJsonString(flag.schema)
          )(value).pipe(
            Effect.mapError(
              () =>
                new InvalidFlagValue({
                  name: flag.name,
                  repair: "Supply a value accepted by the declared schema.",
                })
            )
          );

          return yield* kv.put(`values/${flag.name}`, encoded).pipe(
            Effect.mapError(
              (cause) =>
                new FlagStorageError({
                  cause,
                  fallback: null,
                  name: flag.name,
                  operation: "write",
                  repair:
                    "Check the attempt journal and KV before retrying. A failed write does not prove that the value is unchanged.",
                })
            )
          );
        }),
    }),
    Layer.succeed(FlagJournal, {
      list: Effect.fn("KVFlagJournal.list")(function* list(
        input: typeof ListFlagChangesInput.Type
      ) {
        const { cursor, limit } = yield* validateFlagChangeQuery(input);
        const now = yield* Clock.currentTimeMillis;

        const query =
          cursor === undefined ? { limit, prefix } : { cursor, limit, prefix };

        const result = yield* kv.list(query).pipe(
          Effect.mapError(
            (cause) =>
              new FlagStorageError({
                cause,
                fallback: null,
                name: "",
                operation: "listChanges",
                repair: "Restore KV access and retry this cursor.",
              })
          )
        );

        const sameChange = Schema.toEquivalence(FlagChangeSchema);

        const changes = yield* Effect.forEach(
          (key: { readonly name: string }) =>
            Effect.gen(function* readAttempt() {
              const pending = yield* kv.get(key.name);

              if (pending === null) {
                return yield* new InvalidFlagJournal({
                  key: key.name,
                  repair:
                    "A listed flag attempt is not yet visible. Retry this cursor.",
                });
              }

              const attempt = yield* decodePending(pending);
              const finished = yield* kv.get(completionKey(attempt.attemptId));

              const change =
                finished === null ? attempt : yield* decodeCompleted(finished);

              if (
                key.name !== `${prefix}${attempt.attemptId}` ||
                !sameChange(attempt, {
                  ...change,
                  outcome: "Pending",
                  recordedAt: attempt.recordedAt,
                })
              ) {
                return yield* new InvalidFlagJournal({
                  key: key.name,
                  repair:
                    "The flag outcome does not match its attempt. Repair the journal entry.",
                });
              }

              return {
                ...change,
                ageMillis: Math.max(0, now - change.recordedAt),
              };
            }).pipe(
              Effect.mapError(
                (cause) =>
                  new FlagStorageError({
                    cause,
                    fallback: null,
                    name: key.name,
                    operation: "listChanges",
                    repair:
                      "Restore or repair this journal entry, then retry the same cursor.",
                  })
              )
            )
        )(result.keys);

        return {
          changes,
          cursor: result.list_complete ? undefined : result.cursor,
        };
      }),
      record: (change) =>
        encodeChange(change).pipe(
          Effect.flatMap((value) =>
            kv.put(
              change.outcome === "Pending"
                ? `${prefix}${change.attemptId}`
                : completionKey(change.attemptId),
              value
            )
          ),
          Effect.mapError(
            (cause) =>
              new FlagStorageError({
                cause,
                fallback: null,
                name: change.name,
                operation: "audit",
                repair: `Inspect attempt ${change.attemptId}. Missing completion means Pending; the flag may have changed. Restore audit storage before retrying.`,
              })
          )
        ),
    })
  );

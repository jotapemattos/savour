import { FlagJournal, FlagWriter } from "@savour/core/flag-control";
import { Flags, decodeFlag } from "@savour/core/flags";
import type { Flag } from "@savour/core/flags";
import { Effect, Layer, Ref, Schema } from "effect";

import { evaluateFlag, FlagRule } from "./evaluate.js";

export const memoryFlagsLayer = (
  registry: readonly Flag<unknown>[],
  rules: ReadonlyMap<string, readonly (typeof FlagRule.Type)[]> = new Map()
) =>
  Layer.unwrap(
    Effect.gen(function* makeMemoryFlags() {
      const entries = yield* Effect.forEach([...rules], ([name, values]) =>
        Schema.decodeEffect(Schema.Array(FlagRule))(values).pipe(
          Effect.map((decoded) => [name, decoded] as const)
        )
      );

      const snapshot = new Map(entries);

      const overrides = yield* Ref.make<ReadonlyMap<string, unknown>>(
        new Map()
      );

      return Layer.mergeAll(
        Layer.succeed(Flags, {
          get: (flag, context) =>
            Effect.gen(function* evaluateMemoryFlag() {
              const current = yield* Ref.get(overrides);

              if (current.has(flag.name)) {
                return yield* decodeFlag(flag)(current.get(flag.name));
              }

              const decodedRules = yield* Effect.forEach(
                (rule: typeof FlagRule.Type) =>
                  decodeFlag(flag)(rule.value).pipe(
                    Effect.map((value) => ({ ...rule, value }))
                  )
              )(snapshot.get(flag.name) ?? []);

              return yield* decodeFlag(flag)(
                evaluateFlag(flag, context, decodedRules)
              );
            }),
          registry,
        }),
        Layer.succeed(FlagWriter, {
          set: (flag, value) =>
            decodeFlag(flag)(value).pipe(
              Effect.flatMap((decoded) =>
                Ref.update(
                  overrides,
                  (current) => new Map([...current, [flag.name, decoded]])
                )
              )
            ),
        }),
        FlagJournal.memory
      );
    })
  );

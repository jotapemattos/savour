import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Approval } from "@rat-stack/capability/approval";
import { getFlag } from "@rat-stack/core/flag-capabilities";
import {
  FlagActor,
  FlagJournal,
  FlagPreviousValue,
} from "@rat-stack/core/flag-control";
import { setFlag } from "@rat-stack/core/flag-write-capabilities";
import { Flags, defineFlag } from "@rat-stack/core/flags";
import { Effect, Exit, Layer, Schema } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import { TestClock } from "effect/testing";

import { kvFlagControlLayer, kvFlagsLayer } from "../src/kv.js";
import { memoryFlagsLayer } from "../src/memory.js";
import { makeKVDouble } from "./kv-double.js";

const testFlag = defineFlag("EXAMPLE_SWITCH", Schema.Boolean, {
  default: false,
  owner: "tests",
  removeBy: "2099-01-01",
});

const Command = Schema.Struct({
  action: Schema.Literals(["get", "set", "deny", "invalid", "unknown"]),
  value: Schema.Boolean,
});

const commands = Arbitrary.array(Arbitrary.schema(Command), { maxLength: 35 });

const failures = {
  deny: "ApprovalDenied",
  invalid: "InvalidFlagValue",
  unknown: "UnknownFlag",
} as const;

it.effect.prop(
  "set/get histories agree with the model and audit every available-store attempt",
  {
    backend: Schema.Literals(["memory", "kv"]),
    commands,
  },
  ({ commands: generated, backend }) =>
    Effect.gen(function* checkWriteHistory() {
      const double = yield* makeKVDouble;

      const layer =
        backend === "memory"
          ? memoryFlagsLayer([testFlag])
          : Layer.merge(
              kvFlagsLayer([testFlag], double.kv).pipe(
                Layer.provide(Flags.defaults([testFlag]))
              ),
              kvFlagControlLayer(double.kv)
            );

      yield* Effect.gen(function* compareCommands() {
        let expected = false;

        const attempted: {
          name: string;
          oldValue: boolean | undefined;
          newValue: boolean | string;
          outcome: string;
        }[] = [];

        const sequence: readonly (typeof Command.Type)[] = [
          { action: "set", value: true },
          ...generated,
          { action: "deny", value: false },
          { action: "invalid", value: false },
          { action: "unknown", value: false },
          { action: "get", value: false },
        ];

        for (const command of sequence) {
          yield* TestClock.adjust(1);

          if (command.action === "get") {
            expect(
              yield* getFlag.handler({ context: {}, name: testFlag.name })
            ).toBe(expected);
            continue;
          }

          const name = command.action === "unknown" ? "MISSING" : testFlag.name;

          const value =
            command.action === "invalid" ? "not-a-boolean" : command.value;

          const previous = expected;

          const result = yield* setFlag
            .handler({ name, value })
            .pipe(
              Effect.provide(
                command.action === "deny" ? Approval.denyAll : Approval.allowAll
              ),
              Effect.exit
            );

          if (command.action === "set") {
            expect(Exit.isSuccess(result)).toBe(true);
            expected = command.value;
          } else {
            expect(Exit.isFailure(result)).toBe(true);
            const error = yield* result.pipe(Effect.flip);
            expect(error._tag).toBe(failures[command.action]);
          }

          attempted.push({
            name,
            newValue: value,
            oldValue: command.action === "unknown" ? undefined : previous,
            outcome: (
              {
                deny: "Denied",
                invalid: "Failed",
                set: "Succeeded",
                unknown: "Failed",
              } as const
            )[command.action],
          });
          expect(
            yield* getFlag.handler({ context: {}, name: testFlag.name })
          ).toBe(expected);

          const journal = yield* FlagJournal.use((store) =>
            store.list({ limit: 100 })
          );

          expect(journal.changes).toHaveLength(attempted.length);
          expect(
            journal.changes.map((entry) => ({
              name: entry.name,
              newValue: entry.newValue,
              oldValue: FlagPreviousValue.guards.Known(entry.oldValue)
                ? entry.oldValue.value
                : undefined,
              outcome: entry.outcome,
            }))
          ).toStrictEqual(attempted);
          expect(
            journal.changes.every(
              (entry) => entry.actor === "test-operator" && entry.ageMillis >= 0
            )
          ).toBe(true);
        }
      }).pipe(
        Effect.provide(layer),
        Effect.provideService(FlagActor, "test-operator")
      );
    }).pipe(Effect.provide(NodeCrypto.layer))
);

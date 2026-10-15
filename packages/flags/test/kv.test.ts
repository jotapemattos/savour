import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Approval } from "@savour/capability/approval";
import { FlagJournal } from "@savour/core/flag-control";
import { setFlag } from "@savour/core/flag-write-capabilities";
import {
  Flags,
  FlagStorageError,
  defineFlag,
  eventFlags,
  eventsEnabled,
  eventsIdentityMode,
} from "@savour/core/flags";
import {
  ConfigProvider,
  Deferred,
  Effect,
  Fiber,
  Layer,
  Ref,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";

import { configFlagsLayer } from "../src/config.js";
import { kvFlagControlLayer, kvFlagsLayer } from "../src/kv.js";
import { makeKVDouble } from "./kv-double.js";

const switchFlag = defineFlag("EXAMPLE_SWITCH", Schema.Boolean, {
  default: false,
  owner: "tests",
  removeBy: "2099-01-01",
});

it.effect.prop(
  "empty KV preserves Config, and deployment-only values never come from KV",
  {
    enabled: Schema.Boolean,
    identity: Schema.Literals(["daily", "persistent"]),
  },
  ({ enabled, identity }) =>
    Effect.gen(function* compareEmptyKV() {
      const double = yield* makeKVDouble;

      const fallback = configFlagsLayer(eventFlags).pipe(
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              EVENTS_ENABLED: String(enabled),
              EVENTS_IDENTITY_MODE: identity,
            })
          )
        )
      );

      const layer = kvFlagsLayer(eventFlags, double.kv, [
        eventsEnabled.name,
      ]).pipe(Layer.provide(fallback));

      const flags = yield* Flags.pipe(Effect.provide(layer));
      expect(yield* flags.get(eventsEnabled, {})).toBe(enabled);
      expect(yield* flags.get(eventsIdentityMode, {})).toBe(identity);
      yield* double.kv.put(
        `values/${eventsEnabled.name}`,
        JSON.stringify(!enabled)
      );
      expect(yield* flags.get(eventsEnabled, {})).toBe(enabled);
      yield* double.kv.put(
        `values/${eventsIdentityMode.name}`,
        JSON.stringify(identity === "daily" ? "persistent" : "daily")
      );
      expect(yield* flags.get(eventsIdentityMode, {})).toBe(
        identity === "daily" ? "persistent" : "daily"
      );
      yield* Ref.set(double.failure, "read");
      const error = yield* flags.get(eventsIdentityMode, {}).pipe(Effect.flip);
      expect(error._tag).toBe("FlagStorageError");

      if (Schema.is(FlagStorageError)(error)) {
        expect(error.fallback).toBe(identity);
        expect(error.operation).toBe("read");
      }
    })
);

it.effect(
  "audit unavailability gates writes without gating reads; failed completion keeps a visible Pending attempt",
  () =>
    Effect.gen(function* auditFailureSeams() {
      const double = yield* makeKVDouble;

      const layer = Layer.merge(
        kvFlagsLayer([switchFlag], double.kv).pipe(
          Layer.provide(Flags.defaults([switchFlag]))
        ),
        kvFlagControlLayer(double.kv)
      );

      yield* Effect.gen(function* useStore() {
        const flags = yield* Flags;
        const journal = yield* FlagJournal;
        yield* Ref.set(double.failure, "attempts/");

        const before = yield* setFlag
          .handler({ name: switchFlag.name, value: true })
          .pipe(Effect.flip);

        expect(before._tag).toBe("FlagStorageError");
        expect(yield* flags.get(switchFlag, {})).toBe(false);
        expect(yield* Ref.get(double.writes)).toHaveLength(0);
        yield* Ref.set(double.failure, "outcomes/");

        const after = yield* setFlag
          .handler({ name: switchFlag.name, value: true })
          .pipe(Effect.flip);

        expect(after._tag).toBe("FlagStorageError");
        expect(yield* flags.get(switchFlag, {})).toBe(true);
        yield* TestClock.adjust(100);
        const page = yield* journal.list({ limit: 1 });
        expect(page.changes).toHaveLength(1);
        expect(page.changes[0]?.outcome).toBe("Pending");
        expect(page.changes[0]?.ageMillis).toBe(100);
        expect(
          [...(yield* Ref.get(double.data)).keys()].filter((key) =>
            key.startsWith("attempts/")
          )
        ).toHaveLength(1);
        expect(
          [...(yield* Ref.get(double.data)).keys()].filter((key) =>
            key.startsWith("outcomes/")
          )
        ).toHaveLength(0);
      }).pipe(Effect.provide(Layer.merge(layer, Approval.allowAll)));
    }).pipe(Effect.provide(NodeCrypto.layer))
);

it.effect(
  "interruption at approval leaves Pending and cannot apply a value",
  () =>
    Effect.gen(function* interruptedAttempt() {
      const double = yield* makeKVDouble;
      const gate = yield* Deferred.make<boolean>();

      const layer = Layer.merge(
        kvFlagsLayer([switchFlag], double.kv).pipe(
          Layer.provide(Flags.defaults([switchFlag]))
        ),
        kvFlagControlLayer(double.kv)
      );

      yield* Effect.gen(function* cancelAtGate() {
        const flags = yield* Flags;
        const journal = yield* FlagJournal;

        const fiber = yield* setFlag
          .handler({ name: switchFlag.name, value: true })
          .pipe(
            Effect.provideService(
              Approval,
              Approval.of({
                approve: () =>
                  Deferred.succeed(gate, true).pipe(
                    Effect.andThen(Effect.never)
                  ),
              })
            ),
            Effect.forkChild
          );

        yield* Deferred.await(gate);
        expect((yield* journal.list({ limit: 1 })).changes[0]?.outcome).toBe(
          "Pending"
        );
        yield* Fiber.interrupt(fiber);
        expect((yield* journal.list({ limit: 1 })).changes[0]?.outcome).toBe(
          "Pending"
        );
        expect(yield* flags.get(switchFlag, {})).toBe(false);
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.scoped, Effect.provide(NodeCrypto.layer))
);

it.effect.prop(
  "journals reject page limits outside their bounded read contract",
  {
    limit: Schema.Union([
      Schema.Int.check(Schema.isBetween({ maximum: 0, minimum: -100 })),
      Schema.Int.check(Schema.isBetween({ maximum: 200, minimum: 101 })),
    ]),
  },
  ({ limit }) =>
    Effect.gen(function* rejectUnboundedQuery() {
      const double = yield* makeKVDouble;

      for (const layer of [FlagJournal.memory, kvFlagControlLayer(double.kv)]) {
        const error = yield* Effect.gen(function* readInvalidPage() {
          const journal = yield* FlagJournal;

          return yield* journal.list({ limit }).pipe(Effect.flip);
        }).pipe(Effect.provide(layer));

        expect(error._tag).toBe("FlagStorageError");
        expect(error.operation).toBe("listChanges");
      }
    })
);

it.effect(
  "journal pages remain bounded and pair immutable outcomes with their own attempts",
  () =>
    Effect.gen(function* paginateJournal() {
      const double = yield* makeKVDouble;

      const layer = Layer.merge(
        kvFlagsLayer([switchFlag], double.kv).pipe(
          Layer.provide(Flags.defaults([switchFlag]))
        ),
        kvFlagControlLayer(double.kv)
      );

      yield* Effect.gen(function* threeAttempts() {
        for (const value of [true, false, true]) {
          yield* TestClock.adjust(1);
          yield* setFlag.handler({ name: switchFlag.name, value });
        }

        const journal = yield* FlagJournal;
        const first = yield* journal.list({ limit: 2 });
        expect(first.changes).toHaveLength(2);
        expect(first.cursor).toBeDefined();

        const second = yield* journal.list({
          cursor: first.cursor,
          limit: 2,
        });

        expect(second.changes).toHaveLength(1);
        expect(second.cursor).toBeUndefined();
        expect(
          [...first.changes, ...second.changes].map((entry) => entry.newValue)
        ).toStrictEqual([true, false, true]);
        const writes = yield* Ref.get(double.writes);
        const auditKeys = writes.filter((key) => !key.startsWith("values/"));
        expect(new Set(auditKeys).size).toBe(6);
        const [entry] = first.changes;

        if (entry === undefined) {
          return yield* Effect.die(
            new Error("The journal lost its first attempt.")
          );
        }

        for (const corrupted of [
          "invalid-json",
          JSON.stringify({ ...entry, actor: `${entry.actor}-other` }),
          JSON.stringify({ ...entry, newValue: false }),
          JSON.stringify({ ...entry, outcome: "Pending" }),
        ]) {
          yield* double.kv.put(`outcomes/${entry.attemptId}`, corrupted);
          expect(
            (yield* journal.list({ limit: 2 }).pipe(Effect.flip))._tag
          ).toBe("FlagStorageError");
        }

        yield* double.kv.put(
          `attempts/${entry.attemptId}`,
          JSON.stringify({
            ...entry,
            attemptId: `${entry.attemptId}-other`,
            outcome: "Pending",
          })
        );
        expect((yield* journal.list({ limit: 2 }).pipe(Effect.flip))._tag).toBe(
          "FlagStorageError"
        );

        return yield* Effect.void;
      }).pipe(Effect.provide(Layer.merge(layer, Approval.allowAll)));
    }).pipe(Effect.provide(NodeCrypto.layer))
);

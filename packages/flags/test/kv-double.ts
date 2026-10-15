import { Data, Effect, Ref } from "effect";

import type { FlagKV } from "../src/kv.js";

export class KVTestFailure extends Data.TaggedError("KVTestFailure")<{
  readonly key: string;
}> {}

export const makeKVDouble = Effect.gen(function* makeKVDouble() {
  const data = yield* Ref.make<ReadonlyMap<string, string>>(new Map());
  const failure = yield* Ref.make<string | null>(null);
  const writes = yield* Ref.make<readonly string[]>([]);

  const kv: FlagKV<KVTestFailure> = {
    get: (key) =>
      Ref.get(failure).pipe(
        Effect.flatMap((blocked) =>
          blocked === "read"
            ? Effect.fail(new KVTestFailure({ key }))
            : Ref.get(data).pipe(
                Effect.map((values) => values.get(key) ?? null)
              )
        )
      ),
    list: (input) =>
      Ref.get(data).pipe(
        Effect.map((values) => {
          const { cursor } = input;

          const names = [...values.keys()]
            .filter(
              (key) =>
                key.startsWith(input.prefix) &&
                (cursor === undefined || key > cursor)
            )
            .toSorted();

          const keys = names.slice(0, input.limit).map((name) => ({ name }));

          const next =
            names.length > keys.length ? keys.at(-1)?.name : undefined;

          return { cursor: next, keys, list_complete: next === undefined };
        })
      ),
    put: (key, value) =>
      Ref.get(failure).pipe(
        Effect.flatMap((blocked) =>
          blocked !== null && key.startsWith(blocked)
            ? Effect.fail(new KVTestFailure({ key }))
            : Ref.update(
                data,
                (values) => new Map([...values, [key, value]])
              ).pipe(
                Effect.andThen(Ref.update(writes, (keys) => [...keys, key]))
              )
        )
      ),
  };

  return { data, failure, kv, writes };
});

import { Database } from "@alchemy.run/better-auth";
import type { BetterAuthOptions, DBAdapter } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { MemoryDB } from "better-auth/adapters/memory";
import { getSchema } from "better-auth/db";
import { Data, Effect, Layer, Schema } from "effect";

import { betterAuthAccounts } from "../../src/better-auth-accounts.js";

const UserColumns = Schema.Struct({
  email: Schema.String,
  handle: Schema.String,
});

const decodeUser = Schema.decodeUnknownSync(UserColumns);

interface BeforeUserInsert {
  readonly claimedFirst?: typeof UserColumns.Type;
  readonly insertBreaks?: boolean;
}

class InsertRejected extends Data.TaggedError("InsertRejected")<{
  readonly reason: "connection reset" | "duplicate user";
}> {}

const claimFirst = (store: MemoryDB, before: BeforeUserInsert) => {
  if (before.claimedFirst !== undefined) {
    (store.user ??= []).push({
      ...before.claimedFirst,
      emailVerified: false,
      id: `claimed-${before.claimedFirst.handle}`,
      name: before.claimedFirst.handle,
    });
  }
};

const decodeUsers = Schema.decodeUnknownSync(Schema.Array(UserColumns));

const clashes = (store: MemoryDB, user: typeof UserColumns.Type) =>
  decodeUsers(store.user ?? []).some(
    (row) => row.handle === user.handle || row.email === user.email
  );

const autocommitWithUniqueUsers = (
  adapter: DBAdapter,
  store: MemoryDB,
  before: BeforeUserInsert
): DBAdapter => {
  const guarded: DBAdapter = {
    ...adapter,
    // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's database adapter answers with native Promises.
    create: (insert) => {
      if (insert.model !== "user") {
        return adapter.create(insert);
      }

      claimFirst(store, before);

      if (before.insertBreaks === true) {
        return Promise.reject(
          new InsertRejected({ reason: "connection reset" })
        );
      }

      return clashes(store, decodeUser(insert.data))
        ? Promise.reject(new InsertRejected({ reason: "duplicate user" }))
        : adapter.create(insert);
    },
    // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's database adapter answers with native Promises.
    transaction: (run) => run(guarded),
  };

  return guarded;
};

const uniqueMemory = (before: BeforeUserInsert) => {
  const store: MemoryDB = {};

  return Layer.succeed(Database, {
    provider: "sqlite",
    runtime: Effect.succeed((options: BetterAuthOptions) => {
      for (const model of Object.keys(getSchema(options))) {
        store[model] ??= [];
      }

      return autocommitWithUniqueUsers(
        memoryAdapter(store)(options),
        store,
        before
      );
    }),
  });
};

export const uniqueMemoryAccounts = (before: BeforeUserInsert) =>
  betterAuthAccounts("local-test-secret-with-enough-entropy").pipe(
    Layer.provide(uniqueMemory(before))
  );

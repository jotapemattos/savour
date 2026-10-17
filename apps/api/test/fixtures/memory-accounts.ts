import { Memory } from "@alchemy.run/better-auth";
import { RuntimeContext } from "alchemy";
import { Effect, Layer } from "effect";

import { betterAuthAccounts } from "../../src/better-auth-accounts.js";

const TestRuntimeContext = Layer.succeed(RuntimeContext, {
  Type: "Test",
  env: {},
  get: () => Effect.undefined,
  id: "test",
  set: (id) => Effect.succeed(id),
});

export const MemoryAccounts = betterAuthAccounts(
  "local-test-secret-with-enough-entropy"
).pipe(Layer.provide(Memory()));

export const withTestRuntime = Layer.provideMerge(TestRuntimeContext);

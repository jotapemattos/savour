import { Memory } from "@alchemy.run/better-auth";
import { RuntimeContext } from "alchemy";
import { Effect, Layer, Redacted } from "effect";

import { betterAuthAccounts } from "../../src/better-auth-accounts.js";

const TestRuntimeContext = Layer.succeed(RuntimeContext, {
  Type: "Test",
  env: {},
  get: () => Effect.undefined,
  id: "test",
  set: (id) => Effect.succeed(id),
});

export const testAccountsOptions = {
  google: { clientId: Redacted.make("test-google-client") },
  secret: "local-test-secret-with-enough-entropy",
};

export const MemoryAccounts = betterAuthAccounts(testAccountsOptions).pipe(
  Layer.provide(Memory())
);

export const withTestRuntime = Layer.provideMerge(TestRuntimeContext);

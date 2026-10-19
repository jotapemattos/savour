import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Logger, Option } from "effect";

import {
  Accounts,
  InvalidCredentials,
  SessionCredential,
  Unauthenticated,
  currentAccount,
  signIn,
  signUp,
} from "../src/index.js";

type StructuredLog = ReturnType<typeof Logger.formatStructured.log>;

const capturedLogs = () => {
  const entries: StructuredLog[] = [];

  const layer = Logger.layer([
    Logger.make((options) => {
      entries.push(Logger.formatStructured.log(options));
    }),
  ]);

  return { entries, layer };
};

const ana = {
  account: { email: "ana@example.test", handle: "ana" },
  session: { token: "session-token" },
};

const FakeAccounts = Layer.succeed(Accounts, {
  accountForSession: () =>
    Effect.succeed({ account: ana.account, accountId: "account-ana" }),
  signIn: () => Effect.fail(new InvalidCredentials()),
  signOut: () => Effect.void,
  signUp: () => Effect.succeed(ana),
});

const noCredential = Layer.succeed(SessionCredential, Option.none());

describe("account capabilities", () => {
  it.effect("logs account.signed_up with the handle and no email", () =>
    Effect.gen(function* logsSignUp() {
      const logs = capturedLogs();

      yield* signUp
        .handler({
          email: "ana@example.test",
          handle: "ana",
          password: "correct horse 9",
        })
        .pipe(Effect.provide(Layer.merge(FakeAccounts, logs.layer)));

      expect(logs.entries).toHaveLength(1);
      expect(logs.entries[0]).toMatchObject({
        annotations: { handle: "ana" },
        level: "INFO",
        message: "account.signed_up",
      });
      expect(JSON.stringify(logs.entries)).not.toContain("example.test");
    })
  );

  it.effect("logs account.sign_in_failed without the email or password", () =>
    Effect.gen(function* logsSignInFailure() {
      const logs = capturedLogs();

      const exit = yield* signIn
        .handler({ email: "ana@example.test", password: "wrong" })
        .pipe(
          Effect.provide(Layer.merge(FakeAccounts, logs.layer)),
          Effect.exit
        );

      expect(exit).toStrictEqual(Exit.fail(new InvalidCredentials()));
      expect(logs.entries).toHaveLength(1);
      expect(logs.entries[0]).toMatchObject({
        level: "INFO",
        message: "account.sign_in_failed",
      });
      expect(JSON.stringify(logs.entries)).not.toMatch(/example\.test|wrong/u);
    })
  );

  it.effect("fails with Unauthenticated when no bearer token was sent", () =>
    Effect.gen(function* rejectsAnonymous() {
      const exit = yield* currentAccount
        .handler({})
        .pipe(
          Effect.provide(Layer.merge(FakeAccounts, noCredential)),
          Effect.exit
        );

      expect(exit).toStrictEqual(Exit.fail(new Unauthenticated()));
    })
  );
});

import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Logger, Option } from "effect";

import {
  Accounts,
  InvalidCredentials,
  SessionCredential,
  SignInThrottle,
  TooManySignInAttempts,
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

const recordingThrottle = (admits: boolean) => {
  const keys: string[] = [];

  const layer = Layer.succeed(SignInThrottle, {
    admit: (key) =>
      Effect.sync(() => {
        keys.push(key);
      }).pipe(
        Effect.andThen(
          admits ? Effect.void : Effect.fail(new TooManySignInAttempts())
        )
      ),
  });

  return { keys, layer };
};

const recordingAccounts = () => {
  const signIns: string[] = [];

  const layer = Layer.succeed(Accounts, {
    accountForSession: () => Effect.fail(new Unauthenticated()),
    signIn: ({ email }) =>
      Effect.sync(() => {
        signIns.push(email);
      }).pipe(Effect.andThen(Effect.fail(new InvalidCredentials()))),
    signOut: () => Effect.void,
    signUp: () => Effect.succeed(ana),
  });

  return { layer, signIns };
};

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
          Effect.provide(
            Layer.mergeAll(
              FakeAccounts,
              recordingThrottle(true).layer,
              logs.layer
            )
          ),
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

  it.effect("checks the throttle before the password", () =>
    Effect.gen(function* checksThrottleFirst() {
      const accounts = recordingAccounts();

      const exit = yield* signIn
        .handler({ email: "ana@example.test", password: "wrong" })
        .pipe(
          Effect.provide(
            Layer.merge(accounts.layer, recordingThrottle(false).layer)
          ),
          Effect.exit
        );

      expect(exit).toStrictEqual(Exit.fail(new TooManySignInAttempts()));
      expect(accounts.signIns).toStrictEqual([]);
    })
  );

  it.effect(
    "keys the throttle on the normalized email, never the raw value",
    () =>
      Effect.gen(function* keysOnNormalizedEmail() {
        const throttle = recordingThrottle(true);

        for (const email of ["Ana@Example.test", "ana@example.test"]) {
          yield* signIn
            .handler({ email, password: "wrong" })
            .pipe(
              Effect.provide(Layer.merge(FakeAccounts, throttle.layer)),
              Effect.exit
            );
        }

        const [first, second] = throttle.keys;

        expect(throttle.keys).toHaveLength(2);
        expect(first).toBe(second);
        expect(first).toMatch(/^[0-9a-f]{64}$/u);
        expect(first).not.toContain("example.test");
      })
  );

  it.effect("logs account.sign_in_throttled without the email", () =>
    Effect.gen(function* logsThrottledSignIn() {
      const logs = capturedLogs();
      const throttle = recordingThrottle(false);

      yield* signIn
        .handler({ email: "ana@example.test", password: "wrong" })
        .pipe(
          Effect.provide(
            Layer.mergeAll(FakeAccounts, throttle.layer, logs.layer)
          ),
          Effect.exit
        );

      expect(logs.entries).toHaveLength(1);
      expect(logs.entries[0]).toMatchObject({
        level: "INFO",
        message: "account.sign_in_throttled",
      });
      expect(JSON.stringify(logs.entries)).not.toContain("example.test");
      expect(JSON.stringify(logs.entries)).not.toContain(throttle.keys[0]);
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

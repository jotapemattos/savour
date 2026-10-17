import { BetterAuth } from "@alchemy.run/better-auth";
import type {
  BetterAuthApiError,
  BetterAuthProps,
} from "@alchemy.run/better-auth";
import {
  Account,
  Accounts,
  EmailTaken,
  HandleTaken,
  InvalidCredentials,
  SignedInAccount,
  Unauthenticated,
} from "@savour/core";
import { RuntimeContext } from "alchemy";
import { bearer } from "better-auth/plugins";
import { Data, Effect, Layer, Option, Schema } from "effect";

const authOptions = {
  basePath: "/auth",
  emailAndPassword: { enabled: true },
  logger: { disabled: true },
  plugins: [bearer()],
  telemetry: { enabled: false },
  user: {
    additionalFields: {
      handle: { input: true, required: true, type: "string", unique: true },
    },
  },
} satisfies BetterAuthProps;

class MissingRuntimeContext extends Data.TaggedError("MissingRuntimeContext")<{
  readonly adapter: "better-auth-accounts";
}> {}

const withRuntime = <A, E>(
  effect: Effect.Effect<A, E, RuntimeContext>
): Effect.Effect<A, E> =>
  Effect.flatMap(
    Effect.serviceOption(RuntimeContext),
    Option.match({
      onNone: () =>
        Effect.die(
          new MissingRuntimeContext({ adapter: "better-auth-accounts" })
        ),
      onSome: (runtime) =>
        Effect.provideService(effect, RuntimeContext, runtime),
    })
  );

const decodeAccount = Schema.decodeUnknownEffect(Account);

const decodeSignedIn = Schema.decodeUnknownEffect(SignedInAccount);

const bearerHeaders = (token: string) =>
  new Headers({ authorization: `Bearer ${token}` });

const failWhenCode = <A, R, Failure>(
  effect: Effect.Effect<A, BetterAuthApiError, R>,
  code: string,
  failure: Failure
): Effect.Effect<A, Failure, R> =>
  Effect.catchTag(effect, "BetterAuthApiError", (apiFailure) =>
    apiFailure.body?.code === code
      ? Effect.fail(failure)
      : Effect.die(apiFailure)
  );

export const betterAuthAccounts = (secret?: BetterAuthProps["secret"]) =>
  Layer.effect(
    Accounts,
    Effect.gen(function* makeBetterAuthAccounts() {
      const auth = yield* BetterAuth(
        secret === undefined ? authOptions : { ...authOptions, secret }
      );

      const handleIsTaken = (handle: string) =>
        auth.auth.pipe(
          Effect.flatMap((instance) =>
            // oxlint-disable-next-line typescript/promise-function-async -- Better Auth exposes its adapter context as a native Promise.
            Effect.promise(() => instance.$context)
          ),
          Effect.flatMap((context) =>
            Effect.promise(
              // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's database adapter answers with native Promises.
              () =>
                context.adapter.findOne({
                  model: "user",
                  where: [{ field: "handle", value: handle }],
                })
            )
          ),
          Effect.map((user) => user !== null)
        );

      const accountForSession = (token: string) =>
        auth.getSession(bearerHeaders(token)).pipe(
          Effect.orDie,
          Effect.flatMap((session) =>
            session === null
              ? Effect.fail(new Unauthenticated())
              : decodeAccount(session.user).pipe(Effect.orDie)
          ),
          withRuntime
        );

      return Accounts.of({
        accountForSession,
        signIn: ({ email, password }) =>
          failWhenCode(
            auth.api.signInEmail({ body: { email, password } }),
            "INVALID_EMAIL_OR_PASSWORD",
            new InvalidCredentials()
          ).pipe(
            Effect.flatMap(({ token, user }) =>
              decodeSignedIn({ account: user, session: { token } }).pipe(
                Effect.orDie
              )
            ),
            withRuntime
          ),
        signOut: (token) =>
          accountForSession(token).pipe(
            Effect.andThen(
              auth.api
                .signOut({ headers: bearerHeaders(token) })
                .pipe(Effect.orDie, withRuntime)
            ),
            Effect.asVoid
          ),
        signUp: ({ email, handle, password }) =>
          Effect.gen(function* signUpWithBetterAuth() {
            if (yield* handleIsTaken(handle)) {
              return yield* new HandleTaken({ handle });
            }

            const created = yield* failWhenCode(
              auth.api.signUpEmail({
                body: { email, handle, name: handle, password },
              }),
              "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
              new EmailTaken()
            );

            return yield* decodeSignedIn({
              account: created.user,
              session: { token: created.token },
            }).pipe(Effect.orDie);
          }).pipe(withRuntime),
      });
    })
  );

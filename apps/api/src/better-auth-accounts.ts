import { BetterAuth } from "@alchemy.run/better-auth";
import type {
  BetterAuthApiError,
  BetterAuthProps,
} from "@alchemy.run/better-auth";
import {
  Account,
  Accounts,
  EmailTaken,
  HandleNeeded,
  HandleTaken,
  InvalidCredentials,
  SessionAccount,
  SignedInAccount,
  SignedInWithGoogle,
  Unauthenticated,
} from "@savour/core";
import type { AccountsService, GoogleSignInOutcome } from "@savour/core";
import { RuntimeContext } from "alchemy";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { bearer } from "better-auth/plugins";
import { google as googleSocialProvider } from "better-auth/social-providers";
import type { GoogleOptions } from "better-auth/social-providers";
import { Data, Effect, Layer, Option, Redacted, Schema } from "effect";

import { GoogleAccountNotCreated } from "./google-account-not-created.js";

export interface GoogleSignInOptions extends Pick<
  GoogleOptions,
  "getUserInfo" | "verifyIdToken"
> {
  readonly clientId: Redacted.Redacted;
}

export interface BetterAuthAccountsOptions {
  readonly google: GoogleSignInOptions;
  readonly secret?: BetterAuthProps["secret"];
}

const baseAuthOptions = {
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

const googleProviderOptions = ({
  clientId,
  ...verifier
}: GoogleSignInOptions) =>
  ({
    ...verifier,
    clientId: Redacted.value(clientId),
    disableImplicitSignUp: true,
  }) satisfies GoogleOptions;

const authOptionsWith = (googleOptions: GoogleOptions) =>
  ({
    ...baseAuthOptions,
    socialProviders: { google: googleOptions },
  }) satisfies BetterAuthProps;

const GoogleIdentity = Schema.Struct({
  data: Schema.Struct({ sub: Schema.NonEmptyString }),
  user: Schema.Struct({
    email: Schema.NonEmptyString,
    emailVerified: Schema.optional(Schema.Boolean),
  }),
});

const decodeGoogleIdentity = Schema.decodeUnknownEffect(GoogleIdentity);

const decodeSocialSession = Schema.decodeUnknownEffect(
  Schema.Struct({ token: Schema.NonEmptyString, user: Account })
);

const decodeSignedInWithGoogle = Schema.decodeUnknownEffect(SignedInWithGoogle);

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

const decodeSessionAccount = Schema.decodeUnknownEffect(SessionAccount);

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

export const betterAuthAccounts = ({
  google,
  secret,
}: BetterAuthAccountsOptions) =>
  Layer.effect(
    Accounts,
    Effect.gen(function* makeBetterAuthAccounts() {
      const googleOptions = googleProviderOptions(google);
      const googleProvider = googleSocialProvider(googleOptions);
      const authOptions = authOptionsWith(googleOptions);

      const auth = yield* BetterAuth(
        secret === undefined ? authOptions : { ...authOptions, secret }
      );

      const authContext = auth.auth.pipe(
        Effect.flatMap((instance) =>
          // oxlint-disable-next-line typescript/promise-function-async -- Better Auth exposes its adapter context as a native Promise.
          Effect.promise(() => instance.$context)
        )
      );

      const handleIsTaken = (handle: string) =>
        authContext.pipe(
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

      const emailIsTaken = (email: string) =>
        authContext.pipe(
          Effect.flatMap((context) =>
            Effect.promise(
              // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's internal adapter answers with native Promises.
              () => context.internalAdapter.findUserByEmail(email)
            )
          ),
          Effect.map((found) => found !== null)
        );

      const explainSignUpFailure = (
        { email, handle }: { readonly email: string; readonly handle: string },
        apiFailure: BetterAuthApiError
      ) =>
        Effect.gen(function* findWhoClaimedIt() {
          const code = apiFailure.body?.code;

          if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
            return yield* new EmailTaken();
          }

          if (code !== "FAILED_TO_CREATE_USER") {
            return yield* Effect.die(apiFailure);
          }

          if (yield* handleIsTaken(handle)) {
            return yield* new HandleTaken({ handle });
          }

          if (yield* emailIsTaken(email)) {
            return yield* new EmailTaken();
          }

          return yield* Effect.die(apiFailure);
        });

      const verifiedGoogleIdentity = (idToken: string) =>
        Effect.gen(function* verifyWithGoogle() {
          const authentic = yield* Effect.promise(
            // oxlint-disable-next-line typescript/promise-function-async -- Better Auth verifies ID tokens with native Promises.
            () => verifyProviderIdToken(googleProvider, idToken)
          );

          if (!authentic) {
            return yield* new InvalidCredentials();
          }

          const userInfo = yield* Effect.promise(
            // oxlint-disable-next-line typescript/promise-function-async -- Better Auth reads provider profiles with native Promises.
            () => googleProvider.getUserInfo({ idToken })
          );

          return yield* decodeGoogleIdentity(userInfo).pipe(
            Effect.mapError(() => new InvalidCredentials())
          );
        });

      const googleAccountExists = (subject: string) =>
        authContext.pipe(
          Effect.flatMap((context) =>
            Effect.promise(
              // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's internal adapter answers with native Promises.
              () =>
                context.internalAdapter.findAccountByKey({
                  accountId: subject,
                  providerId: "google",
                })
            )
          ),
          Effect.map((found) => found !== null)
        );

      const userIdWithEmail = (email: string) =>
        authContext.pipe(
          Effect.flatMap((context) =>
            Effect.promise(
              // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's internal adapter answers with native Promises.
              () => context.internalAdapter.findUserByEmail(email)
            )
          ),
          Effect.map((found) => Option.fromNullishOr(found?.user.id))
        );

      const linkGoogleAccount = (userId: string, subject: string) =>
        authContext.pipe(
          Effect.flatMap((context) =>
            Effect.promise(
              // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's internal adapter answers with native Promises.
              () =>
                context.internalAdapter.linkAccount({
                  accountId: subject,
                  providerId: "google",
                  userId,
                })
            )
          ),
          Effect.asVoid
        );

      const createGoogleAccount = (
        identity: typeof GoogleIdentity.Type,
        handle: string
      ) => {
        const user = {
          email: identity.user.email,
          emailVerified: identity.user.emailVerified === true,
          handle,
          name: handle,
        };

        return authContext.pipe(
          Effect.flatMap((context) =>
            Effect.tryPromise({
              catch: (cause) => new GoogleAccountNotCreated({ cause }),
              // oxlint-disable-next-line typescript/promise-function-async -- Better Auth's internal adapter answers with native Promises.
              try: () =>
                context.internalAdapter.createOAuthUser(user, {
                  accountId: identity.data.sub,
                  providerId: "google",
                }),
            })
          ),
          Effect.matchEffect({
            onFailure: (notCreated) =>
              Effect.flatMap(handleIsTaken(handle), (claimed) =>
                claimed
                  ? Effect.fail(new HandleTaken({ handle }))
                  : Effect.die(notCreated)
              ),
            onSuccess: () => Effect.void,
          })
        );
      };

      const signInWithGoogleSession = (
        idToken: string,
        outcome: typeof GoogleSignInOutcome.Type
      ) =>
        failWhenCode(
          auth.api.signInSocial({
            body: { idToken: { token: idToken }, provider: "google" },
          }),
          "INVALID_TOKEN",
          new InvalidCredentials()
        ).pipe(
          Effect.flatMap((answer) =>
            decodeSocialSession(answer).pipe(Effect.orDie)
          ),
          Effect.flatMap(({ token, user }) =>
            decodeSignedInWithGoogle({
              account: user,
              outcome,
              session: { token },
            }).pipe(Effect.orDie)
          )
        );

      const signInWithGoogle: AccountsService["signInWithGoogle"] = ({
        handle,
        idToken,
      }) =>
        Effect.gen(function* signInWithGoogleIdentity() {
          const identity = yield* verifiedGoogleIdentity(idToken);

          if (yield* googleAccountExists(identity.data.sub)) {
            return yield* signInWithGoogleSession(idToken, "signed-in");
          }

          const owner = yield* userIdWithEmail(
            identity.user.email.toLowerCase()
          );

          if (Option.isSome(owner)) {
            if (identity.user.emailVerified !== true) {
              return yield* new InvalidCredentials();
            }

            yield* linkGoogleAccount(owner.value, identity.data.sub);

            return yield* signInWithGoogleSession(idToken, "linked");
          }

          if (handle === undefined) {
            return yield* new HandleNeeded();
          }

          if (yield* handleIsTaken(handle)) {
            return yield* new HandleTaken({ handle });
          }

          yield* createGoogleAccount(identity, handle);

          return yield* signInWithGoogleSession(idToken, "created");
        }).pipe(withRuntime);

      const accountForSession = (token: string) =>
        auth.getSession(bearerHeaders(token)).pipe(
          Effect.orDie,
          Effect.flatMap((session) =>
            session === null
              ? Effect.fail(new Unauthenticated())
              : decodeSessionAccount({
                  account: session.user,
                  accountId: session.user.id,
                }).pipe(Effect.orDie)
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
        signInWithGoogle,
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

            const created = yield* auth.api
              .signUpEmail({
                body: { email, handle, name: handle, password },
              })
              .pipe(
                Effect.catchTag("BetterAuthApiError", (apiFailure) =>
                  explainSignUpFailure({ email, handle }, apiFailure)
                )
              );

            return yield* decodeSignedIn({
              account: created.user,
              session: { token: created.token },
            }).pipe(Effect.orDie);
          }).pipe(withRuntime),
      });
    })
  );

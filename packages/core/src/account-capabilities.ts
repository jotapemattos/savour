import { implement } from "@savour/capability/implement";
import { Effect } from "effect";

import {
  currentAccountContract,
  signInContract,
  signInWithGoogleContract,
  signOutContract,
  signUpContract,
} from "./account-contracts.js";
import { Accounts } from "./accounts.js";
import { SessionCredential } from "./session-credential.js";
import { Unauthenticated } from "./unauthenticated.js";

export const signedInNextActions = [
  {
    description:
      "Read your own account with `GET /account` and the bearer token.",
    href: "/account",
    rel: "profile",
  },
  {
    description:
      "Sign out with `DELETE /sessions/current` and the bearer token.",
    href: "/sessions/current",
    rel: "logout",
  },
] as const;

export const signedOutNextActions = [
  {
    description: "Sign in again with `POST /sessions`.",
    href: "/sessions",
    rel: "login",
  },
  {
    description: "Create an account with `POST /accounts`.",
    href: "/accounts",
    rel: "create-form",
  },
] as const;

export const requireSessionToken = SessionCredential.pipe(
  Effect.flatMap(Effect.fromOption),
  Effect.mapError(() => new Unauthenticated())
);

export const signUp = implement(signUpContract, (input) =>
  Effect.gen(function* signUpAccount() {
    const accounts = yield* Accounts;
    const signedIn = yield* accounts.signUp(input);

    yield* Effect.logInfo("account.signed_up").pipe(
      Effect.annotateLogs({ handle: signedIn.account.handle })
    );

    return { ...signedIn, next: signedInNextActions };
  })
);

export const signIn = implement(signInContract, (input) =>
  Effect.gen(function* signInAccount() {
    const accounts = yield* Accounts;

    const signedIn = yield* accounts
      .signIn(input)
      .pipe(Effect.tapError(() => Effect.logInfo("account.sign_in_failed")));

    return { ...signedIn, next: signedInNextActions };
  })
);

const refusedGoogleOutcomes = {
  HandleNeeded: "handle-needed",
  HandleTaken: "handle-taken",
  InvalidCredentials: "refused",
} as const;

export const signInWithGoogle = implement(signInWithGoogleContract, (input) =>
  Effect.gen(function* signInAccountWithGoogle() {
    const accounts = yield* Accounts;

    const { outcome, ...signedIn } = yield* accounts
      .signInWithGoogle(input)
      .pipe(
        Effect.tapError((refusal) =>
          Effect.logInfo("account.google_sign_in").pipe(
            Effect.annotateLogs({
              outcome: refusedGoogleOutcomes[refusal._tag],
            })
          )
        )
      );

    yield* Effect.logInfo("account.google_sign_in").pipe(
      Effect.annotateLogs({ outcome })
    );

    return { ...signedIn, next: signedInNextActions };
  })
);

export const signOut = implement(signOutContract, () =>
  Effect.gen(function* signOutAccount() {
    const accounts = yield* Accounts;
    const token = yield* requireSessionToken;

    yield* accounts.signOut(token);

    return { next: signedOutNextActions };
  })
);

export const currentAccount = implement(currentAccountContract, () =>
  Effect.gen(function* readCurrentAccount() {
    const accounts = yield* Accounts;
    const token = yield* requireSessionToken;
    const { account } = yield* accounts.accountForSession(token);

    return { account, next: signedInNextActions };
  })
);

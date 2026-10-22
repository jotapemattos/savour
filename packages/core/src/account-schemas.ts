import { Schema } from "effect";

import { NextAction } from "./health-contracts.js";

export const Handle = Schema.String.check(
  Schema.isPattern(/^[a-z0-9_]{3,20}$/u)
).annotate({
  description: "3 to 20 lowercase letters, digits or underscores.",
});

export const Email = Schema.String.check(
  Schema.isPattern(/^[^\s@]+@[^\s@]+$/u)
);

export const NewPassword = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(128)
).annotate({ description: "8 to 128 characters." });

export const SessionToken = Schema.NonEmptyString;

export const Account = Schema.Struct({ email: Email, handle: Handle });

export const SessionAccount = Schema.Struct({
  account: Account,
  accountId: Schema.NonEmptyString,
});

export const SignedInAccount = Schema.Struct({
  account: Account,
  session: Schema.Struct({ token: SessionToken }),
});

export const GoogleSignInOutcome = Schema.Literals([
  "created",
  "linked",
  "signed-in",
]);

export const SignedInWithGoogle = Schema.Struct({
  ...SignedInAccount.fields,
  outcome: GoogleSignInOutcome,
});

export const SignedIn = Schema.Struct({
  ...SignedInAccount.fields,
  next: Schema.Array(NextAction),
});

export const AccountReport = Schema.Struct({
  account: Account,
  next: Schema.Array(NextAction),
});

export const SignedOut = Schema.Struct({ next: Schema.Array(NextAction) });

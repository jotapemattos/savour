import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import {
  AccountReport,
  Email,
  Handle,
  NewPassword,
  SignedIn,
  SignedOut,
} from "./account-schemas.js";
import { EmailTaken } from "./email-taken.js";
import { HandleNeeded } from "./handle-needed.js";
import { HandleTaken } from "./handle-taken.js";
import { InvalidCredentials } from "./invalid-credentials.js";
import { Unauthenticated } from "./unauthenticated.js";

export const SignUpInput = Schema.Struct({
  email: Email,
  handle: Handle,
  password: NewPassword,
});

export const SignInInput = Schema.Struct({
  email: Email,
  password: Schema.NonEmptyString,
});

export const SignInWithGoogleInput = Schema.Struct({
  handle: Schema.optional(Handle),
  idToken: Schema.NonEmptyString,
});

export const signUpContract = defineContract("signUp", {
  description:
    "Create a Savour account with an email, a password and a unique public handle, and sign it in. Send the returned session token as `Authorization: Bearer <token>`.",
  failure: Schema.Union([HandleTaken, EmailTaken]),
  http: { method: "POST", path: "/accounts" },
  input: SignUpInput,
  output: SignedIn,
});

export const signInContract = defineContract("signIn", {
  description:
    "Sign in with an email and password. Send the returned session token as `Authorization: Bearer <token>`.",
  failure: InvalidCredentials,
  http: { method: "POST", path: "/sessions" },
  input: SignInInput,
  output: SignedIn,
});

export const signInWithGoogleContract = defineContract("signInWithGoogle", {
  description:
    "Sign in with a Google ID token issued to Savour's Google client. An unknown Google identity fails with `HandleNeeded`; send the same token again with a `handle` to create the account. A verified Google email that matches an existing account signs in to that account. Send the returned session token as `Authorization: Bearer <token>`.",
  failure: Schema.Union([HandleNeeded, HandleTaken, InvalidCredentials]),
  http: { method: "POST", path: "/sessions/google" },
  input: SignInWithGoogleInput,
  output: SignedIn,
});

export const signOutContract = defineContract("signOut", {
  annotations: { destructive: true, idempotent: true },
  description: "End the session named by the bearer token.",
  failure: Unauthenticated,
  http: { method: "DELETE", path: "/sessions/current" },
  input: Schema.Struct({}),
  output: SignedOut,
});

export const currentAccountContract = defineContract("currentAccount", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read the account signed in with the bearer token.",
  failure: Unauthenticated,
  http: { method: "GET", path: "/account" },
  input: Schema.Struct({}),
  output: AccountReport,
});

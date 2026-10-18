import { SignInInput, SignUpInput } from "@savour/core/contracts";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, setCookie } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { accountSession } from "#/client/account-session";
import type { SessionGateway, SessionJar } from "#/client/account-session";

import { bindingTransport } from "./binding-transport";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "./session-cookie";

const cookieJar: SessionJar = {
  drop: Effect.sync(() => {
    deleteCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
  }),
  keep: (token) =>
    Effect.sync(() => {
      setCookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    }),
};

const accounts = () => accountSession(bindingTransport(), cookieJar);

const signUp = createServerFn({ method: "POST" })
  .validator(Schema.decodeUnknownSync(SignUpInput))
  // oxlint-disable-next-line typescript/promise-function-async -- TanStack Start runs server function handlers as native Promises.
  .handler(({ data }) => accounts().signUp(data));

const signIn = createServerFn({ method: "POST" })
  .validator(Schema.decodeUnknownSync(SignInInput))
  // oxlint-disable-next-line typescript/promise-function-async -- TanStack Start runs server function handlers as native Promises.
  .handler(({ data }) => accounts().signIn(data));

const signOut = createServerFn({ method: "POST" })
  // oxlint-disable-next-line typescript/promise-function-async -- TanStack Start runs server function handlers as native Promises.
  .handler(() => accounts().signOut());

export const cookieSession: SessionGateway = {
  // oxlint-disable-next-line typescript/promise-function-async -- Server function calls are native Promises.
  signIn: (data) => signIn({ data }),
  // oxlint-disable-next-line typescript/promise-function-async -- Server function calls are native Promises.
  signOut: () => signOut(),
  // oxlint-disable-next-line typescript/promise-function-async -- Server function calls are native Promises.
  signUp: (data) => signUp({ data }),
};

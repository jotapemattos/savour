import { Account } from "@savour/core/contracts";
import type { SignInInput, SignUpInput } from "@savour/core/contracts";
import { queryOptions } from "@tanstack/react-query";
import { Duration, Effect, Schema } from "effect";

import { savourApi } from "./savour-api";
import type { ApiTransport } from "./savour-api";

export const SignedIn = Schema.TaggedStruct("SignedIn", { account: Account });

export const SignedOut = Schema.TaggedStruct("SignedOut", {});

export const Refused = Schema.TaggedStruct("Refused", {
  reason: Schema.Literals([
    "EmailTaken",
    "HandleTaken",
    "InvalidCredentials",
    "TooManySignInAttempts",
  ]),
});

export const AccountUnreachable = Schema.TaggedStruct("AccountUnreachable", {});

export type SessionRefusal = (typeof Refused.Type)["reason"];

export type Viewer = typeof SignedIn.Type | typeof SignedOut.Type;

export type ViewerRead = Viewer | typeof AccountUnreachable.Type;

export type SessionOutcome = typeof SignedIn.Type | typeof Refused.Type;

export interface SessionGateway {
  readonly signIn: (input: typeof SignInInput.Type) => Promise<SessionOutcome>;
  readonly signOut: () => Promise<Viewer>;
  readonly signUp: (input: typeof SignUpInput.Type) => Promise<SessionOutcome>;
}

export interface SessionJar {
  readonly drop: Effect.Effect<void>;
  readonly keep: (token: string) => Effect.Effect<void>;
}

const signedOut: Viewer = SignedOut.make({});

const refused = (refusal: { readonly _tag: SessionRefusal }) =>
  Effect.succeed<SessionOutcome>(Refused.make({ reason: refusal._tag }));

const keptIn =
  (jar: SessionJar) =>
  (signedIn: {
    readonly account: typeof Account.Type;
    readonly session: { readonly token: string };
  }) =>
    jar
      .keep(signedIn.session.token)
      .pipe(
        Effect.as<SessionOutcome>(SignedIn.make({ account: signedIn.account }))
      );

export const accountSession = (
  transport: ApiTransport,
  jar: SessionJar
): SessionGateway => {
  const api = savourApi(transport);

  return {
    // oxlint-disable-next-line typescript/promise-function-async -- Server functions and TanStack Query mutations run as native Promises.
    signIn: (input) =>
      Effect.runPromise(
        api.pipe(
          Effect.flatMap((client) =>
            client.capabilities.signIn({ payload: input })
          ),
          Effect.flatMap(keptIn(jar)),
          Effect.catchTags({
            InvalidCredentials: refused,
            TooManySignInAttempts: refused,
          }),
          Effect.provide(transport.layer)
        )
      ),
    // oxlint-disable-next-line typescript/promise-function-async -- Server functions and TanStack Query mutations run as native Promises.
    signOut: () =>
      Effect.runPromise(
        api.pipe(
          Effect.flatMap((client) =>
            client.capabilities.signOut({ query: {} })
          ),
          Effect.catchTag("Unauthenticated", () => Effect.void),
          Effect.ensuring(jar.drop),
          Effect.as(signedOut),
          Effect.provide(transport.layer)
        )
      ),
    // oxlint-disable-next-line typescript/promise-function-async -- Server functions and TanStack Query mutations run as native Promises.
    signUp: (input) =>
      Effect.runPromise(
        api.pipe(
          Effect.flatMap((client) =>
            client.capabilities.signUp({ payload: input })
          ),
          Effect.flatMap(keptIn(jar)),
          Effect.catchTags({ EmailTaken: refused, HandleTaken: refused }),
          Effect.provide(transport.layer)
        )
      ),
  };
};

const VIEWER_READ_LIMIT = Duration.seconds(2);

const readViewer = (transport: ApiTransport) =>
  savourApi(transport).pipe(
    Effect.flatMap((client) =>
      client.capabilities.currentAccount({ query: {} })
    ),
    Effect.map((report): ViewerRead =>
      SignedIn.make({ account: report.account })
    ),
    Effect.catchTag("Unauthenticated", () =>
      Effect.succeed<ViewerRead>(signedOut)
    ),
    Effect.timeout(VIEWER_READ_LIMIT),
    Effect.orElseSucceed((): ViewerRead => AccountUnreachable.make({})),
    Effect.provide(transport.layer)
  );

export const viewerQuery = (transport: ApiTransport) =>
  queryOptions({
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Query runs query functions as native Promises.
    queryFn: () => Effect.runPromise(readViewer(transport)),
    queryKey: ["account", "current"],
  });

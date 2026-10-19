import { Unauthenticated } from "@savour/core";
import { Effect, Layer, Predicate, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { accountSession } from "../../src/client/account-session";
import type { ApiTransport } from "../../src/client/savour-api";

export interface ScriptedReply {
  readonly body: unknown;
  readonly status: number;
}

const healthy: ScriptedReply = {
  body: { next: [], service: "savour-api", status: "ok" },
  status: 200,
};

export const refusedWith = <A>(
  error: Schema.Codec<A, unknown>,
  value: A,
  status: number
): ScriptedReply => ({
  body: Schema.encodeSync(error)(value),
  status,
});

const signedOut = refusedWith(Unauthenticated, new Unauthenticated(), 401);

const missing: ScriptedReply = { body: {}, status: 404 };

const decodeJsonBody = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

export const signedInAs = (handle: string): ScriptedReply => ({
  body: {
    account: { email: `${handle}@example.test`, handle },
    next: [],
    session: { token: `tok_${handle}` },
  },
  status: 200,
});

export const scriptedApi = (
  script: Readonly<Record<string, ScriptedReply>>,
  requests: string[] = [],
  payloads: unknown[] = []
): ApiTransport => {
  const replies = new Map(
    Object.entries({
      "GET /api/account": signedOut,
      "GET /api/health": healthy,
      ...script,
    })
  );

  return {
    baseUrl: "http://localhost:3000/api",
    layer: Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request, url) =>
        Effect.sync(() => {
          const route = `${request.method} ${url.pathname}`;
          const reply = replies.get(route) ?? missing;
          requests.push(route);

          if (Predicate.isTagged(request.body, "Uint8Array")) {
            payloads.push(
              decodeJsonBody(new TextDecoder().decode(request.body.body))
            );
          }

          return HttpClientResponse.fromWeb(
            request,
            Response.json(reply.body, { status: reply.status })
          );
        })
      )
    ),
  };
};

export const memorySession = (api: ApiTransport, kept: string[] = []) =>
  accountSession(api, {
    drop: Effect.sync(() => {
      kept.splice(0);
    }),
    keep: (token) =>
      Effect.sync(() => {
        kept.push(token);
      }),
  });

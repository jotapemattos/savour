import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient, HttpClientRequest } from "effect/http";

import { send, workerWithApi } from "./fixtures/worker-with-api";

const forwardedFrom = (origin: string, cookie: string) =>
  send(
    origin,
    HttpClientRequest.get("/api/account").pipe(
      HttpClientRequest.setHeader("cookie", cookie)
    )
  ).pipe(Effect.flatMap((response) => response.json));

describe("sign-up and sign-in screens", () => {
  it.live("sends the session cookie to the API as a bearer token", () =>
    Effect.gen(function* forwardsSessionAsBearer() {
      const origin = yield* workerWithApi("echo");

      expect(
        yield* forwardedFrom(origin, "theme=dark; savour_session=tok_ana.123")
      ).toMatchObject({
        authorization: "Bearer tok_ana.123",
        cookie: null,
        path: "/account",
      });
      expect(yield* forwardedFrom(origin, "theme=dark")).toMatchObject({
        authorization: null,
        cookie: null,
      });
    }).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer))
  );
});

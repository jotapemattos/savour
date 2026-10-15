import { it } from "@effect/vitest";
import { Context, Effect, Layer, Logger, Schema } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { expect } from "vitest";

import { observeRequestLog } from "../src/request-log.js";

const Segment = Schema.String.check(Schema.isPattern(/^[a-z0-9]{1,12}$/u));

it.effect.prop(
  "request logs hold method, path, status and time, and never the query",
  {
    query: Arbitrary.schema(Segment),
    secret: Arbitrary.schema(Segment),
    status: Arbitrary.schema(Schema.Literals([200, 202, 404, 500])),
  },
  ({ query, secret: suffix, status }) => {
    const secret = `sekrit${suffix}`;

    return Effect.acquireUseRelease(
      Effect.sync(() => {
        const logs: unknown[] = [];

        const web = HttpRouter.toWebHandler(
          Layer.mergeAll(
            HttpRouter.middleware((app) => observeRequestLog(app), {
              global: true,
            }),
            HttpRouter.add("GET", "/tokenmaxx/confirm", () =>
              Effect.succeed(HttpServerResponse.empty({ status }))
            ).pipe(Layer.provide(Layer.empty))
          ).pipe(
            Layer.provideMerge(
              Logger.layer([
                Logger.make(({ message }) => {
                  logs.push(message);
                }),
              ])
            )
          ),
          { disableLogger: true }
        );

        return { logs, web };
      }),
      ({ logs, web }) =>
        Effect.gen(function* checkLogs() {
          const request = new Request(
            `https://ratstack.sh/tokenmaxx/confirm?token=${secret}&q=${query}`
          );

          yield* Effect.promise(
            web.handler.bind(undefined, request, Context.empty())
          );
          const serialized = JSON.stringify(logs);
          expect(serialized).toContain("/tokenmaxx/confirm");
          expect(serialized).toContain(String(status));
          expect(serialized).not.toContain(secret);
          expect(serialized).not.toContain("token=");
        }),
      ({ web }) => Effect.promise(web.dispose)
    );
  }
);

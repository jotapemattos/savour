import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  CannotLikeOwnReview,
  Database,
  LikedReview,
  LoggedVisit,
  NotAReview,
  SignedIn,
  Unauthenticated,
  VisitNotFound,
  likeReviewAction,
  unlikeReviewAction,
} from "@savour/core";
import type { LogVisitInput } from "@savour/core";
import { Effect, Layer, Schema } from "effect";
import { HttpBody, HttpClient, HttpRouter } from "effect/http";
import type { HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { apiRoutes } from "../src/app.js";
import { FakePlaceSearch } from "./fixtures/fake-place-search.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";
import { memoryVisits } from "./fixtures/memory-visits.js";

const serveWith = (visits: ReturnType<typeof memoryVisits>) =>
  HttpRouter.serve(
    apiRoutes.pipe(
      Layer.provide(MemoryAccounts),
      Layer.provide(FakePlaceSearch),
      Layer.provide(visits.layer),
      Layer.provide(
        Layer.succeed(Database, { selectOne: Effect.succeed<1>(1) })
      )
    ),
    { disableListenLog: true, disableLogger: true }
  ).pipe(Layer.provideMerge(NodeHttpServer.layerTest), withTestRuntime);

const onToday = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TestClock.setTime(Date.parse("2026-10-19T12:00:00Z")).pipe(
    Effect.andThen(effect)
  );

const signUpAs = (handle: string) =>
  HttpClient.post("/accounts", {
    body: HttpBody.jsonUnsafe({
      email: `${handle}@example.test`,
      handle,
      password: "correct horse 9",
    }),
  }).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(SignedIn)),
    Effect.map(({ session }) => session.token)
  );

const logAs = (
  token: string,
  body: Pick<typeof LogVisitInput.Encoded, "review">
) =>
  HttpClient.post("/visits", {
    body: HttpBody.jsonUnsafe({
      date: "2026-10-10",
      placeId: "ChIJbraganca",
      ...body,
    }),
    headers: { authorization: `Bearer ${token}` },
  }).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(LoggedVisit)),
    Effect.map(({ visit }) => visit.id)
  );

const likeAs = (token: string, visitId: string) =>
  HttpClient.put(`/visits/${visitId}/like`, {
    body: HttpBody.jsonUnsafe({}),
    headers: { authorization: `Bearer ${token}` },
  });

const unlikeAs = (token: string, visitId: string) =>
  HttpClient.del(`/visits/${visitId}/like`, {
    headers: { authorization: `Bearer ${token}` },
  });

const likedReviewOf = <E, R>(
  request: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
) =>
  request.pipe(
    Effect.flatMap((response) => {
      expect(response.status).toBe(200);

      return response.json;
    }),
    Effect.flatMap(Schema.decodeUnknownEffect(LikedReview))
  );

const refusedWith =
  (status: number) =>
  <E, R>(request: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>) =>
    request.pipe(
      Effect.flatMap((response) => {
        expect(response.status).toBe(status);

        return response.json;
      })
    );

const anaAndBiasReview = Effect.gen(function* signUpAnaAndBia() {
  const bia = yield* signUpAs("bia");
  const visitId = yield* logAs(bia, { review: "Crispy crust, slow service." });
  const ana = yield* signUpAs("ana");

  return { ana, bia, visitId };
});

describe("review likes", () => {
  it.effect("increments the like count by one", () =>
    Effect.gen(function* likesOnce() {
      const { ana, visitId } = yield* anaAndBiasReview;

      expect(yield* likedReviewOf(likeAs(ana, visitId))).toStrictEqual({
        likeCount: 1,
        likedByMe: true,
        next: [unlikeReviewAction],
        visitId,
      });
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("does not double-count a second like", () => {
    const visits = memoryVisits();

    return Effect.gen(function* likesTwice() {
      const { ana, visitId } = yield* anaAndBiasReview;

      yield* likeAs(ana, visitId);
      const again = yield* likedReviewOf(likeAs(ana, visitId));

      expect(again.likeCount).toBe(1);
      expect(visits.likes).toHaveLength(1);
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });

  it.effect("removes the like on unlike", () =>
    Effect.gen(function* unlikes() {
      const { ana, visitId } = yield* anaAndBiasReview;

      yield* likeAs(ana, visitId);

      expect(yield* likedReviewOf(unlikeAs(ana, visitId))).toStrictEqual({
        likeCount: 0,
        likedByMe: false,
        next: [likeReviewAction],
        visitId,
      });
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("only applies to logs with a review", () =>
    Effect.gen(function* refusesBareLog() {
      const bia = yield* signUpAs("bia");
      const visitId = yield* logAs(bia, {});
      const ana = yield* signUpAs("ana");

      expect(
        yield* refusedWith(409)(likeAs(ana, visitId)).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(NotAReview))
        )
      ).toStrictEqual(new NotAReview({ visitId }));
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("cannot like your own review", () => {
    const visits = memoryVisits();

    return Effect.gen(function* refusesOwnReview() {
      const { bia, visitId } = yield* anaAndBiasReview;

      expect(
        yield* refusedWith(403)(likeAs(bia, visitId)).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CannotLikeOwnReview))
        )
      ).toStrictEqual(new CannotLikeOwnReview({ visitId }));
      expect(visits.likes).toStrictEqual([]);
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });

  it.effect("answers 404 for a visit that does not exist", () =>
    Effect.gen(function* refusesMissing() {
      const ana = yield* signUpAs("ana");

      for (const request of [
        likeAs(ana, "visit-404"),
        unlikeAs(ana, "visit-404"),
      ]) {
        expect(
          yield* refusedWith(404)(request).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(VisitNotFound))
          )
        ).toStrictEqual(new VisitNotFound({ visitId: "visit-404" }));
      }
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("refuses to like without a session", () => {
    const visits = memoryVisits();

    return Effect.gen(function* refusesAnonymous() {
      const { visitId } = yield* anaAndBiasReview;

      expect(
        yield* refusedWith(401)(
          HttpClient.put(`/visits/${visitId}/like`, {
            body: HttpBody.jsonUnsafe({}),
          })
        ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Unauthenticated)))
      ).toStrictEqual(new Unauthenticated());
      expect(visits.likes).toStrictEqual([]);
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });

  it.effect("deletes a review's likes with the visit", () => {
    const visits = memoryVisits();

    return Effect.gen(function* deletesLikes() {
      const { ana, bia, visitId } = yield* anaAndBiasReview;

      yield* likeAs(ana, visitId);
      yield* HttpClient.del(`/visits/${visitId}`, {
        headers: { authorization: `Bearer ${bia}` },
      });

      expect(visits.likes).toStrictEqual([]);
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });
});

import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Database,
  Diary,
  PlaceSearch,
  PlaceSearchUnavailable,
  InvalidRating,
  InvalidVisitDate,
  LoggedVisit,
  SignedIn,
  Unauthenticated,
  logVisitAction,
  readDiaryAction,
  Visits,
} from "@savour/core";
import type { LogVisitInput } from "@savour/core";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpBody, HttpClient, HttpRouter } from "effect/http";
import type { HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { apiRoutes } from "../src/app.js";
import {
  FakePlaceSearch,
  pizzariaBraganca,
} from "./fixtures/fake-place-search.js";
import { MemoryAccounts, withTestRuntime } from "./fixtures/memory-accounts.js";
import { memoryVisits } from "./fixtures/memory-visits.js";

const TODAY = "2026-10-19";

const restaurantR = {
  id: "restaurant-ChIJbraganca",
  placeId: "ChIJbraganca",
  source: "provider",
} as const;

const countingPlaces = () => {
  const asked: string[] = [];

  const layer = Layer.succeed(PlaceSearch, {
    details: (placeId) =>
      Effect.suspend(() => {
        asked.push(placeId);

        return placeId === "ChIJbroken"
          ? Effect.fail(new PlaceSearchUnavailable({ reason: "refused" }))
          : Effect.succeed({
              ...pizzariaBraganca,
              name: `Place ${placeId}`,
              placeId,
            });
      }),
    search: () => Effect.succeed([]),
  });

  return { asked, layer };
};

const serveWith = (
  visits: ReturnType<typeof memoryVisits>,
  places: Layer.Layer<PlaceSearch> = FakePlaceSearch
) =>
  HttpRouter.serve(
    apiRoutes.pipe(
      Layer.provide(MemoryAccounts),
      Layer.provide(places),
      Layer.provide(visits.layer),
      Layer.provide(
        Layer.succeed(Database, { selectOne: Effect.succeed<1>(1) })
      )
    ),
    { disableListenLog: true, disableLogger: true }
  ).pipe(Layer.provideMerge(NodeHttpServer.layerTest), withTestRuntime);

const onToday = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TestClock.setTime(Date.parse(`${TODAY}T12:00:00Z`)).pipe(
    Effect.andThen(effect)
  );

const signUpAna = Effect.gen(function* signUpAna() {
  const response = yield* HttpClient.post("/accounts", {
    body: HttpBody.jsonUnsafe({
      email: "ana@example.test",
      handle: "ana",
      password: "correct horse 9",
    }),
  });

  return (yield* Schema.decodeUnknownEffect(SignedIn)(yield* response.json))
    .session.token;
});

const logAs = (
  token: string,
  body: Omit<typeof LogVisitInput.Encoded, "placeId"> &
    Partial<Pick<typeof LogVisitInput.Encoded, "placeId">>
) =>
  HttpClient.post("/visits", {
    body: HttpBody.jsonUnsafe({ placeId: "ChIJbraganca", ...body }),
    headers: { authorization: `Bearer ${token}` },
  });

const diaryOf = (token: string) =>
  HttpClient.get("/diary", {
    headers: { authorization: `Bearer ${token}` },
  }).pipe(
    Effect.flatMap((response) => response.json),
    Effect.flatMap(Schema.decodeUnknownEffect(Diary))
  );

const refusalOf = <E, R>(
  request: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
) =>
  Effect.gen(function* readRefusal() {
    const response = yield* request;

    expect(response.status).toBe(400);

    return yield* response.json;
  });

const decodeInvalidRating = Schema.decodeUnknownEffect(InvalidRating);

const decodeInvalidVisitDate = Schema.decodeUnknownEffect(InvalidVisitDate);

describe("visit logging", () => {
  it.effect("logs a visit and shows it at the top of the diary", () => {
    const visits = memoryVisits();

    return Effect.gen(function* logsVisit() {
      const token = yield* signUpAna;
      const response = yield* logAs(token, { date: "2026-10-10", rating: 4 });

      expect(response.status).toBe(200);

      const logged = yield* Schema.decodeUnknownEffect(LoggedVisit)(
        yield* response.json
      );

      const diary = yield* diaryOf(token);

      expect(logged.next).toStrictEqual([readDiaryAction]);
      expect(diary.next).toStrictEqual([logVisitAction]);
      expect(diary.visits[0]).toMatchObject({
        date: "2026-10-10",
        rating: 4,
        restaurant: restaurantR,
      });
      expect(Object.keys(diary.visits[0] ?? {})).not.toContain("accountId");
      expect(JSON.stringify(diary)).not.toContain(
        visits.stored[0]?.accountId ?? "missing"
      );
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });

  it.effect("accepts only half-star ratings between 0.5 and 5", () =>
    Effect.gen(function* checksRatings() {
      const token = yield* signUpAna;

      for (const rating of [0.5, 3.5, 5]) {
        const accepted = yield* logAs(token, { date: TODAY, rating });

        expect(accepted.status).toBe(200);
      }

      for (const rating of [0, 4.25, 5.5]) {
        const refused = yield* refusalOf(
          logAs(token, { date: TODAY, rating })
        ).pipe(Effect.flatMap(decodeInvalidRating));

        expect(refused).toStrictEqual(new InvalidRating({ rating }));
      }
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("saves a log with only a date", () =>
    Effect.gen(function* savesDateOnly() {
      const token = yield* signUpAna;
      const response = yield* logAs(token, { date: "2026-10-10" });
      const diary = yield* diaryOf(token);

      expect(response.status).toBe(200);
      expect(diary.visits).toStrictEqual([
        {
          date: "2026-10-10",
          dishes: [],
          id: "visit-1",
          lovedIt: false,
          place: pizzariaBraganca,
          rating: null,
          restaurant: restaurantR,
          review: null,
          revisit: false,
          tags: [],
        },
      ]);
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("never stores a time of day", () => {
    const visits = memoryVisits();

    return Effect.gen(function* refusesTimeOfDay() {
      const token = yield* signUpAna;

      const refused = yield* refusalOf(
        logAs(token, { date: "2026-10-10T21:30" })
      ).pipe(Effect.flatMap(decodeInvalidVisitDate));

      expect(refused).toStrictEqual(
        new InvalidVisitDate({ date: "2026-10-10T21:30", reason: "not-a-day" })
      );
      expect(visits.stored).toStrictEqual([]);
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });

  it.effect("rejects a visit dated in the future", () =>
    Effect.gen(function* refusesFuture() {
      const token = yield* signUpAna;

      const refused = yield* refusalOf(
        logAs(token, { date: "2026-10-20" })
      ).pipe(Effect.flatMap(decodeInvalidVisitDate));

      expect(refused).toStrictEqual(
        new InvalidVisitDate({ date: "2026-10-20", reason: "in-the-future" })
      );
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("uses the latest visit as the current rating", () => {
    const visits = memoryVisits();

    return Effect.gen(function* keepsAllRatings() {
      const token = yield* signUpAna;

      yield* logAs(token, { date: "2026-10-01", rating: 3.5 });
      yield* logAs(token, { date: "2026-10-05", rating: 4 });
      yield* logAs(token, { date: "2026-10-09", rating: 4.5 });

      const diary = yield* diaryOf(token);
      const accountId = visits.stored[0]?.accountId ?? "missing";

      expect(diary.visits.map(({ rating }) => rating)).toStrictEqual([
        4.5, 4, 3.5,
      ]);
      expect(
        yield* Visits.use((store) =>
          store.currentRating(accountId, restaurantR.id)
        ).pipe(Effect.provide(visits.layer))
      ).toStrictEqual(Option.some(4.5));
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });

  it.effect("orders by visit date, not by when it was entered", () =>
    Effect.gen(function* ordersByVisitDate() {
      const token = yield* signUpAna;

      yield* logAs(token, { date: "2026-10-09" });
      yield* logAs(token, { date: "2026-10-01" });

      const diary = yield* diaryOf(token);

      expect(diary.visits[0]?.date).toBe("2026-10-09");
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("refuses to log without a session", () => {
    const visits = memoryVisits();

    return Effect.gen(function* refusesAnonymous() {
      const response = yield* HttpClient.post("/visits", {
        body: HttpBody.jsonUnsafe({ date: TODAY, placeId: "ChIJbraganca" }),
      });

      expect(response.status).toBe(401);
      expect(
        yield* Schema.decodeUnknownEffect(Unauthenticated)(yield* response.json)
      ).toStrictEqual(new Unauthenticated());
      expect(visits.stored).toStrictEqual([]);
    }).pipe(onToday, Effect.provide(serveWith(visits)));
  });
});

describe("diary with places", () => {
  it.effect("names the restaurant of each visit", () =>
    Effect.gen(function* namesRestaurants() {
      const token = yield* signUpAna;

      yield* logAs(token, { date: "2026-10-10" });

      const diary = yield* diaryOf(token);

      expect(diary.visits[0]?.place?.name).toBe("Pizzaria Bella Bragança");
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );

  it.effect("asks Google once per distinct place", () => {
    const places = countingPlaces();

    return Effect.gen(function* asksOncePerPlace() {
      const token = yield* signUpAna;

      yield* logAs(token, { date: "2026-10-01" });
      yield* logAs(token, { date: "2026-10-05" });
      yield* logAs(token, { date: "2026-10-09", placeId: "ChIJcampinas" });
      places.asked.splice(0);

      const diary = yield* diaryOf(token);

      expect(places.asked.toSorted()).toStrictEqual([
        "ChIJbraganca",
        "ChIJcampinas",
      ]);
      expect(diary.visits.map(({ place }) => place?.name)).toStrictEqual([
        "Place ChIJcampinas",
        "Place ChIJbraganca",
        "Place ChIJbraganca",
      ]);
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits(), places.layer)));
  });

  it.effect("still answers when Google fails for a place", () => {
    const places = countingPlaces();

    return Effect.gen(function* answersWithoutPlace() {
      const token = yield* signUpAna;

      yield* logAs(token, { date: "2026-10-01", placeId: "ChIJbroken" });
      yield* logAs(token, { date: "2026-10-05" });

      const response = yield* HttpClient.get("/diary", {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);

      const diary = yield* Schema.decodeUnknownEffect(Diary)(
        yield* response.json
      );

      expect(
        diary.visits.map(({ place }) => place?.name ?? null)
      ).toStrictEqual(["Place ChIJbraganca", null]);
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits(), places.layer)));
  });

  it.effect("names the restaurant in the logVisit answer", () =>
    Effect.gen(function* namesLoggedVisit() {
      const token = yield* signUpAna;
      const response = yield* logAs(token, { date: "2026-10-10" });

      const logged = yield* Schema.decodeUnknownEffect(LoggedVisit)(
        yield* response.json
      );

      expect(logged.visit.place?.name).toBe("Pizzaria Bella Bragança");
    }).pipe(onToday, Effect.provide(serveWith(memoryVisits())))
  );
});

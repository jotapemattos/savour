import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Option, Schema } from "effect";

import {
  PlaceSearch,
  PlaceSearchUnavailable,
  addRestaurantAction,
  searchRestaurants,
  searchRestaurantsContract,
} from "../src/index.js";
import type { LatLng, Place } from "../src/index.js";

const pizzariaBraganca: typeof Place.Type = {
  address: "R. Cel. Teófilo Leme, 1240 - Centro, Bragança Paulista - SP",
  cuisine: "Pizza",
  name: "Pizzaria Bella Bragança",
  placeId: "ChIJbraganca",
  priceLevel: 2,
};

const ramenCampinas: typeof Place.Type = {
  address: "Av. Norte Sul, 1500 - Cambuí, Campinas - SP",
  cuisine: "Ramen",
  name: "Ramen Campinas",
  placeId: "ChIJcampinas",
  priceLevel: 2,
};

const answering = (places: readonly (typeof Place.Type)[]) => {
  const queries: string[] = [];
  const nears: Option.Option<typeof LatLng.Type>[] = [];

  const layer = Layer.succeed(PlaceSearch, {
    details: () =>
      Effect.fail(new PlaceSearchUnavailable({ reason: "refused" })),
    search: (query, near) =>
      Effect.sync(() => {
        queries.push(query);
        nears.push(near);

        return places;
      }),
  });

  return { layer, nears, queries };
};

describe("restaurant search", () => {
  it.effect("finds a Bragança Paulista restaurant", () =>
    Effect.gen(function* findsBraganca() {
      const fake = answering([pizzariaBraganca]);

      const found = yield* searchRestaurants
        .handler({ q: "pizzaria bragança paulista" })
        .pipe(Effect.provide(fake.layer));

      expect(fake.queries).toStrictEqual(["pizzaria bragança paulista"]);
      expect(found.results).toHaveLength(1);
      expect(found.results[0]?.name).toBe("Pizzaria Bella Bragança");
      expect(found.results[0]?.address).toContain("Bragança Paulista - SP");
    })
  );

  it.effect("finds a restaurant outside the focus cities", () =>
    Effect.gen(function* findsCampinas() {
      const found = yield* searchRestaurants
        .handler({ q: "ramen campinas" })
        .pipe(Effect.provide(answering([ramenCampinas]).layer));

      expect(found.results).toStrictEqual([ramenCampinas]);
    })
  );

  it.effect(
    "returns an empty list with an add-a-restaurant link when nothing matches",
    () =>
      Effect.gen(function* answersEmpty() {
        const found = yield* searchRestaurants
          .handler({ q: "nothing like this" })
          .pipe(Effect.provide(answering([]).layer));

        expect(found.results).toHaveLength(0);
        expect(found.next).toContainEqual(addRestaurantAction);
      })
  );

  it.effect("surfaces provider failure as a typed error", () =>
    Effect.gen(function* failsTyped() {
      const unavailable = new PlaceSearchUnavailable({ reason: "unreachable" });

      const exit = yield* searchRestaurants.handler({ q: "pizzaria" }).pipe(
        Effect.provideService(PlaceSearch, {
          details: () => Effect.fail(unavailable),
          search: () => Effect.fail(unavailable),
        }),
        Effect.exit
      );

      expect(exit).toStrictEqual(Exit.fail(unavailable));
    })
  );

  it.effect("searches without a location when near is absent", () =>
    Effect.gen(function* searchesAnywhere() {
      const fake = answering([pizzariaBraganca]);

      yield* searchRestaurants
        .handler({ q: "pizzaria" })
        .pipe(Effect.provide(fake.layer));

      expect(fake.nears).toStrictEqual([Option.none()]);
    })
  );

  it.effect("hands the searcher's location to the place search", () =>
    Effect.gen(function* searchesNear() {
      const fake = answering([pizzariaBraganca]);

      yield* searchRestaurants
        .handler({
          near: { latitude: -22.95, longitude: -46.54 },
          q: "pizzaria",
        })
        .pipe(Effect.provide(fake.layer));

      expect(fake.nears).toStrictEqual([
        Option.some({ latitude: -22.95, longitude: -46.54 }),
      ]);
    })
  );

  it("reads near from `latitude,longitude` text", () => {
    const decodeInput = Schema.decodeOption(searchRestaurantsContract.input);

    expect(decodeInput({ near: "-22.95,-46.54", q: "pizzaria" })).toStrictEqual(
      Option.some({
        near: { latitude: -22.95, longitude: -46.54 },
        q: "pizzaria",
      })
    );
    expect(
      Schema.encodeSync(searchRestaurantsContract.input)({
        near: { latitude: -22.95, longitude: -46.54 },
        q: "pizzaria",
      })
    ).toStrictEqual({ near: "-22.95,-46.54", q: "pizzaria" });
  });

  it.each(["-91,10", "10,181", "abc", "-22.95", "-22.95,-46.54,3", ""])(
    "refuses near=%s",
    (near) => {
      expect(
        Option.isNone(
          Schema.decodeOption(searchRestaurantsContract.input)({
            near,
            q: "pizzaria",
          })
        )
      ).toBe(true);
    }
  );

  it("is a read-only, open-world GET route", () => {
    expect(searchRestaurantsContract.http).toStrictEqual({
      method: "GET",
      path: "/restaurants/search",
    });
    expect(searchRestaurantsContract.annotations).toMatchObject({
      openWorld: true,
      readOnly: true,
    });
  });
});

import { afterEach, describe, expect, it } from "@effect/vitest";
import { PlaceSearchUnavailable } from "@savour/core";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect, Schedule } from "effect";

import { createSavourRouter } from "../src/savour-router";
import {
  memorySession,
  refusedWith,
  scriptedApi,
} from "./fixtures/scripted-api";
import type { ScriptedReply } from "./fixtures/scripted-api";

afterEach(cleanup);

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

const locatedAt = (latitude: number, longitude: number) => {
  const asked: PositionOptions[] = [];

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        located: PositionCallback,
        _refused: PositionErrorCallback,
        options: PositionOptions
      ) => {
        asked.push(options);
        located({
          coords: {
            accuracy: 20,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude,
            longitude,
            speed: null,
            toJSON: () => ({ latitude, longitude }),
          },
          timestamp: 0,
          toJSON: () => ({ latitude, longitude }),
        });
      },
    },
  });

  return asked;
};

const locationDenied = () => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        _located: PositionCallback,
        refused: PositionErrorCallback
      ) => {
        refused({
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          code: 1,
          message: "User denied Geolocation",
        });
      },
    },
  });
};

const SEARCH = "GET /api/restaurants/search";

const appeared = <A,>(find: () => A) =>
  Effect.try(find).pipe(
    Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 200 })
  );

const addRestaurantAction = {
  description: "Add a restaurant the search missed by hand.",
  href: "/restaurants",
  rel: "create-form",
};

const found = (
  results: readonly {
    readonly address: string;
    readonly cuisine: string | null;
    readonly name: string;
    readonly placeId: string;
    readonly priceLevel: number | null;
  }[]
): ScriptedReply => ({
  body: { next: [addRestaurantAction], results },
  status: 200,
});

const pizzaria = {
  address: "Rua Coronel Teófilo Leme, 1200 - Centro, Bragança Paulista - SP",
  cuisine: "Pizza",
  name: "Pizzaria Bella Napoli",
  placeId: "place-bella-napoli",
  priceLevel: null,
};

const openSearch = (
  reply: ScriptedReply,
  requests: string[] = [],
  path = "/search",
  urls: URL[] = []
) => {
  window.history.replaceState(null, "", path);
  const api = scriptedApi({ [SEARCH]: reply }, requests, [], urls);

  render(
    <RouterProvider router={createSavourRouter(api, memorySession(api))} />
  );
};

const typeQuery = (value: string) =>
  Effect.gen(function* typesQuery() {
    const field = yield* appeared(() => screen.getByRole("searchbox"));
    fireEvent.change(field, { target: { value } });
  });

const submitQuery = (value: string) =>
  Effect.gen(function* submitsQuery() {
    yield* typeQuery(value);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
  });

const searches = (requests: readonly string[]) =>
  requests.filter((request) => request === SEARCH);

describe("restaurant search screen", () => {
  it.live("searches on submit at phone width", () =>
    Effect.gen(function* searchesOnSubmit() {
      const requests: string[] = [];
      openSearch(found([pizzaria]), requests);

      yield* submitQuery("pizzaria");

      const name = yield* appeared(() =>
        screen.getByText("Pizzaria Bella Napoli")
      );

      expect(window.innerWidth).toBe(375);
      expect(searches(requests)).toStrictEqual([SEARCH]);
      expect(name.closest("li")?.textContent).toContain(
        "Bragança Paulista - SP"
      );
    })
  );

  it.live("doesn't call the API while typing", () =>
    Effect.gen(function* staysQuietWhileTyping() {
      const requests: string[] = [];
      openSearch(found([pizzaria]), requests);

      yield* typeQuery("pizz");
      yield* Effect.sleep("100 millis");

      expect(searches(requests)).toStrictEqual([]);
    })
  );

  it.live("shows cuisine and price level", () =>
    Effect.gen(function* showsCuisineAndPrice() {
      openSearch(
        found([
          {
            ...pizzaria,
            cuisine: "Japanese",
            name: "Sushi Kenzo",
            priceLevel: 2,
          },
        ])
      );

      yield* submitQuery("sushi");

      const name = yield* appeared(() => screen.getByText("Sushi Kenzo"));
      const result = name.closest("li");

      expect(result?.textContent).toContain("Japanese");
      expect(result?.textContent).toContain("$$");
      expect(result?.textContent).not.toContain("$$$");
    })
  );

  it.live("shows an empty state with the add-a-restaurant action", () =>
    Effect.gen(function* showsEmptyState() {
      openSearch(found([]));

      yield* submitQuery("cantina do zé");

      yield* appeared(() =>
        screen.getByText("Nothing matches “cantina do zé”.")
      );
      expect(
        screen.getByRole("button", { name: "Add it by hand" })
      ).toBeDefined();
    })
  );

  it.live("shows a retry message when search is unavailable", () =>
    Effect.gen(function* showsRetryMessage() {
      openSearch(
        refusedWith(
          PlaceSearchUnavailable,
          new PlaceSearchUnavailable({ reason: "unreachable" }),
          503
        )
      );

      yield* submitQuery("pizzaria");

      const alert = yield* appeared(() => screen.getByRole("alert"));

      expect(alert.textContent).toContain("Try again in a moment.");
      expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
      expect(document.body.textContent).not.toContain("Nothing matches");
    })
  );

  it.live("ignores a search address the API would refuse", () =>
    Effect.gen(function* ignoresInvalidQuery() {
      const requests: string[] = [];
      openSearch(found([pizzaria]), requests, `/search?q=${"a".repeat(201)}`);

      yield* appeared(() => screen.getByRole("searchbox"));
      yield* Effect.sleep("100 millis");

      expect(searches(requests)).toStrictEqual([]);
      expect(screen.queryByRole("alert")).toBeNull();
    })
  );

  it.live("doesn't ask for the location before a tap", () =>
    Effect.gen(function* staysQuietAboutLocation() {
      const asked = locatedAt(-22.95123, -46.54321);
      openSearch(found([pizzaria]));

      yield* submitQuery("pizzaria");
      yield* appeared(() => screen.getByText("Pizzaria Bella Napoli"));

      expect(asked).toStrictEqual([]);
    })
  );

  it.live("sends a rounded location after the person allows it", () =>
    Effect.gen(function* searchesNearMe() {
      const urls: URL[] = [];
      const asked = locatedAt(-22.95123, -46.54321);
      openSearch(found([pizzaria]), [], "/search", urls);

      yield* typeQuery("pizzaria");
      fireEvent.click(screen.getByRole("button", { name: "Search near me" }));

      yield* appeared(() => screen.getByText("Pizzaria Bella Napoli"));

      const searched = urls.filter(
        (url) => url.pathname === "/api/restaurants/search"
      );

      expect(window.innerWidth).toBe(375);
      expect(asked).toHaveLength(1);
      expect(searched.map((url) => url.searchParams.get("near"))).toStrictEqual(
        ["-22.95,-46.54"]
      );
      expect(screen.getByText("Showing places near you first.")).toBeDefined();
      expect(window.location.search).not.toContain("near");
    })
  );

  it.live("still searches when location is denied", () =>
    Effect.gen(function* searchesWithoutLocation() {
      const urls: URL[] = [];
      locationDenied();
      openSearch(found([pizzaria]), [], "/search", urls);

      yield* typeQuery("pizzaria");
      fireEvent.click(screen.getByRole("button", { name: "Search near me" }));

      yield* appeared(() => screen.getByText("Pizzaria Bella Napoli"));

      const searched = urls.filter(
        (url) => url.pathname === "/api/restaurants/search"
      );

      expect(searched.map((url) => url.searchParams.has("near"))).toStrictEqual(
        [false]
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getAllByText(
          "Location is off, so results aren’t sorted by distance."
        )
      ).toHaveLength(1);
    })
  );

  it.live("doesn't ask for the location without a query", () =>
    Effect.gen(function* needsQueryFirst() {
      const asked = locatedAt(-22.95123, -46.54321);
      openSearch(found([pizzaria]));

      yield* appeared(() => screen.getByRole("searchbox"));
      fireEvent.click(screen.getByRole("button", { name: "Search near me" }));

      expect(asked).toStrictEqual([]);
      expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    })
  );
});

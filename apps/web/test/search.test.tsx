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
  path = "/search"
) => {
  window.history.replaceState(null, "", path);
  const api = scriptedApi({ [SEARCH]: reply }, requests);

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
});

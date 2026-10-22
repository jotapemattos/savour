import { afterEach, describe, expect, it } from "@effect/vitest";
import { Unauthenticated } from "@savour/core";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect, Schedule } from "effect";

import { createSavourRouter } from "../src/savour-router";
import {
  memorySession,
  refusedWith,
  scriptedApi,
} from "./fixtures/scripted-api";
import type { ScriptedReplies, ScriptedReply } from "./fixtures/scripted-api";

afterEach(cleanup);

const LIST = "GET /api/want-to-go";

const ADD = "POST /api/want-to-go";

const REMOVE = "DELETE /api/want-to-go/restaurant-napoli";

const appeared = <A,>(find: () => A) =>
  Effect.try(find).pipe(
    Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 200 })
  );

const bellaNapoli = {
  address: "Rua Coronel Teófilo Leme, 1200 - Centro, Bragança Paulista - SP",
  cuisine: "Pizza",
  name: "Pizzaria Bella Napoli",
  placeId: "place-bella-napoli",
  priceLevel: 2,
};

const restaurant = {
  id: "restaurant-napoli",
  placeId: bellaNapoli.placeId,
  source: "provider",
};

const listOf = (saved: boolean): ScriptedReply => ({
  body: {
    next: [],
    restaurants: saved ? [{ place: bellaNapoli, restaurant }] : [],
  },
  status: 200,
});

const savedReply: ScriptedReply = {
  body: { next: [], saved: { place: bellaNapoli, restaurant } },
  status: 200,
};

const removedReply: ScriptedReply = { body: { next: [] }, status: 200 };

const foundReply: ScriptedReply = {
  body: { next: [], results: [bellaNapoli] },
  status: 200,
};

const openSearch = (
  script: Readonly<Record<string, ScriptedReplies>>,
  requests: string[] = [],
  payloads: unknown[] = []
) => {
  window.history.replaceState(null, "", "/search?q=pizzaria");

  const api = scriptedApi(
    {
      "GET /api/restaurants/search": foundReply,
      ...script,
    },
    requests,
    payloads
  );

  render(
    <RouterProvider router={createSavourRouter(api, memorySession(api))} />
  );
};

const toggle = () =>
  screen.getByRole("button", { name: "Want to go to Pizzaria Bella Napoli" });

const pressed = (state: string) =>
  appeared(() => {
    expect(toggle().getAttribute("aria-pressed")).toBe(state);
    expect(toggle().getAttribute("aria-disabled")).toBe("false");
  });

describe("want-to-go from search", () => {
  it.live("saves a restaurant from search results", () =>
    Effect.gen(function* savesFromSearch() {
      const requests: string[] = [];
      const payloads: unknown[] = [];

      openSearch(
        {
          [ADD]: savedReply,
          [LIST]: [listOf(false), listOf(true)],
        },
        requests,
        payloads
      );

      yield* pressed("false");
      fireEvent.click(toggle());
      yield* pressed("true");

      expect(requests).toContain(ADD);
      expect(payloads).toStrictEqual([{ placeId: bellaNapoli.placeId }]);
    })
  );

  it.live("removes a saved restaurant", () =>
    Effect.gen(function* removesFromSearch() {
      const requests: string[] = [];

      openSearch(
        {
          [LIST]: [listOf(true), listOf(false)],
          [REMOVE]: removedReply,
        },
        requests
      );

      yield* pressed("true");
      fireEvent.click(toggle());
      yield* pressed("false");

      expect(requests).toContain(REMOVE);
    })
  );

  it.live("says so when the list can't be changed", () =>
    Effect.gen(function* showsFailure() {
      openSearch({
        [ADD]: { body: "<html>oops", status: 500 },
        [LIST]: listOf(false),
      });

      yield* pressed("false");
      fireEvent.click(toggle());

      const alert = yield* appeared(() => screen.getByRole("alert"));

      expect(alert.textContent).toBe("Couldn’t update your list.");
      yield* pressed("false");
    })
  );

  it.live("hides the toggle when signed out", () =>
    Effect.gen(function* hidesSignedOut() {
      const requests: string[] = [];

      openSearch(
        {
          [LIST]: refusedWith(Unauthenticated, new Unauthenticated(), 401),
        },
        requests
      );

      yield* appeared(() => screen.getByText("Pizzaria Bella Napoli"));
      yield* appeared(() => {
        expect(requests).toContain(LIST);
      });
      yield* Effect.sleep("50 millis");

      expect(screen.queryByRole("button", { name: /Want to go/u })).toBeNull();
      expect(
        screen.getByRole("button", {
          name: "Log a visit to Pizzaria Bella Napoli",
        })
      ).toBeDefined();
    })
  );
});

import { afterEach, describe, expect, it } from "@effect/vitest";
import { Unauthenticated } from "@savour/core";
import { RouterProvider } from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Effect, Schedule } from "effect";

import { RatingInput } from "../src/features/visits/rating-input";
import { createSavourRouter } from "../src/savour-router";
import {
  memorySession,
  refusedWith,
  scriptedApi,
} from "./fixtures/scripted-api";
import type { ScriptedReply } from "./fixtures/scripted-api";

afterEach(cleanup);

const DIARY = "GET /api/diary";

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

const entry = (
  id: string,
  fields: {
    readonly date: string;
    readonly rating: number | null;
    readonly review?: string;
  }
) => ({
  date: fields.date,
  dishes: [],
  id,
  lovedIt: false,
  place: bellaNapoli,
  rating: fields.rating,
  restaurant: {
    id: `restaurant-${id}`,
    placeId: bellaNapoli.placeId,
    source: "provider",
  },
  review: fields.review ?? null,
  revisit: false,
  tags: [],
});

const diaryOf = (
  visits: readonly ReturnType<typeof entry>[]
): ScriptedReply => ({
  body: { next: [], visits },
  status: 200,
});

const openAt = (
  path: string,
  script: Readonly<Record<string, ScriptedReply>>
) => {
  window.history.replaceState(null, "", path);
  const api = scriptedApi(script);

  render(
    <RouterProvider router={createSavourRouter(api, memorySession(api))} />
  );
};

describe("log sheet and diary", () => {
  it.live("shows an empty diary that points to search", () =>
    Effect.gen(function* showsEmptyDiary() {
      openAt("/diary", { [DIARY]: diaryOf([]) });

      yield* appeared(() => screen.getByText("No visits yet"));

      expect(document.body.textContent).toContain("log your first visit");
      expect(
        screen
          .getAllByRole("link", { name: "Find a restaurant" })
          .map((link) => link.getAttribute("href"))
      ).toContain("/search");
    })
  );

  it("sets half stars by tap and by keyboard", () => {
    render(<RatingInput name="rating" />);
    const rating = screen.getByRole("slider", { name: "Rating" });
    const announced = () => rating.getAttribute("aria-valuetext");

    expect(announced()).toBe("No rating");

    const leftHalfOfFourth = rating.querySelector('[data-value="3.5"]');
    fireEvent.click(leftHalfOfFourth ?? rating);

    expect(announced()).toBe("3.5 stars");

    rating.focus();
    fireEvent.keyDown(rating, { key: "ArrowRight" });

    expect(announced()).toBe("4 stars");
    expect(rating.getAttribute("aria-valuenow")).toBe("4");

    fireEvent.keyDown(rating, { key: "Home" });

    expect(announced()).toBe("0.5 stars");

    fireEvent.keyDown(rating, { key: "End" });

    expect(announced()).toBe("5 stars");
    expect(
      document.querySelector<HTMLInputElement>('input[name="rating"]')?.value
    ).toBe("5");
  });

  it.live("lists visits as the API orders them, with their stars", () =>
    Effect.gen(function* listsVisits() {
      openAt("/diary", {
        [DIARY]: diaryOf([
          entry("v2", { date: "2026-10-18", rating: 4.5, review: "Crisp." }),
          entry("v1", { date: "2026-09-02", rating: null }),
        ]),
      });

      const items = yield* appeared(() => {
        const found = screen.getAllByRole("listitem");
        expect(found).toHaveLength(2);

        return found;
      });

      const [newest, oldest] = items;
      expect(newest?.textContent).toContain("Pizzaria Bella Napoli");
      expect(newest?.textContent).toContain("Oct 18, 2026");
      expect(newest?.textContent).toContain("Crisp.");
      expect(
        within(newest ?? document.body).getByRole("img", { name: "4.5 stars" })
      ).toBeDefined();
      expect(oldest?.textContent).toContain("Sep 2, 2026");
      expect(within(oldest ?? document.body).queryByRole("img")).toBeNull();
    })
  );

  it.live("sends a signed-out reader to sign in", () =>
    Effect.gen(function* redirectsSignedOut() {
      openAt("/diary", {
        [DIARY]: refusedWith(Unauthenticated, new Unauthenticated(), 401),
      });

      yield* appeared(() => {
        expect(window.location.pathname).toBe("/sign-in");
      });
    })
  );
});

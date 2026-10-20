import { afterEach, describe, expect, it } from "@effect/vitest";
import { InvalidVisitDate, Unauthenticated, VisitNotFound } from "@savour/core";
import { RouterProvider } from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { DateTime, Effect, Schedule } from "effect";

import { RatingInput } from "../src/features/visits/rating-input";
import { createSavourRouter } from "../src/savour-router";
import {
  memorySession,
  refusedWith,
  scriptedApi,
} from "./fixtures/scripted-api";
import type { ScriptedReplies, ScriptedReply } from "./fixtures/scripted-api";

afterEach(cleanup);

const DIARY = "GET /api/diary";

const SEARCH = "GET /api/restaurants/search";

const LOG = "POST /api/visits";

const EDIT = "PATCH /api/visits/v1";

const DELETE = "DELETE /api/visits/v1";

const today = DateTime.formatIsoDate(
  DateTime.setZone(DateTime.nowUnsafe(), DateTime.zoneMakeLocal())
);

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
    readonly tags?: readonly string[];
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
  tags: fields.tags ?? [],
});

const diaryOf = (
  visits: readonly ReturnType<typeof entry>[]
): ScriptedReply => ({
  body: { next: [], visits },
  status: 200,
});

const loggedAs = (visit: ReturnType<typeof entry>): ScriptedReply => ({
  body: { next: [], visit },
  status: 200,
});

const openAt = (
  path: string,
  script: Readonly<Record<string, ScriptedReplies>>
) => {
  window.history.replaceState(null, "", path);
  const api = scriptedApi(script);

  render(
    <RouterProvider router={createSavourRouter(api, memorySession(api))} />
  );
};

const openLogSheet = (
  script: Readonly<Record<string, ScriptedReply>>,
  requests: string[] = [],
  payloads: unknown[] = []
) =>
  Effect.gen(function* opensLogSheet() {
    window.history.replaceState(null, "", "/search?q=pizzaria");

    const api = scriptedApi(
      {
        [SEARCH]: { body: { next: [], results: [bellaNapoli] }, status: 200 },
        ...script,
      },
      requests,
      payloads
    );

    render(
      <RouterProvider router={createSavourRouter(api, memorySession(api))} />
    );

    const logButton = yield* appeared(() =>
      screen.getByRole("button", {
        name: "Log a visit to Pizzaria Bella Napoli",
      })
    );

    fireEvent.click(logButton);

    return yield* appeared(() =>
      screen.getByRole("dialog", { name: "Log a visit" })
    );
  });

const save = (sheet: HTMLElement) => {
  fireEvent.click(within(sheet).getByRole("button", { name: "Save visit" }));
};

const newestDiaryEntry = () => {
  expect(window.location.pathname).toBe("/diary");
  const [newest] = screen.getAllByRole("listitem");

  return newest ?? document.body;
};

describe("log sheet and diary", () => {
  it.live("completes logging at phone width", () =>
    Effect.gen(function* completesLogging() {
      const payloads: unknown[] = [];
      const logged = entry("v3", { date: today, rating: 4 });

      const sheet = yield* openLogSheet(
        {
          [DIARY]: diaryOf([
            logged,
            entry("v1", { date: "2026-09-02", rating: null }),
          ]),
          [LOG]: loggedAs(logged),
        },
        [],
        payloads
      );

      const date = within(sheet).getByLabelText<HTMLInputElement>("Date");
      const rating = within(sheet).getByRole("slider", { name: "Rating" });
      fireEvent.click(rating.querySelector('[data-value="4"]') ?? rating);
      save(sheet);

      const newest = yield* appeared(newestDiaryEntry);

      expect(window.innerWidth).toBe(375);
      expect(date.value).toBe(today);
      expect(payloads).toStrictEqual([
        { date: today, placeId: bellaNapoli.placeId, rating: 4 },
      ]);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(newest.textContent).toContain("Pizzaria Bella Napoli");
      expect(
        within(newest).getByRole("img", { name: "4 stars" })
      ).toBeDefined();
    })
  );

  it.live("saves with only a date", () =>
    Effect.gen(function* savesWithOnlyDate() {
      const payloads: unknown[] = [];
      const logged = entry("v4", { date: today, rating: null });

      const sheet = yield* openLogSheet(
        { [DIARY]: diaryOf([logged]), [LOG]: loggedAs(logged) },
        [],
        payloads
      );

      save(sheet);

      const newest = yield* appeared(newestDiaryEntry);

      expect(payloads).toStrictEqual([
        { date: today, placeId: bellaNapoli.placeId },
      ]);
      expect(newest.textContent).toContain("Pizzaria Bella Napoli");
      expect(within(newest).queryByRole("img")).toBeNull();
    })
  );

  it.live("shows the typed failure without losing input", () =>
    Effect.gen(function* showsTypedFailure() {
      const sheet = yield* openLogSheet({
        [LOG]: refusedWith(
          InvalidVisitDate,
          new InvalidVisitDate({ date: today, reason: "in-the-future" }),
          400
        ),
      });

      const review =
        within(sheet).getByLabelText<HTMLTextAreaElement>("Review (optional)");

      fireEvent.change(review, { target: { value: "Great crust" } });
      save(sheet);

      const error = yield* appeared(() =>
        within(sheet).getByText("Pick today or an earlier day.")
      );

      const date = within(sheet).getByLabelText("Date");

      expect(date.getAttribute("aria-invalid")).toBe("true");
      expect(date.getAttribute("aria-describedby")).toBe(error.id);
      expect(review.value).toBe("Great crust");
      expect(window.location.pathname).toBe("/search");
    })
  );

  it.live("closes on cancel without logging", () =>
    Effect.gen(function* closesOnCancel() {
      const requests: string[] = [];
      const sheet = yield* openLogSheet({}, requests);

      fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));

      yield* appeared(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(requests).not.toContain(LOG);
    })
  );

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

  it("starts from a given rating and clears it", () => {
    render(<RatingInput defaultValue={3} name="rating" />);
    const rating = screen.getByRole("slider", { name: "Rating" });

    expect(rating.getAttribute("aria-valuetext")).toBe("3 stars");

    fireEvent.click(screen.getByRole("button", { name: "Clear rating" }));

    expect(rating.getAttribute("aria-valuetext")).toBe("No rating");
    expect(document.activeElement).toBe(rating);
    expect(document.querySelector('input[name="rating"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear rating" })).toBeNull();
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

const pizzaNight = entry("v1", {
  date: "2026-10-01",
  rating: 3,
  review: "Great crust",
  tags: ["pizza"],
});

const openEditSheet = (
  script: Readonly<Record<string, ScriptedReplies>>,
  requests: string[] = [],
  payloads: unknown[] = []
) =>
  Effect.gen(function* opensEditSheet() {
    window.history.replaceState(null, "", "/diary");
    const api = scriptedApi(script, requests, payloads);

    render(
      <RouterProvider router={createSavourRouter(api, memorySession(api))} />
    );

    const entryButton = yield* appeared(() =>
      screen.getByRole("button", { name: /Pizzaria Bella Napoli/u })
    );

    fireEvent.click(entryButton);

    return yield* appeared(() =>
      screen.getByRole("dialog", { name: "Edit visit" })
    );
  });

const saveChanges = (sheet: HTMLElement) => {
  fireEvent.click(within(sheet).getByRole("button", { name: "Save changes" }));
};

const reviewOf = (sheet: HTMLElement) =>
  within(sheet).getByLabelText<HTMLTextAreaElement>("Review (optional)");

const closed = () => {
  expect(screen.queryByRole("dialog")).toBeNull();
};

describe("editing and deleting from the diary", () => {
  it.live("edits a visit's rating from the diary at phone width", () =>
    Effect.gen(function* editsRating() {
      const payloads: unknown[] = [];
      const edited = { ...pizzaNight, rating: 4.5 };

      const sheet = yield* openEditSheet(
        {
          [DIARY]: [diaryOf([pizzaNight]), diaryOf([edited])],
          [EDIT]: loggedAs(edited),
        },
        [],
        payloads
      );

      const rating = within(sheet).getByRole("slider", { name: "Rating" });

      expect(window.innerWidth).toBe(375);
      expect(within(sheet).getByLabelText<HTMLInputElement>("Date").value).toBe(
        "2026-10-01"
      );
      expect(rating.getAttribute("aria-valuetext")).toBe("3 stars");
      expect(reviewOf(sheet).value).toBe("Great crust");
      expect(
        within(sheet).getByLabelText<HTMLInputElement>("Tags (optional)").value
      ).toBe("pizza");

      fireEvent.keyDown(rating, { key: "ArrowRight" });
      fireEvent.keyDown(rating, { key: "ArrowRight" });
      fireEvent.keyDown(rating, { key: "ArrowRight" });
      saveChanges(sheet);

      yield* appeared(closed);

      const updated = yield* appeared(() =>
        within(screen.getByRole("listitem")).getByRole("img", {
          name: "4.5 stars",
        })
      );

      expect(updated).toBeDefined();
      expect(payloads).toStrictEqual([{ rating: 4.5 }]);
    })
  );

  it.live("clears the review and the rating", () =>
    Effect.gen(function* clearsReviewAndRating() {
      const payloads: unknown[] = [];
      const cleared = { ...pizzaNight, rating: null, review: null };

      const sheet = yield* openEditSheet(
        {
          [DIARY]: [diaryOf([pizzaNight]), diaryOf([cleared])],
          [EDIT]: loggedAs(cleared),
        },
        [],
        payloads
      );

      fireEvent.change(reviewOf(sheet), { target: { value: "" } });
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Clear rating" })
      );
      saveChanges(sheet);

      yield* appeared(closed);

      const item = yield* appeared(() => {
        const found = screen.getByRole("listitem");
        expect(found.textContent).not.toContain("Great crust");

        return found;
      });

      expect(within(item).queryByRole("img")).toBeNull();
      expect(payloads).toStrictEqual([{ rating: null, review: null }]);
    })
  );

  it.live("closes an unchanged edit without sending it", () =>
    Effect.gen(function* closesUnchanged() {
      const requests: string[] = [];

      const sheet = yield* openEditSheet(
        { [DIARY]: diaryOf([pizzaNight]) },
        requests
      );

      saveChanges(sheet);

      yield* appeared(closed);
      expect(requests).not.toContain(EDIT);
    })
  );

  it.live("deletes only after a confirmation step", () =>
    Effect.gen(function* deletesAfterConfirming() {
      const requests: string[] = [];

      const sheet = yield* openEditSheet(
        {
          [DELETE]: { body: { next: [] }, status: 200 },
          [DIARY]: [diaryOf([pizzaNight]), diaryOf([])],
        },
        requests
      );

      const deleteVisit = () =>
        within(sheet).getByRole("button", { name: "Delete visit" });

      fireEvent.click(deleteVisit());

      const confirmation = within(sheet).getByRole("group", {
        name: "Delete this visit?",
      });

      expect(requests).not.toContain(DELETE);
      expect(confirmation.textContent).toContain("Pizzaria Bella Napoli");
      expect(confirmation.textContent).toContain("Oct 1, 2026");
      expect(confirmation.textContent).toContain("can’t be undone");

      fireEvent.click(
        within(confirmation).getByRole("button", { name: "Keep it" })
      );

      expect(within(sheet).queryByRole("group")).toBeNull();
      expect(requests).not.toContain(DELETE);

      fireEvent.click(deleteVisit());
      fireEvent.click(
        within(
          within(sheet).getByRole("group", { name: "Delete this visit?" })
        ).getByRole("button", { name: "Delete visit" })
      );

      yield* appeared(closed);
      yield* appeared(() => screen.getByText("No visits yet"));

      yield* appeared(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: "Your diary" })
        );
      });
      expect(requests.filter((request) => request === DELETE)).toHaveLength(1);
    })
  );

  it.live("keeps the typed failure and the input on a refused edit", () =>
    Effect.gen(function* keepsInputOnRefusal() {
      const sheet = yield* openEditSheet({
        [DIARY]: diaryOf([pizzaNight]),
        [EDIT]: refusedWith(
          InvalidVisitDate,
          new InvalidVisitDate({ date: "2026-10-01", reason: "in-the-future" }),
          400
        ),
      });

      fireEvent.change(reviewOf(sheet), { target: { value: "Thin crust" } });
      saveChanges(sheet);

      const error = yield* appeared(() =>
        within(sheet).getByText("Pick today or an earlier day.")
      );

      expect(
        within(sheet).getByLabelText("Date").getAttribute("aria-describedby")
      ).toBe(error.id);
      expect(reviewOf(sheet).value).toBe("Thin crust");
    })
  );

  it.live("explains a visit that is gone", () =>
    Effect.gen(function* explainsGoneVisit() {
      const requests: string[] = [];

      const gone = refusedWith(
        VisitNotFound,
        new VisitNotFound({ visitId: "v1" }),
        404
      );

      const sheet = yield* openEditSheet(
        { [DELETE]: gone, [DIARY]: diaryOf([pizzaNight]), [EDIT]: gone },
        requests
      );

      fireEvent.change(reviewOf(sheet), { target: { value: "Thin crust" } });
      saveChanges(sheet);

      yield* appeared(() =>
        within(sheet).getByText("This visit is no longer in your diary.")
      );

      fireEvent.click(
        within(sheet).getByRole("button", { name: "Delete visit" })
      );
      fireEvent.click(
        within(
          within(sheet).getByRole("group", { name: "Delete this visit?" })
        ).getByRole("button", { name: "Delete visit" })
      );

      yield* appeared(() => {
        expect(requests).toContain(DELETE);
        expect(
          within(sheet).getByText("This visit is no longer in your diary.")
        ).toBeDefined();
        expect(
          requests.filter((request) => request === DIARY).length
        ).toBeGreaterThanOrEqual(3);
      });
    })
  );
});

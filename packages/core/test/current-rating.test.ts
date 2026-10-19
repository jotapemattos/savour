import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { Rating, VisitDate, currentRatingFrom } from "../src/index.js";
import type { StoredVisit } from "../src/index.js";

const restaurant = {
  id: "restaurant-r",
  placeId: "ChIJbraganca",
  source: "provider",
} as const;

const visitOn = (
  date: string,
  rating: number | null,
  loggedAt: number
): StoredVisit => ({
  loggedAt,
  visit: {
    date: Schema.decodeSync(VisitDate)(date),
    dishes: [],
    id: `visit-${date}-${String(loggedAt)}`,
    lovedIt: false,
    rating: rating === null ? null : Schema.decodeSync(Rating)(rating),
    restaurant,
    review: null,
    revisit: false,
    tags: [],
  },
});

describe("current rating", () => {
  it("uses the latest visit as the current rating", () => {
    const visits = [
      visitOn("2026-10-05", 4, 1),
      visitOn("2026-10-09", 4.5, 2),
      visitOn("2026-10-01", 3.5, 3),
    ];

    expect(currentRatingFrom(visits)).toStrictEqual(Option.some(4.5));
  });

  it("falls back to the latest rated visit", () => {
    const visits = [
      visitOn("2026-10-05", 4, 1),
      visitOn("2026-10-09", null, 2),
    ];

    expect(currentRatingFrom(visits)).toStrictEqual(Option.some(4));
  });

  it("breaks a same-day tie with the visit logged last", () => {
    const visits = [visitOn("2026-10-09", 5, 2), visitOn("2026-10-09", 3, 1)];

    expect(currentRatingFrom(visits)).toStrictEqual(Option.some(5));
  });

  it("has no current rating when no visit is rated", () => {
    expect(currentRatingFrom([visitOn("2026-10-09", null, 1)])).toStrictEqual(
      Option.none()
    );
  });
});

describe("visit schemas", () => {
  it("accepts only half-star ratings between 0.5 and 5", () => {
    const isRating = Schema.is(Rating);

    expect([0.5, 3.5, 5].map(isRating)).toStrictEqual([true, true, true]);
    expect([0, 4.25, 5.5].map(isRating)).toStrictEqual([false, false, false]);
  });

  it("accepts a calendar day and nothing with a time of day", () => {
    const isVisitDate = Schema.is(VisitDate);

    expect(isVisitDate("2026-10-10")).toBe(true);
    expect(isVisitDate("2026-10-10T21:30")).toBe(false);
    expect(isVisitDate("2026-02-30")).toBe(false);
  });
});

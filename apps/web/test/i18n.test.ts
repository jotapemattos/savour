import { describe, expect, it } from "@effect/vitest";

import { formatters } from "../src/i18n/locale";
import type { Formatters } from "../src/i18n/locale";

const english = formatters("en");

const portuguese = formatters("pt-BR");

const starsIn =
  (f: Formatters, forms: { readonly one: string; readonly other: string }) =>
  (rating: number) =>
    `${f.rating(rating)} ${f.plural(rating, forms)}`;

describe("locale formatters", () => {
  it("formats a visit day for the locale", () => {
    expect(english.visitDay("2026-10-19")).toBe("Oct 19, 2026");
    expect(portuguese.visitDay("2026-10-19")).toBe("19 de out. de 2026");
  });

  it("keeps a visit day it cannot read as written", () => {
    expect(english.visitDay("someday")).toBe("someday");
  });

  it("labels ratings with the locale's plural rules and decimals", () => {
    const englishStars = starsIn(english, { one: "star", other: "stars" });

    const portugueseStars = starsIn(portuguese, {
      one: "estrela",
      other: "estrelas",
    });

    expect(englishStars(1)).toBe("1 star");
    expect(englishStars(3.5)).toBe("3.5 stars");
    expect(portugueseStars(1)).toBe("1 estrela");
    expect(portugueseStars(1.5)).toBe("1,5 estrela");
    expect(portugueseStars(3.5)).toBe("3,5 estrelas");
  });

  it("falls back to the other form when a category has none", () => {
    expect(english.plural(1, { other: "visits" })).toBe("visits");
  });
});

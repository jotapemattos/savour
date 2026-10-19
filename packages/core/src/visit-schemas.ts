import { DateTime, Option, Order, Schema } from "effect";

import { NextAction } from "./health-contracts.js";
import { Place } from "./place-schemas.js";
import { Restaurant } from "./restaurants.js";

const isCalendarDay = (text: string) =>
  DateTime.make(`${text}T00:00:00Z`).pipe(
    Option.map(DateTime.formatIsoDateUtc),
    Option.contains(text)
  );

export const VisitDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u),
  Schema.makeFilter(isCalendarDay)
)
  .pipe(Schema.brand("VisitDate"))
  .annotate({
    description:
      "The day of the visit as `YYYY-MM-DD`, with no time of day, never in the future.",
  });

export const Rating = Schema.Finite.check(
  Schema.isBetween({ maximum: 5, minimum: 0.5 }),
  Schema.isMultipleOf(0.5)
)
  .pipe(Schema.brand("Rating"))
  .annotate({ description: "0.5 to 5 in half-star steps." });

export const Visit = Schema.Struct({
  date: VisitDate,
  dishes: Schema.Array(Schema.String),
  id: Schema.String,
  lovedIt: Schema.Boolean,
  rating: Schema.NullOr(Rating),
  restaurant: Restaurant,
  review: Schema.NullOr(Schema.String),
  revisit: Schema.Boolean,
  tags: Schema.Array(Schema.String),
});

export const DiaryEntry = Schema.Struct({
  ...Visit.fields,
  place: Schema.NullOr(Place),
});

export const LoggedVisit = Schema.Struct({
  next: Schema.Array(NextAction),
  visit: DiaryEntry,
});

export const Diary = Schema.Struct({
  next: Schema.Array(NextAction),
  visits: Schema.Array(DiaryEntry),
});

export interface StoredVisit {
  readonly loggedAt: number;
  readonly visit: typeof Visit.Type;
}

export const diaryOrder: Order.Order<StoredVisit> = Order.flip(
  Order.combine(
    Order.mapInput(Order.String, ({ visit }: StoredVisit) => visit.date),
    Order.mapInput(Order.Number, ({ loggedAt }: StoredVisit) => loggedAt)
  )
);

export const currentRatingFrom = (
  visits: readonly StoredVisit[]
): Option.Option<typeof Rating.Type> =>
  Option.fromNullishOr(
    visits.toSorted(diaryOrder).find(({ visit }) => visit.rating !== null)
      ?.visit.rating
  );

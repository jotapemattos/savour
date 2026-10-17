import { Schema } from "effect";

export const PlaceId = Schema.NonEmptyString.annotate({
  description: "The Google place ID, the only provider value Savour stores.",
});

export const PriceLevel = Schema.Literals([0, 1, 2, 3, 4]).annotate({
  description: "0 is free and 4 is very expensive.",
});

export const Place = Schema.Struct({
  address: Schema.String,
  cuisine: Schema.NullOr(Schema.String),
  name: Schema.String,
  placeId: PlaceId,
  priceLevel: Schema.NullOr(PriceLevel),
});

export const SearchQuery = Schema.Trimmed.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200)
);

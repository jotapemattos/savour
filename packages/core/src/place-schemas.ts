import { Schema, SchemaGetter } from "effect";

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

const Latitude = Schema.Finite.check(
  Schema.isBetween({ maximum: 90, minimum: -90 })
);

const Longitude = Schema.Finite.check(
  Schema.isBetween({ maximum: 180, minimum: -180 })
);

export const LatLng = Schema.Struct({
  latitude: Latitude,
  longitude: Longitude,
});

const LatLngText = Schema.Struct({
  latitude: Schema.FiniteFromString.pipe(Schema.decodeTo(Latitude)),
  longitude: Schema.FiniteFromString.pipe(Schema.decodeTo(Longitude)),
});

const COORDINATE_PAIR = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/u;

export const Near = Schema.String.check(Schema.isPattern(COORDINATE_PAIR))
  .pipe(
    Schema.decodeTo(LatLngText, {
      decode: SchemaGetter.transform((text: string) => {
        const [latitude = "", longitude = ""] = text.split(",");

        return { latitude, longitude };
      }),
      encode: SchemaGetter.transform(
        ({ latitude, longitude }: typeof LatLngText.Encoded) =>
          `${latitude},${longitude}`
      ),
    })
  )
  .annotate({
    description:
      "The searcher's approximate location as `latitude,longitude`, such as `-22.95,-46.54`. Nearby places rank first; farther ones still appear.",
  });

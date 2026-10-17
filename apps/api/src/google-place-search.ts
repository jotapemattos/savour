import { PlaceSearch, PlaceSearchUnavailable } from "@savour/core";
import type { Place, PriceLevel } from "@savour/core";
import { Clock, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

const PLACES_API = "https://places.googleapis.com/v1";

type Operation = "places.details" | "places.search";

const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "primaryType",
  "priceLevel",
] as const;

const PRICE_LEVELS = new Map<string, typeof PriceLevel.Type>([
  ["PRICE_LEVEL_FREE", 0],
  ["PRICE_LEVEL_INEXPENSIVE", 1],
  ["PRICE_LEVEL_MODERATE", 2],
  ["PRICE_LEVEL_EXPENSIVE", 3],
  ["PRICE_LEVEL_VERY_EXPENSIVE", 4],
]);

const GooglePlace = Schema.Struct({
  displayName: Schema.Struct({ text: Schema.String }),
  formattedAddress: Schema.optional(Schema.String),
  id: Schema.NonEmptyString,
  priceLevel: Schema.optional(Schema.String),
  primaryType: Schema.optional(Schema.String),
});

const decodeSearchAnswer = Schema.decodeUnknownEffect(
  Schema.Struct({ places: Schema.optional(Schema.Array(GooglePlace)) })
);

const decodeDetailsAnswer = Schema.decodeUnknownEffect(GooglePlace);

const CUISINE_TYPE = /^(?<cuisine>[a-z_]+)_restaurant$/u;

const cuisineOf = (primaryType: string | undefined) => {
  const cuisine = CUISINE_TYPE.exec(primaryType ?? "")?.groups?.cuisine;

  return cuisine === undefined
    ? null
    : cuisine
        .split("_")
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(" ");
};

const toPlace = (place: typeof GooglePlace.Type): typeof Place.Type => ({
  address: place.formattedAddress ?? "",
  cuisine: cuisineOf(place.primaryType),
  name: place.displayName.text,
  placeId: place.id,
  priceLevel: PRICE_LEVELS.get(place.priceLevel ?? "") ?? null,
});

const unexpectedAnswer = () =>
  new PlaceSearchUnavailable({ reason: "unexpected-answer" });

const answered = <A>(
  operation: Operation,
  startedAt: number,
  places: readonly A[]
) =>
  Effect.gen(function* logAnswered() {
    yield* Effect.logInfo(operation).pipe(
      Effect.annotateLogs({
        latencyMs: (yield* Clock.currentTimeMillis) - startedAt,
        provider: "google-places",
        resultCount: places.length,
      })
    );

    return places;
  });

export const googlePlaceSearch = (apiKey: Redacted.Redacted) =>
  Layer.effect(
    PlaceSearch,
    Effect.gen(function* makeGooglePlaceSearch() {
      const client = yield* HttpClient.HttpClient;

      const send = (
        operation: Operation,
        request: HttpClientRequest.HttpClientRequest
      ) =>
        client
          .execute(
            HttpClientRequest.setHeader(
              request,
              "x-goog-api-key",
              Redacted.value(apiKey)
            )
          )
          .pipe(
            Effect.mapError(
              () => new PlaceSearchUnavailable({ reason: "unreachable" })
            ),
            Effect.tap((response) =>
              response.status >= 200 && response.status < 300
                ? Effect.void
                : Effect.logWarning(operation).pipe(
                    Effect.annotateLogs({
                      provider: "google-places",
                      status: response.status,
                    }),
                    Effect.andThen(
                      Effect.fail(
                        new PlaceSearchUnavailable({ reason: "refused" })
                      )
                    )
                  )
            )
          );

      return PlaceSearch.of({
        details: (placeId) =>
          Effect.gen(function* readPlaceDetails() {
            const startedAt = yield* Clock.currentTimeMillis;

            const response = yield* send(
              "places.details",
              HttpClientRequest.get(
                `${PLACES_API}/places/${encodeURIComponent(placeId)}`
              ).pipe(
                HttpClientRequest.setHeader(
                  "x-goog-fieldmask",
                  PLACE_FIELDS.join(",")
                )
              )
            );

            const place = yield* response.json.pipe(
              Effect.flatMap(decodeDetailsAnswer),
              Effect.mapError(unexpectedAnswer)
            );

            yield* answered("places.details", startedAt, [place]);

            return toPlace(place);
          }),
        search: (query) =>
          Effect.gen(function* searchText() {
            const startedAt = yield* Clock.currentTimeMillis;

            const response = yield* send(
              "places.search",
              HttpClientRequest.post(`${PLACES_API}/places:searchText`).pipe(
                HttpClientRequest.setHeader(
                  "x-goog-fieldmask",
                  PLACE_FIELDS.map((field) => `places.${field}`).join(",")
                ),
                HttpClientRequest.bodyJsonUnsafe({ textQuery: query })
              )
            );

            const { places = [] } = yield* response.json.pipe(
              Effect.flatMap(decodeSearchAnswer),
              Effect.mapError(unexpectedAnswer)
            );

            yield* answered("places.search", startedAt, places);

            return places.map(toPlace);
          }),
      });
    })
  );

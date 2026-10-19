import { describe, expect, it } from "@effect/vitest";
import { PlaceSearch, PlaceSearchUnavailable } from "@savour/core";
import {
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  Predicate,
  Redacted,
} from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import type { HttpClientRequest } from "effect/http";

import { googlePlaceSearch } from "../src/google-place-search.js";

const API_KEY = "test-places-key-0000";

type StructuredLog = ReturnType<typeof Logger.formatStructured.log>;

interface Seen {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
}

const googleAnswering = (status: number, body: string) => {
  const seen: Seen[] = [];
  const entries: StructuredLog[] = [];

  const client = HttpClient.make(
    (request: HttpClientRequest.HttpClientRequest, url) =>
      Effect.sync(() => {
        seen.push({
          body: Predicate.isTagged(request.body, "Uint8Array")
            ? new TextDecoder().decode(request.body.body)
            : "",
          headers: request.headers,
          method: request.method,
          url: url.toString(),
        });

        return HttpClientResponse.fromWeb(
          request,
          new Response(body, {
            headers: { "content-type": "application/json" },
            status,
          })
        );
      })
  );

  const layer = googlePlaceSearch(Redacted.make(API_KEY)).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
    Layer.merge(
      Logger.layer([
        Logger.make((options) => {
          entries.push(Logger.formatStructured.log(options));
        }),
      ])
    )
  );

  return { entries, layer, seen };
};

const sushiPlace = {
  displayName: { languageCode: "pt", text: "Sushi Bragança" },
  formattedAddress: "Av. Antonio Pires Pimentel, 2000 - Bragança Paulista - SP",
  id: "ChIJsushi",
  priceLevel: "PRICE_LEVEL_MODERATE",
  primaryType: "japanese_restaurant",
};

const search = (query: string) =>
  PlaceSearch.use((placeSearch) => placeSearch.search(query, Option.none()));

const braganca = { latitude: -22.95, longitude: -46.54 };

const searchNear = (query: string) =>
  PlaceSearch.use((placeSearch) =>
    placeSearch.search(query, Option.some(braganca))
  );

describe("Google Places adapter", () => {
  it.effect("maps cuisine and price level", () =>
    Effect.gen(function* mapsPlace() {
      const google = googleAnswering(
        200,
        JSON.stringify({ places: [sushiPlace] })
      );

      const places = yield* search("sushi").pipe(Effect.provide(google.layer));

      expect(places).toStrictEqual([
        {
          address: "Av. Antonio Pires Pimentel, 2000 - Bragança Paulista - SP",
          cuisine: "Japanese",
          name: "Sushi Bragança",
          placeId: "ChIJsushi",
          priceLevel: 2,
        },
      ]);
    })
  );

  it.effect("maps a missing price level and a non-cuisine type to null", () =>
    Effect.gen(function* mapsNulls() {
      const google = googleAnswering(
        200,
        JSON.stringify({
          places: [
            {
              ...sushiPlace,
              priceLevel: undefined,
              primaryType: "restaurant",
            },
            { ...sushiPlace, primaryType: "fast_food_restaurant" },
          ],
        })
      );

      const places = yield* search("lanche").pipe(Effect.provide(google.layer));

      expect(
        places.map(({ cuisine, priceLevel }) => ({ cuisine, priceLevel }))
      ).toStrictEqual([
        { cuisine: null, priceLevel: null },
        { cuisine: "Fast Food", priceLevel: 2 },
      ]);
    })
  );

  it.effect(
    "calls Text Search with the key header and a minimal field mask",
    () =>
      Effect.gen(function* callsTextSearch() {
        const google = googleAnswering(200, "{}");

        const places = yield* search("pizzaria").pipe(
          Effect.provide(google.layer)
        );

        expect(places).toStrictEqual([]);
        expect(google.seen).toHaveLength(1);
        expect(google.seen[0]).toMatchObject({
          body: JSON.stringify({
            languageCode: "pt-BR",
            regionCode: "BR",
            textQuery: "pizzaria",
          }),
          method: "POST",
          url: "https://places.googleapis.com/v1/places:searchText",
        });
        expect(google.seen[0]?.headers["x-goog-api-key"]).toBe(API_KEY);
        expect(google.seen[0]?.headers["x-goog-fieldmask"]).toBe(
          "places.id,places.displayName,places.formattedAddress,places.primaryType,places.priceLevel"
        );
      })
  );

  it.effect("pins every search to Brazil", () =>
    Effect.gen(function* pinsToBrazil() {
      const google = googleAnswering(200, "{}");

      yield* search("pizzaria").pipe(Effect.provide(google.layer));

      const body: unknown = JSON.parse(google.seen[0]?.body ?? "{}");

      expect(body).toMatchObject({ languageCode: "pt-BR", regionCode: "BR" });
      expect(body).not.toHaveProperty("locationBias");
    })
  );

  it.effect("biases results toward the given location", () =>
    Effect.gen(function* biasesNear() {
      const google = googleAnswering(200, "{}");

      yield* searchNear("pizzaria").pipe(Effect.provide(google.layer));

      expect(JSON.parse(google.seen[0]?.body ?? "{}")).toStrictEqual({
        languageCode: "pt-BR",
        locationBias: {
          circle: {
            center: { latitude: -22.95, longitude: -46.54 },
            radius: 30_000,
          },
        },
        regionCode: "BR",
        textQuery: "pizzaria",
      });
    })
  );

  it.effect("logs whether the search was biased, never the location", () =>
    Effect.gen(function* logsBiasedOnly() {
      const google = googleAnswering(
        200,
        JSON.stringify({ places: [sushiPlace] })
      );

      yield* searchNear("sushi").pipe(Effect.provide(google.layer));
      yield* search("sushi").pipe(Effect.provide(google.layer));

      expect(
        google.entries.map((entry) => entry.annotations.biased)
      ).toStrictEqual([true, false]);

      const logged = JSON.stringify(google.entries);

      expect(logged).not.toContain("-22.95");
      expect(logged).not.toContain("-46.54");
    })
  );

  it.effect("reads one place with Place Details", () =>
    Effect.gen(function* readsDetails() {
      const google = googleAnswering(200, JSON.stringify(sushiPlace));

      const place = yield* PlaceSearch.use((placeSearch) =>
        placeSearch.details("ChIJsushi")
      ).pipe(Effect.provide(google.layer));

      expect(place.name).toBe("Sushi Bragança");
      expect(google.seen[0]).toMatchObject({
        method: "GET",
        url: "https://places.googleapis.com/v1/places/ChIJsushi",
      });
      expect(google.seen[0]?.headers["x-goog-fieldmask"]).toBe(
        "id,displayName,formattedAddress,primaryType,priceLevel"
      );
    })
  );

  it.effect("logs places.search with latency and result count", () =>
    Effect.gen(function* logsSearch() {
      const google = googleAnswering(
        200,
        JSON.stringify({ places: [sushiPlace] })
      );

      yield* search("sushi").pipe(Effect.provide(google.layer));

      expect(google.entries).toHaveLength(1);
      expect(google.entries[0]).toMatchObject({
        annotations: { provider: "google-places", resultCount: 1 },
        level: "INFO",
        message: "places.search",
      });
      expect(google.entries[0]?.annotations).toHaveProperty("latencyMs");
    })
  );

  it.effect(
    "fails with PlaceSearchUnavailable and logs the status at Warn",
    () =>
      Effect.gen(function* failsOnStatus() {
        const google = googleAnswering(
          403,
          JSON.stringify({ error: "denied" })
        );

        const exit = yield* search("sushi").pipe(
          Effect.provide(google.layer),
          Effect.exit
        );

        expect(exit).toStrictEqual(
          Exit.fail(new PlaceSearchUnavailable({ reason: "refused" }))
        );
        expect(google.entries).toHaveLength(1);
        expect(google.entries[0]).toMatchObject({
          annotations: { provider: "google-places", status: 403 },
          level: "WARN",
          message: "places.search",
        });
        expect(JSON.stringify(google.entries)).not.toContain(API_KEY);
      })
  );

  it.effect(
    "fails with unexpected-answer when Google answers a shape it doesn't know",
    () =>
      Effect.gen(function* failsOnUnknownAnswer() {
        const google = googleAnswering(
          200,
          JSON.stringify({ places: [{ id: 7 }] })
        );

        const exit = yield* search("sushi").pipe(
          Effect.provide(google.layer),
          Effect.exit
        );

        expect(exit).toStrictEqual(
          Exit.fail(new PlaceSearchUnavailable({ reason: "unexpected-answer" }))
        );
      })
  );

  it.effect(
    "fails with unreachable when the request never reaches Google",
    () =>
      Effect.gen(function* failsUnreachable() {
        const offline = HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request }),
            })
          )
        );

        const exit = yield* search("sushi").pipe(
          Effect.provide(
            googlePlaceSearch(Redacted.make(API_KEY)).pipe(
              Layer.provide(Layer.succeed(HttpClient.HttpClient, offline))
            )
          ),
          Effect.exit
        );

        expect(exit).toStrictEqual(
          Exit.fail(new PlaceSearchUnavailable({ reason: "unreachable" }))
        );
      })
  );
});

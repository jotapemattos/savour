import { PlaceSearch, PlaceSearchUnavailable } from "@savour/core";
import type { Place } from "@savour/core";
import { Effect, Layer } from "effect";

export const pizzariaBraganca: typeof Place.Type = {
  address: "R. Cel. Teófilo Leme, 1240 - Centro, Bragança Paulista - SP",
  cuisine: "Pizza",
  name: "Pizzaria Bella Bragança",
  placeId: "ChIJbraganca",
  priceLevel: 2,
};

export const FakePlaceSearch = Layer.succeed(PlaceSearch, {
  details: () => Effect.succeed(pizzariaBraganca),
  search: (query) =>
    query === "offline"
      ? Effect.fail(new PlaceSearchUnavailable({ reason: "unreachable" }))
      : Effect.succeed(query === "nothing" ? [] : [pizzariaBraganca]),
});

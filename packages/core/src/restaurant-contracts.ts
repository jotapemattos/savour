import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { DatabaseUnavailable } from "./database-health-contracts.js";
import { NextAction } from "./health-contracts.js";
import { InvalidRestaurant } from "./invalid-restaurant.js";
import { UserAddedRestaurant } from "./restaurants.js";
import { Unauthenticated } from "./unauthenticated.js";

export const AddRestaurantInput = Schema.Struct({
  address: Schema.String.annotate({
    description:
      "The street address as people write it, up to 200 characters, such as `Rua X, 10, Bragança Paulista - SP`.",
  }),
  name: Schema.String.annotate({
    description: "The restaurant's name, up to 200 characters.",
  }),
});

export const AddedRestaurant = Schema.Struct({
  next: Schema.Array(NextAction),
  restaurant: UserAddedRestaurant,
});

export const addRestaurantContract = defineContract("addRestaurant", {
  description:
    "Add a restaurant that `GET /restaurants/search` missed, by its name and address, with the bearer token. Everyone finds it in search straight away, marked as added by a user, and it can be logged at once by its `id`.",
  failure: Schema.Union([
    Unauthenticated,
    InvalidRestaurant,
    DatabaseUnavailable,
  ]),
  http: { method: "POST", path: "/restaurants" },
  input: AddRestaurantInput,
  output: AddedRestaurant,
});

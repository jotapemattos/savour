import { implement } from "@savour/capability/implement";
import { Effect, Schema } from "effect";

import { requireSessionToken } from "./account-capabilities.js";
import { Accounts } from "./accounts.js";
import { InvalidRestaurant } from "./invalid-restaurant.js";
import { addRestaurantContract } from "./restaurant-contracts.js";
import { Restaurants } from "./restaurants.js";

const RestaurantText = Schema.Trimmed.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200)
);

const checkedText = (field: InvalidRestaurant["field"], text: string) =>
  Schema.decodeEffect(RestaurantText)(text.trim()).pipe(
    Effect.mapError(() => new InvalidRestaurant({ field }))
  );

const signedInHandle = Effect.gen(function* signedInHandle() {
  const accounts = yield* Accounts;
  const token = yield* requireSessionToken;
  const { account } = yield* accounts.accountForSession(token);

  return account.handle;
});

export const logVisitToRestaurantAction = (restaurantId: string) =>
  ({
    description: `Log a visit to it with \`POST /visits\`, the bearer token and \`"restaurantId": "${restaurantId}"\`.`,
    href: "/visits",
    rel: "create-form",
  }) as const;

export const addRestaurant = implement(addRestaurantContract, (input) =>
  Effect.gen(function* addRestaurantByHand() {
    const addedBy = yield* signedInHandle;
    const name = yield* checkedText("name", input.name);
    const address = yield* checkedText("address", input.address);
    const restaurants = yield* Restaurants;
    const restaurant = yield* restaurants.add({ addedBy, address, name });

    yield* Effect.logInfo("restaurant.user_added").pipe(
      Effect.annotateLogs({ handle: addedBy, restaurantId: restaurant.id })
    );

    return {
      next: [logVisitToRestaurantAction(restaurant.id)],
      restaurant,
    };
  })
);

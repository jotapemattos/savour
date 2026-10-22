import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseUnavailable } from "./database-health-contracts.js";
import type { Restaurant } from "./restaurants.js";

export interface WantToGoService {
  readonly add: (
    accountId: string,
    restaurantId: string
  ) => Effect.Effect<void, DatabaseUnavailable>;
  readonly list: (
    accountId: string
  ) => Effect.Effect<readonly (typeof Restaurant.Type)[], DatabaseUnavailable>;
  readonly remove: (
    accountId: string,
    restaurantId: string
  ) => Effect.Effect<void, DatabaseUnavailable>;
}

export class WantToGo extends Context.Service<WantToGo, WantToGoService>()(
  "@savour/core/WantToGo"
) {}

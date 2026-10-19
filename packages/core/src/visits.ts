import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { DatabaseUnavailable } from "./database-health-contracts.js";
import type { Rating, StoredVisit, Visit } from "./visit-schemas.js";

export type NewVisit = Omit<typeof Visit.Type, "id">;

export interface VisitsService {
  readonly currentRating: (
    accountId: string,
    restaurantId: string
  ) => Effect.Effect<Option.Option<typeof Rating.Type>, DatabaseUnavailable>;
  readonly diary: (
    accountId: string
  ) => Effect.Effect<readonly StoredVisit[], DatabaseUnavailable>;
  readonly log: (
    accountId: string,
    visit: NewVisit
  ) => Effect.Effect<typeof Visit.Type, DatabaseUnavailable>;
}

export class Visits extends Context.Service<Visits, VisitsService>()(
  "@savour/core/Visits"
) {}

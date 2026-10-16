import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseUnavailable } from "./database-health-contracts.js";

export interface DatabaseService {
  readonly selectOne: Effect.Effect<1, DatabaseUnavailable>;
}

export class Database extends Context.Service<Database, DatabaseService>()(
  "@savour/core/Database"
) {}

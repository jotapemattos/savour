import { implement } from "@savour/capability/implement";
import { Effect } from "effect";

import { healthContract } from "./health-contracts.js";

export {
  HealthReport,
  NextAction,
  healthContract,
} from "./health-contracts.js";

export const healthNextActions = [
  {
    description: "Read the OpenAPI document for every Savour capability.",
    href: "/openapi.json",
    rel: "describedby",
  },
  {
    description:
      "Check that the API can reach its Postgres database with `select 1`.",
    href: "/health/database",
    rel: "related",
  },
] as const;

export const health = implement(healthContract, () =>
  Effect.succeed({
    next: healthNextActions,
    service: "savour-api" as const,
    status: "ok" as const,
  })
);

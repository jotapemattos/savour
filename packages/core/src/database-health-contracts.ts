import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { NextAction } from "./health-contracts.js";

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()(
  "DatabaseUnavailable",
  {
    reason: Schema.Literals(["unreachable", "unexpected-answer"]),
  },
  {
    description: "DatabaseUnavailable",
    httpApiStatus: 503,
  }
) {}

export const DatabaseHealthReport = Schema.Struct({
  next: Schema.Array(NextAction),
  result: Schema.Literal(1),
  status: Schema.Literal("ok"),
});

export const databaseHealthContract = defineContract("databaseHealth", {
  annotations: { idempotent: true, openWorld: true, readOnly: true },
  description:
    "Run `select 1` against Savour's Postgres database and report whether it answered.",
  failure: DatabaseUnavailable,
  http: { method: "GET", path: "/health/database" },
  input: Schema.Struct({}),
  output: DatabaseHealthReport,
});

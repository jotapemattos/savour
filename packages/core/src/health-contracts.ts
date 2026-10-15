import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

export const NextAction = Schema.Struct({
  description: Schema.String,
  href: Schema.String,
  rel: Schema.String,
});

export const HealthReport = Schema.Struct({
  next: Schema.Array(NextAction),
  service: Schema.Literal("savour-api"),
  status: Schema.Literal("ok"),
});

export const healthContract = defineContract("health", {
  annotations: { idempotent: true, readOnly: true },
  description:
    "Report that the Savour API is up, with links to what an agent can do next.",
  failure: Schema.Never,
  http: { method: "GET", path: "/health" },
  input: Schema.Struct({}),
  output: HealthReport,
});

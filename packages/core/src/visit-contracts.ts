import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { DatabaseUnavailable } from "./database-health-contracts.js";
import { InvalidRating } from "./invalid-rating.js";
import { InvalidVisitDate } from "./invalid-visit-date.js";
import { PlaceId } from "./place-schemas.js";
import { Unauthenticated } from "./unauthenticated.js";
import { VisitNotFound } from "./visit-not-found.js";
import { Diary, LoggedVisit, VisitDeleted } from "./visit-schemas.js";

export const LogVisitInput = Schema.Struct({
  date: Schema.String.annotate({
    description: "The day of the visit as `YYYY-MM-DD`, never in the future.",
  }),
  dishes: Schema.optionalKey(Schema.Array(Schema.String)),
  lovedIt: Schema.optionalKey(Schema.Boolean),
  placeId: PlaceId,
  rating: Schema.optionalKey(
    Schema.Finite.annotate({ description: "0.5 to 5 in half-star steps." })
  ),
  review: Schema.optionalKey(Schema.String),
  revisit: Schema.optionalKey(Schema.Boolean),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const logVisitContract = defineContract("logVisit", {
  description:
    "Log a visit to a restaurant found with `GET /restaurants/search`, by its `placeId`, with the bearer token. Only the day is kept, never a time of day.",
  failure: Schema.Union([
    Unauthenticated,
    InvalidRating,
    InvalidVisitDate,
    DatabaseUnavailable,
  ]),
  http: { method: "POST", path: "/visits" },
  input: LogVisitInput,
  output: LoggedVisit,
});

export const EditVisitInput = Schema.Struct({
  date: Schema.optionalKey(
    Schema.String.annotate({
      description: "The day of the visit as `YYYY-MM-DD`, never in the future.",
    })
  ),
  dishes: Schema.optionalKey(Schema.Array(Schema.String)),
  id: Schema.String,
  lovedIt: Schema.optionalKey(Schema.Boolean),
  rating: Schema.optionalKey(
    Schema.NullOr(
      Schema.Finite.annotate({
        description: "0.5 to 5 in half-star steps, or `null` to clear it.",
      })
    )
  ),
  review: Schema.optionalKey(Schema.NullOr(Schema.String)),
  revisit: Schema.optionalKey(Schema.Boolean),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const editVisitContract = defineContract("editVisit", {
  annotations: { idempotent: true },
  description:
    "Change one of your own visits by its `id`, with the bearer token. Send only the fields that change; `null` clears the rating or the review.",
  failure: Schema.Union([
    Unauthenticated,
    VisitNotFound,
    InvalidRating,
    InvalidVisitDate,
    DatabaseUnavailable,
  ]),
  http: { method: "PATCH", path: "/visits/:id" },
  input: EditVisitInput,
  output: LoggedVisit,
});

export const deleteVisitContract = defineContract("deleteVisit", {
  annotations: { destructive: true, idempotent: true },
  description:
    "Delete one of your own visits by its `id`, with the bearer token. It can't be undone.",
  failure: Schema.Union([Unauthenticated, VisitNotFound, DatabaseUnavailable]),
  http: { method: "DELETE", path: "/visits/:id" },
  input: Schema.Struct({ id: Schema.String }),
  output: VisitDeleted,
});

export const diaryContract = defineContract("diary", {
  annotations: { idempotent: true, readOnly: true },
  description:
    "Read your own diary of visits with the bearer token, newest visit day first.",
  failure: Schema.Union([Unauthenticated, DatabaseUnavailable]),
  http: { method: "GET", path: "/diary" },
  input: Schema.Struct({}),
  output: Diary,
});

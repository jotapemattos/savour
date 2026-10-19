import { Schema } from "effect";

export class InvalidVisitDate extends Schema.TaggedError<InvalidVisitDate>()(
  "InvalidVisitDate",
  {
    date: Schema.String,
    reason: Schema.Literals(["not-a-day", "in-the-future"]),
  },
  { description: "InvalidVisitDate", httpApiStatus: 400 }
) {}

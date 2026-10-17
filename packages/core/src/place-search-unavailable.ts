import { Schema } from "effect";

export class PlaceSearchUnavailable extends Schema.TaggedError<PlaceSearchUnavailable>()(
  "PlaceSearchUnavailable",
  {
    reason: Schema.Literals(["unreachable", "refused", "unexpected-answer"]),
  },
  { description: "PlaceSearchUnavailable", httpApiStatus: 503 }
) {}

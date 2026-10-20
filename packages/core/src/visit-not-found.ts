import { Schema } from "effect";

export class VisitNotFound extends Schema.TaggedError<VisitNotFound>()(
  "VisitNotFound",
  { visitId: Schema.String },
  { description: "VisitNotFound", httpApiStatus: 404 }
) {}

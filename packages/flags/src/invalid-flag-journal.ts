import { Schema } from "effect";

export class InvalidFlagJournal extends Schema.TaggedError<InvalidFlagJournal>()(
  "InvalidFlagJournal",
  { key: Schema.String, repair: Schema.String }
) {}

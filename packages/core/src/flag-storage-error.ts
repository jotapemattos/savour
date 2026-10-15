import { Schema } from "effect";

export class FlagStorageError extends Schema.TaggedError<FlagStorageError>()(
  "FlagStorageError",
  {
    cause: Schema.Defect(),
    fallback: Schema.Json,
    name: Schema.String,
    operation: Schema.Literals(["read", "write", "audit", "listChanges"]),
    repair: Schema.String,
  }
) {}

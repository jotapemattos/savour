import { Context, Layer } from "effect";

import { FlagJournal } from "./flag-journal.js";
import { FlagWriter } from "./flag-writer.js";

export {
  FlagChangeSchema,
  PendingFlagChangeSchema,
  CompletedFlagChangeSchema,
  FlagPreviousValue,
  FlagChangesPage,
  ListFlagChangesInput,
} from "./flag-change.js";

export type {
  FlagChange,
  PendingFlagChange,
  CompletedFlagChange,
} from "./flag-change.js";

export { FlagJournal, validateFlagChangeQuery } from "./flag-journal.js";

export { FlagWriter } from "./flag-writer.js";

export const FlagActor = Context.Reference<string>("@savour/core/FlagActor", {
  defaultValue: () => "anonymous",
});

export const flagControlDefaults = Layer.merge(
  FlagWriter.disabled,
  FlagJournal.memory
);

import { defineContract } from "@savour/capability/contract";
import { Schema } from "effect";

import { FlagStorageError } from "./flag-storage-error.js";
import {
  FlagContextSchema,
  FlagMetadataSchema,
  InvalidFlagValue,
  UnknownFlag,
} from "./flags.js";

export const listFlagsContract = defineContract("listFlags", {
  annotations: { idempotent: true, readOnly: true },
  description: "List declared feature flags, their owners, and removal dates.",
  failure: Schema.Never,
  input: Schema.Struct({}),
  output: Schema.Array(FlagMetadataSchema),
});

export const getFlagContract = defineContract("getFlag", {
  annotations: { idempotent: true, readOnly: true },
  description: "Evaluate one declared feature flag for a subject.",
  failure: Schema.Union([InvalidFlagValue, UnknownFlag, FlagStorageError]),
  input: Schema.Struct({ context: FlagContextSchema, name: Schema.String }),
  output: Schema.Json,
});

export const SetFlagInput = Schema.Struct({
  name: Schema.String,
  value: Schema.Json,
});

export const setFlagContract = defineContract("setFlag", {
  annotations: { idempotent: false, readOnly: false },
  description:
    "Set a declared feature flag through an approved writable adapter.",
  failure: Schema.Union([UnknownFlag, InvalidFlagValue, FlagStorageError]),
  input: SetFlagInput,
  needsApproval: true,
  output: Schema.Void,
});

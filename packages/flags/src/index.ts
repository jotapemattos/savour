export { defineFlag, Flags } from "@savour/core/flags";

export type { Flag, FlagContext } from "@savour/core/flags";

export {
  flagCapabilities,
  getFlag,
  listFlags,
} from "@savour/core/flag-capabilities";

export {
  evaluateFlag,
  FlagRule,
  Percentage,
  subjectBucket,
} from "./evaluate.js";

export type { Rule } from "./evaluate.js";

export { checkFlagExpiry, ExpiredFlags } from "./expiry.js";

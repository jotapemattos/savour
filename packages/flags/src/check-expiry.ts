import { NodeRuntime } from "@effect/platform-node";
import { eventFlags } from "@savour/core/flags";

import { checkFlagExpiry } from "./expiry.js";

NodeRuntime.runMain(checkFlagExpiry(eventFlags));

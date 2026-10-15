import { Effect } from "effect";

export const loadInterestPages = Effect.promise(
  // @effect-diagnostics-next-line asyncFunction:off -- lint requires an awaiting async thunk around the dynamic import that splits the interest page templates out of the entry chunk
  async () => await import("../interest-pages.generated.js")
);

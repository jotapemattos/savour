import { FetchHttpClient } from "effect/http";

import type { ApiTransport } from "./savour-api";

export const browserTransport = (): ApiTransport => ({
  baseUrl: `${window.location.origin}/api`,
  layer: FetchHttpClient.layer,
});

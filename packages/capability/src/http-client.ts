import { HttpApiClient } from "effect/http-api";

import type { AnyContract } from "./contract.js";
import { httpApiOf } from "./to-http-api.js";

export const makeHttpApiClient = <
  const Contracts extends readonly [AnyContract, ...AnyContract[]],
>(
  id: string,
  contracts: Contracts,
  baseUrl: string
) => HttpApiClient.make(httpApiOf(id, contracts), { baseUrl });

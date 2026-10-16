import { healthContract } from "./health-contracts.js";

export {
  HealthReport,
  NextAction,
  healthContract,
} from "./health-contracts.js";

export const contracts = [healthContract] as const;

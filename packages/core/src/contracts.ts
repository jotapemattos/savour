import { databaseHealthContract } from "./database-health-contracts.js";
import { healthContract } from "./health-contracts.js";

export {
  DatabaseHealthReport,
  DatabaseUnavailable,
  databaseHealthContract,
} from "./database-health-contracts.js";

export {
  HealthReport,
  NextAction,
  healthContract,
} from "./health-contracts.js";

export const contracts = [healthContract, databaseHealthContract] as const;

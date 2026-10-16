import { health } from "./health-capabilities.js";

export { DatabaseUnavailable } from "./database-health-contracts.js";

export { Database, type DatabaseService } from "./database.js";

export {
  HealthReport,
  NextAction,
  health,
  healthContract,
  healthNextActions,
} from "./health-capabilities.js";

export const capabilities = [health] as const;

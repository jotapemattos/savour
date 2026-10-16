import { databaseHealth } from "./database-health-capabilities.js";
import { health } from "./health-capabilities.js";

export {
  DatabaseHealthReport,
  DatabaseUnavailable,
  databaseHealthContract,
} from "./database-health-contracts.js";

export {
  databaseHealth,
  databaseHealthNextActions,
} from "./database-health-capabilities.js";

export { Database, type DatabaseService } from "./database.js";

export {
  HealthReport,
  NextAction,
  health,
  healthContract,
  healthNextActions,
} from "./health-capabilities.js";

export const capabilities = [health, databaseHealth] as const;

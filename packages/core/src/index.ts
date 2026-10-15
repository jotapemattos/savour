import { flagCapabilities } from "./flag-capabilities.js";
import { health } from "./health-capabilities.js";

export { AppConfig } from "./app-config.js";

export { ConfigService } from "./config-service.js";

export {
  HealthReport,
  NextAction,
  health,
  healthContract,
  healthNextActions,
} from "./health-capabilities.js";

export const capabilities = [health, ...flagCapabilities] as const;

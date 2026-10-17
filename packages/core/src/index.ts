import {
  currentAccount,
  signIn,
  signOut,
  signUp,
} from "./account-capabilities.js";
import { databaseHealth } from "./database-health-capabilities.js";
import { health } from "./health-capabilities.js";

export {
  Account,
  AccountReport,
  SignedIn,
  SignedInAccount,
  SignedOut,
} from "./account-schemas.js";

export { signUpContract } from "./account-contracts.js";

export { EmailTaken } from "./email-taken.js";

export { HandleTaken } from "./handle-taken.js";

export { InvalidCredentials } from "./invalid-credentials.js";

export { Unauthenticated } from "./unauthenticated.js";

export {
  currentAccount,
  signIn,
  signOut,
  signUp,
  signedInNextActions,
  signedOutNextActions,
} from "./account-capabilities.js";

export { Accounts, type AccountsService } from "./accounts.js";

export { SessionCredential } from "./session-credential.js";

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

export const capabilities = [
  health,
  databaseHealth,
  signUp,
  signIn,
  signOut,
  currentAccount,
] as const;

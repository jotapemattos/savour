import {
  currentAccount,
  signIn,
  signOut,
  signUp,
} from "./account-capabilities.js";
import { databaseHealth } from "./database-health-capabilities.js";
import { health } from "./health-capabilities.js";
import { searchRestaurants } from "./restaurant-search-capabilities.js";

export {
  Account,
  AccountReport,
  SessionAccount,
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
  requireSessionToken,
  signIn,
  signOut,
  signUp,
  signedInNextActions,
  signedOutNextActions,
} from "./account-capabilities.js";

export { Accounts, type AccountsService } from "./accounts.js";

export { SessionCredential } from "./session-credential.js";

export { Place, PlaceId, PriceLevel } from "./place-schemas.js";

export { PlaceSearchUnavailable } from "./place-search-unavailable.js";

export { PlaceSearch, type PlaceSearchService } from "./place-search.js";

export {
  Restaurant,
  Restaurants,
  type RestaurantsService,
} from "./restaurants.js";

export {
  RestaurantSearchResults,
  searchRestaurantsContract,
} from "./restaurant-search-contracts.js";

export {
  addRestaurantAction,
  searchRestaurants,
} from "./restaurant-search-capabilities.js";

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
  Diary,
  LoggedVisit,
  Rating,
  Visit,
  VisitDate,
  currentRatingFrom,
  diaryOrder,
  type StoredVisit,
} from "./visit-schemas.js";

export { InvalidRating } from "./invalid-rating.js";

export { InvalidVisitDate } from "./invalid-visit-date.js";

export { Visits, type NewVisit, type VisitsService } from "./visits.js";

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
  searchRestaurants,
] as const;

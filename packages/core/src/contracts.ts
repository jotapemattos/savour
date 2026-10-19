import {
  currentAccountContract,
  signInContract,
  signOutContract,
  signUpContract,
} from "./account-contracts.js";
import { databaseHealthContract } from "./database-health-contracts.js";
import { healthContract } from "./health-contracts.js";
import { searchRestaurantsContract } from "./restaurant-search-contracts.js";

export { SignInInput, SignUpInput } from "./account-contracts.js";

export { Account } from "./account-schemas.js";

export {
  DatabaseHealthReport,
  DatabaseUnavailable,
  databaseHealthContract,
} from "./database-health-contracts.js";

export { Place, PriceLevel, SearchQuery } from "./place-schemas.js";

export { PlaceSearchUnavailable } from "./place-search-unavailable.js";

export { RestaurantSearchResults } from "./restaurant-search-contracts.js";

export {
  HealthReport,
  NextAction,
  healthContract,
} from "./health-contracts.js";

export const contracts = [
  healthContract,
  databaseHealthContract,
  signUpContract,
  signInContract,
  signOutContract,
  currentAccountContract,
  searchRestaurantsContract,
] as const;

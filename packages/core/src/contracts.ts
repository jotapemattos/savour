import {
  currentAccountContract,
  signInContract,
  signOutContract,
  signUpContract,
} from "./account-contracts.js";
import { databaseHealthContract } from "./database-health-contracts.js";
import { healthContract } from "./health-contracts.js";
import { searchRestaurantsContract } from "./restaurant-search-contracts.js";
import { diaryContract, logVisitContract } from "./visit-contracts.js";

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

export { InvalidRating } from "./invalid-rating.js";

export { InvalidVisitDate } from "./invalid-visit-date.js";

export { LogVisitInput } from "./visit-contracts.js";

export { Diary, DiaryEntry, Rating } from "./visit-schemas.js";

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
  logVisitContract,
  diaryContract,
] as const;

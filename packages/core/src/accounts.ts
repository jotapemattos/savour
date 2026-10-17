import { Context } from "effect";
import type { Effect } from "effect";

import type { SignInInput, SignUpInput } from "./account-contracts.js";
import type { Account, SignedInAccount } from "./account-schemas.js";
import type { EmailTaken } from "./email-taken.js";
import type { HandleTaken } from "./handle-taken.js";
import type { InvalidCredentials } from "./invalid-credentials.js";
import type { Unauthenticated } from "./unauthenticated.js";

export interface AccountsService {
  readonly accountForSession: (
    token: string
  ) => Effect.Effect<typeof Account.Type, Unauthenticated>;
  readonly signIn: (
    input: typeof SignInInput.Type
  ) => Effect.Effect<typeof SignedInAccount.Type, InvalidCredentials>;
  readonly signOut: (token: string) => Effect.Effect<void, Unauthenticated>;
  readonly signUp: (
    input: typeof SignUpInput.Type
  ) => Effect.Effect<typeof SignedInAccount.Type, HandleTaken | EmailTaken>;
}

export class Accounts extends Context.Service<Accounts, AccountsService>()(
  "@savour/core/Accounts"
) {}

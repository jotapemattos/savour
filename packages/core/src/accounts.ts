import { Context } from "effect";
import type { Effect } from "effect";

import type {
  SignInInput,
  SignInWithGoogleInput,
  SignUpInput,
} from "./account-contracts.js";
import type {
  SessionAccount,
  SignedInAccount,
  SignedInWithGoogle,
} from "./account-schemas.js";
import type { EmailTaken } from "./email-taken.js";
import type { HandleNeeded } from "./handle-needed.js";
import type { HandleTaken } from "./handle-taken.js";
import type { InvalidCredentials } from "./invalid-credentials.js";
import type { Unauthenticated } from "./unauthenticated.js";

export interface AccountsService {
  readonly accountForSession: (
    token: string
  ) => Effect.Effect<typeof SessionAccount.Type, Unauthenticated>;
  readonly signIn: (
    input: typeof SignInInput.Type
  ) => Effect.Effect<typeof SignedInAccount.Type, InvalidCredentials>;
  readonly signInWithGoogle: (
    input: typeof SignInWithGoogleInput.Type
  ) => Effect.Effect<
    typeof SignedInWithGoogle.Type,
    HandleNeeded | HandleTaken | InvalidCredentials
  >;
  readonly signOut: (token: string) => Effect.Effect<void, Unauthenticated>;
  readonly signUp: (
    input: typeof SignUpInput.Type
  ) => Effect.Effect<typeof SignedInAccount.Type, HandleTaken | EmailTaken>;
}

export class Accounts extends Context.Service<Accounts, AccountsService>()(
  "@savour/core/Accounts"
) {}

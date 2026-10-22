import { Context } from "effect";
import type { Effect } from "effect";

import type { TooManySignInAttempts } from "./too-many-sign-in-attempts.js";

export interface SignInThrottleService {
  readonly admit: (key: string) => Effect.Effect<void, TooManySignInAttempts>;
}

export class SignInThrottle extends Context.Service<
  SignInThrottle,
  SignInThrottleService
>()("@savour/core/SignInThrottle") {}

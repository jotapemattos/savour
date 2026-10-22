import { SignInThrottle, TooManySignInAttempts } from "@savour/core";
import { Effect, Layer } from "effect";

export const AdmittingSignInThrottle = Layer.succeed(SignInThrottle, {
  admit: () => Effect.void,
});

export const RefusingSignInThrottle = Layer.succeed(SignInThrottle, {
  admit: () => Effect.fail(new TooManySignInAttempts()),
});

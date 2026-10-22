import { SignInThrottle, TooManySignInAttempts } from "@savour/core";
import { RuntimeContext } from "alchemy";
import type { RateLimitClient } from "alchemy/Cloudflare";
import { Data, Effect, Layer, Option } from "effect";

class MissingRuntimeContext extends Data.TaggedError("MissingRuntimeContext")<{
  readonly adapter: "cloudflare-sign-in-throttle";
}> {}

const withRuntime = <A, E>(
  effect: Effect.Effect<A, E, RuntimeContext>
): Effect.Effect<A, E> =>
  Effect.flatMap(
    Effect.serviceOption(RuntimeContext),
    Option.match({
      onNone: () =>
        Effect.die(
          new MissingRuntimeContext({ adapter: "cloudflare-sign-in-throttle" })
        ),
      onSome: (runtime) =>
        Effect.provideService(effect, RuntimeContext, runtime),
    })
  );

export const cloudflareSignInThrottle = (rateLimit: RateLimitClient) =>
  Layer.succeed(
    SignInThrottle,
    SignInThrottle.of({
      admit: (key) =>
        rateLimit.limit({ key }).pipe(
          Effect.orDie,
          Effect.flatMap(({ success }) =>
            success ? Effect.void : Effect.fail(new TooManySignInAttempts())
          ),
          withRuntime
        ),
    })
  );

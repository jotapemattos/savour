import { describe, expect, it } from "@effect/vitest";
import { SignInThrottle, TooManySignInAttempts } from "@savour/core";
import { RateLimitError } from "alchemy/Cloudflare";
import type { RateLimitClient } from "alchemy/Cloudflare";
import { Cause, Effect, Exit } from "effect";

import { cloudflareSignInThrottle } from "../src/cloudflare-sign-in-throttle.js";
import { withTestRuntime } from "./fixtures/memory-accounts.js";

const bindingAnswering = (
  answer: (key: string) => Effect.Effect<{ success: boolean }, RateLimitError>
) => {
  const keys: string[] = [];

  const client: RateLimitClient = {
    limit: ({ key }) =>
      Effect.sync(() => {
        keys.push(key);
      }).pipe(Effect.andThen(answer(key))),
    raw: Effect.die("the throttle must go through limit"),
  };

  return {
    keys,
    layer: cloudflareSignInThrottle(client).pipe(withTestRuntime),
  };
};

const admit = (key: string) =>
  SignInThrottle.use((throttle) => throttle.admit(key));

describe("cloudflare sign-in throttle", () => {
  it.effect("admits a key the rate limit lets through", () =>
    Effect.gen(function* admitsUnderLimit() {
      const binding = bindingAnswering(() => Effect.succeed({ success: true }));

      const exit = yield* admit("key-ana").pipe(
        Effect.provide(binding.layer),
        Effect.exit
      );

      expect(exit).toStrictEqual(Exit.void);
      expect(binding.keys).toStrictEqual(["key-ana"]);
    })
  );

  it.effect("refuses with TooManySignInAttempts over the limit", () =>
    Effect.gen(function* refusesOverLimit() {
      const binding = bindingAnswering(() =>
        Effect.succeed({ success: false })
      );

      const exit = yield* admit("key-ana").pipe(
        Effect.provide(binding.layer),
        Effect.exit
      );

      expect(exit).toStrictEqual(Exit.fail(new TooManySignInAttempts()));
    })
  );

  it.effect("crashes when the rate limit binding breaks", () =>
    Effect.gen(function* crashesOnBindingError() {
      const binding = bindingAnswering(() =>
        Effect.fail(
          new RateLimitError({ cause: null, message: "binding unavailable" })
        )
      );

      const exit = yield* admit("key-ana").pipe(
        Effect.provide(binding.layer),
        Effect.exit
      );

      expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
      expect(Exit.isFailure(exit) && Cause.hasFails(exit.cause)).toBe(false);
    })
  );
});

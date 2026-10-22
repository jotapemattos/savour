import type { SessionRefusal } from "#/client/account-session";
import type { ApiStatus } from "#/client/savour-api";

export const en = {
  home: {
    diary: "Your diary",
    findRestaurant: "Find a restaurant",
    signOut: "Sign out",
  },
  session: {
    accountUnreachable: "Savour couldn’t load your account.",
    invalidFields: "Check the fields above and try again.",
    refusals: {
      EmailTaken: "That email already has an account. Sign in instead.",
      HandleTaken: "That handle is taken. Try another one.",
      InvalidCredentials:
        "That email and password don’t match. Check both and try again.",
    } satisfies Record<SessionRefusal, string>,
    retry: "Try again",
    unreachable:
      "Savour couldn’t be reached. Check your connection and try again.",
  },
  shell: {
    api: "API",
    apiStatus: {
      ok: "ok",
      unavailable: "unavailable",
    } satisfies Record<ApiStatus, string>,
    emptyLog: "Restaurants you log will show up here.",
    name: "Savour",
  },
  signIn: {
    alternative: "Create an account",
    alternativePrompt: "New to Savour?",
    email: "Email",
    password: "Password",
    pending: "Signing in…",
    submit: "Sign in",
    title: "Sign in",
  },
  signUp: {
    alternative: "Sign in",
    alternativePrompt: "Already have an account?",
    email: "Email",
    handle: "Handle",
    handleHint:
      "3–20 lowercase letters, numbers or underscores. People find you by it.",
    password: "Password",
    passwordHint: "At least 8 characters.",
    pending: "Creating account…",
    submit: "Create account",
    title: "Create your account",
  },
  titles: {
    app: "Savour",
    signIn: "Sign in · Savour",
    signUp: "Create your account · Savour",
  },
};

export type Messages = typeof en;

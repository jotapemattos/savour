import { SignUpInput } from "@savour/core/contracts";

import { Field } from "./field";
import { SessionForm } from "./session-form";
import {
  changedTo,
  decodedWith,
  failureMessage,
  refusalMessage,
  useSessionChange,
} from "./use-session-change";

const signUpWith = decodedWith(
  SignUpInput,
  // oxlint-disable-next-line typescript/promise-function-async -- Session changes are native Promises.
  (session, input: typeof SignUpInput.Type) => session.signUp(input)
);

export const SignUpForm = () => {
  const signUp = useSessionChange(signUpWith);

  return (
    <SessionForm
      alternative={{
        label: "Sign in",
        prompt: "Already have an account?",
        to: "/sign-in",
      }}
      failure={signUp.isError ? failureMessage(signUp.error) : undefined}
      onSubmit={signUp.mutate}
      pending={signUp.isPending}
      pendingLabel="Creating account…"
      signedIn={changedTo(signUp.data, "SignedIn")}
      submitLabel="Create account"
      title="Create your account"
    >
      <Field
        autoComplete="email"
        error={refusalMessage(signUp.data, "EmailTaken")}
        id="email"
        inputMode="email"
        label="Email"
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      <Field
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect="off"
        error={refusalMessage(signUp.data, "HandleTaken")}
        hint="3–20 lowercase letters, numbers or underscores. People find you by it."
        id="handle"
        label="Handle"
        maxLength={20}
        minLength={3}
        name="handle"
        pattern="[a-z0-9_]{3,20}"
        required
        spellCheck={false}
      />
      <Field
        autoComplete="new-password"
        hint="At least 8 characters."
        id="password"
        label="Password"
        maxLength={128}
        minLength={8}
        name="password"
        required
        type="password"
      />
    </SessionForm>
  );
};

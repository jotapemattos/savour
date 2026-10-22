import { SignInInput } from "@savour/core/contracts";

import { Field } from "./field";
import { SessionForm } from "./session-form";
import {
  changedTo,
  decodedWith,
  failureMessage,
  refusalMessage,
  useSessionChange,
} from "./use-session-change";

const signInWith = decodedWith(
  SignInInput,
  // oxlint-disable-next-line typescript/promise-function-async -- Session changes are native Promises.
  (session, input: typeof SignInInput.Type) => session.signIn(input)
);

export const SignInForm = () => {
  const signIn = useSessionChange(signInWith);

  return (
    <SessionForm
      alternative={{
        label: "Create an account",
        prompt: "New to Savour?",
        to: "/sign-up",
      }}
      failure={
        signIn.isError
          ? failureMessage(signIn.error)
          : (refusalMessage(signIn.data, "InvalidCredentials") ??
            refusalMessage(signIn.data, "TooManySignInAttempts"))
      }
      onSubmit={signIn.mutate}
      pending={signIn.isPending}
      pendingLabel="Signing in…"
      signedIn={changedTo(signIn.data, "SignedIn")}
      submitLabel="Sign in"
      title="Sign in"
    >
      <Field
        autoComplete="email"
        id="email"
        inputMode="email"
        label="Email"
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      <Field
        autoComplete="current-password"
        id="password"
        label="Password"
        name="password"
        required
        type="password"
      />
    </SessionForm>
  );
};

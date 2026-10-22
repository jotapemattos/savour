import { SignInInput } from "@savour/core/contracts";

import { useMessages } from "#/i18n/messages";

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
  const { t } = useMessages();

  return (
    <SessionForm
      alternative={{
        label: t.signIn.alternative,
        prompt: t.signIn.alternativePrompt,
        to: "/sign-up",
      }}
      failure={
        signIn.isError
          ? failureMessage(t.session, signIn.error)
          : refusalMessage(t.session, signIn.data, "InvalidCredentials")
      }
      onSubmit={signIn.mutate}
      pending={signIn.isPending}
      pendingLabel={t.signIn.pending}
      signedIn={changedTo(signIn.data, "SignedIn")}
      submitLabel={t.signIn.submit}
      title={t.signIn.title}
    >
      <Field
        autoComplete="email"
        id="email"
        inputMode="email"
        label={t.signIn.email}
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      <Field
        autoComplete="current-password"
        id="password"
        label={t.signIn.password}
        name="password"
        required
        type="password"
      />
    </SessionForm>
  );
};

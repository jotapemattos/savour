import { SignUpInput } from "@savour/core/contracts";

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

const signUpWith = decodedWith(
  SignUpInput,
  // oxlint-disable-next-line typescript/promise-function-async -- Session changes are native Promises.
  (session, input: typeof SignUpInput.Type) => session.signUp(input)
);

export const SignUpForm = () => {
  const signUp = useSessionChange(signUpWith);
  const { t } = useMessages();

  return (
    <SessionForm
      alternative={{
        label: t.signUp.alternative,
        prompt: t.signUp.alternativePrompt,
        to: "/sign-in",
      }}
      failure={
        signUp.isError ? failureMessage(t.session, signUp.error) : undefined
      }
      onSubmit={signUp.mutate}
      pending={signUp.isPending}
      pendingLabel={t.signUp.pending}
      signedIn={changedTo(signUp.data, "SignedIn")}
      submitLabel={t.signUp.submit}
      title={t.signUp.title}
    >
      <Field
        autoComplete="email"
        error={refusalMessage(t.session, signUp.data, "EmailTaken")}
        id="email"
        inputMode="email"
        label={t.signUp.email}
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      <Field
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect="off"
        error={refusalMessage(t.session, signUp.data, "HandleTaken")}
        hint={t.signUp.handleHint}
        id="handle"
        label={t.signUp.handle}
        maxLength={20}
        minLength={3}
        name="handle"
        pattern="[a-z0-9_]{3,20}"
        required
        spellCheck={false}
      />
      <Field
        autoComplete="new-password"
        hint={t.signUp.passwordHint}
        id="password"
        label={t.signUp.password}
        maxLength={128}
        minLength={8}
        name="password"
        required
        type="password"
      />
    </SessionForm>
  );
};

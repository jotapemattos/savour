import { createFileRoute } from "@tanstack/react-router";

import { SignUpForm } from "#/features/accounts/sign-up-form";
import { catalogs } from "#/i18n/messages";

export const Route = createFileRoute("/sign-up")({
  component: SignUpForm,
  head: ({ match }) => ({
    meta: [{ title: catalogs[match.context.locale].titles.signUp }],
  }),
});

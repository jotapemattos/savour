import { createFileRoute } from "@tanstack/react-router";

import { SignInForm } from "#/features/accounts/sign-in-form";
import { catalogs } from "#/i18n/messages";

export const Route = createFileRoute("/sign-in")({
  component: SignInForm,
  head: ({ match }) => ({
    meta: [{ title: catalogs[match.context.locale].titles.signIn }],
  }),
});

import { createFileRoute } from "@tanstack/react-router";

import { SignInForm } from "#/features/accounts/sign-in-form";

export const Route = createFileRoute("/sign-in")({
  component: SignInForm,
  head: () => ({ meta: [{ title: "Sign in · Savour" }] }),
});

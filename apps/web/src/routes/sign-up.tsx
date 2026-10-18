import { createFileRoute } from "@tanstack/react-router";

import { SignUpForm } from "#/features/accounts/sign-up-form";

export const Route = createFileRoute("/sign-up")({
  component: SignUpForm,
  head: () => ({ meta: [{ title: "Create your account · Savour" }] }),
});

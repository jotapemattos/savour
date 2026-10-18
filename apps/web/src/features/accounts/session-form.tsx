import { Link, Navigate } from "@tanstack/react-router";
import type { ReactNode, SubmitEvent } from "react";

import { Button } from "#/components/ui/button";

export const SessionForm = (props: {
  readonly alternative: {
    readonly label: string;
    readonly prompt: string;
    readonly to: "/sign-in" | "/sign-up";
  };
  readonly children: ReactNode;
  readonly failure: string | undefined;
  readonly onSubmit: (form: FormData) => void;
  readonly pending: boolean;
  readonly pendingLabel: string;
  readonly signedIn: boolean;
  readonly submitLabel: string;
  readonly title: string;
}) => {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!props.pending) {
      props.onSubmit(new FormData(event.currentTarget));
    }
  };

  if (props.signedIn) {
    return <Navigate to="/" />;
  }

  return (
    <section aria-labelledby="session-title" className="flex flex-col gap-6">
      <h2
        className="text-2xl font-semibold tracking-tight text-balance"
        id="session-title"
      >
        {props.title}
      </h2>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        {props.children}
        <p
          className="text-destructive text-sm text-pretty empty:hidden"
          role="alert"
        >
          {props.failure}
        </p>
        <Button aria-disabled={props.pending} type="submit">
          {props.pending ? props.pendingLabel : props.submitLabel}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        {props.alternative.prompt}{" "}
        <Link
          className="text-foreground font-medium underline underline-offset-4"
          to={props.alternative.to}
        >
          {props.alternative.label}
        </Link>
      </p>
    </section>
  );
};

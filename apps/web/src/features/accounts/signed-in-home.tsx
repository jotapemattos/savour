import { Link, Navigate } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import { EmptyLog } from "#/features/shell/empty-log";
import { useMessages } from "#/i18n/messages";

import {
  changedTo,
  failureMessage,
  useSessionChange,
} from "./use-session-change";

export const SignedInHome = (props: { readonly handle: string }) => {
  const signOut = useSessionChange(
    // oxlint-disable-next-line typescript/promise-function-async -- Session changes are native Promises.
    (session) => session.signOut()
  );

  const { t } = useMessages();

  if (changedTo(signOut.data, "SignedOut")) {
    return <Navigate to="/sign-in" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium" title={`@${props.handle}`}>
          @{props.handle}
        </p>
        <Button
          aria-disabled={signOut.isPending}
          onClick={() => {
            if (!signOut.isPending) {
              signOut.mutate();
            }
          }}
          type="button"
          variant="quiet"
        >
          {t.home.signOut}
        </Button>
      </div>
      <p className="text-destructive text-sm empty:hidden" role="alert">
        {signOut.isError ? failureMessage(t.session, signOut.error) : undefined}
      </p>
      <EmptyLog />
      <Link
        className="bg-primary text-primary-foreground focus-visible:outline-primary inline-flex h-11 items-center justify-center rounded-lg px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-90"
        to="/search"
      >
        {t.home.findRestaurant}
      </Link>
      <Link
        className="text-muted-foreground hover:text-foreground focus-visible:outline-primary active:bg-muted inline-flex h-10 items-center justify-center rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        to="/diary"
      >
        {t.home.diary}
      </Link>
    </div>
  );
};

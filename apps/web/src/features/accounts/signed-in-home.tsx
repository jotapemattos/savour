import { Navigate } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import { EmptyLog } from "#/features/shell/empty-log";

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
          Sign out
        </Button>
      </div>
      <p className="text-destructive text-sm empty:hidden" role="alert">
        {signOut.isError ? failureMessage(signOut.error) : undefined}
      </p>
      <EmptyLog />
    </div>
  );
};

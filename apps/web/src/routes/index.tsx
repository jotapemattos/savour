import {
  Navigate,
  createFileRoute,
  useLoaderData,
} from "@tanstack/react-router";
import { Match } from "effect";

import { viewerQuery } from "#/client/account-session";
import { AccountUnreachableNotice } from "#/features/accounts/account-unreachable-notice";
import { SignedInHome } from "#/features/accounts/signed-in-home";

const Home = () =>
  Match.value(useLoaderData({ from: "/" })).pipe(
    Match.tag("SignedIn", (viewer) => (
      <SignedInHome handle={viewer.account.handle} />
    )),
    Match.tag("SignedOut", () => <Navigate replace to="/sign-in" />),
    Match.tag("AccountUnreachable", () => <AccountUnreachableNotice />),
    Match.exhaustive
  );

export const Route = createFileRoute("/")({
  component: Home,
  // oxlint-disable-next-line typescript/promise-function-async -- TanStack Router awaits loaders as native Promises.
  loader: ({ context }) =>
    context.queryClient.query({
      ...viewerQuery(context.api),
      staleTime: "static",
    }),
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { SessionGateway } from "#/client/account-session";
import type { ApiTransport } from "#/client/savour-api";

import { routeTree } from "./routeTree.gen";

export const createSavourRouter = (
  api: ApiTransport,
  session: SessionGateway
) => {
  const queryClient = new QueryClient();

  return createRouter({
    Wrap: (props: { readonly children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    ),
    context: { api, queryClient, session },
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
  });
};

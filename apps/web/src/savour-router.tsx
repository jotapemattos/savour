import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import type { ApiTransport } from "#/client/savour-api";

import { routeTree } from "./routeTree.gen";

export const createSavourRouter = (api: ApiTransport) =>
  createRouter({
    context: { api, queryClient: new QueryClient() },
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
  });

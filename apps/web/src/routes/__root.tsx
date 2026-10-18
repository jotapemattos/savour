import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useLoaderData,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { SessionGateway } from "#/client/account-session";
import { apiStatusQuery } from "#/client/savour-api";
import type { ApiTransport } from "#/client/savour-api";
import { SavourShell } from "#/features/shell/savour-shell";

import appCss from "#/styles.css?url";

export interface RouterContext {
  readonly api: ApiTransport;
  readonly queryClient: QueryClient;
  readonly session: SessionGateway;
}

const RootDocument = (props: { readonly children: ReactNode }) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      {props.children}
      <Scripts />
    </body>
  </html>
);

const RootLayout = () => (
  <SavourShell apiStatus={useLoaderData({ from: "__root__" })}>
    <Outlet />
  </SavourShell>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  head: () => ({
    links: [{ href: appCss, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      {
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
        name: "viewport",
      },
      {
        content: "#fdfcfa",
        media: "(prefers-color-scheme: light)",
        name: "theme-color",
      },
      {
        content: "#1c1a18",
        media: "(prefers-color-scheme: dark)",
        name: "theme-color",
      },
      { content: "light dark", name: "color-scheme" },
      { title: "Savour" },
    ],
  }),
  // oxlint-disable-next-line typescript/promise-function-async -- TanStack Router awaits loaders as native Promises.
  loader: ({ context }) =>
    context.queryClient.query({
      ...apiStatusQuery(context.api),
      staleTime: "static",
    }),
  shellComponent: RootDocument,
});

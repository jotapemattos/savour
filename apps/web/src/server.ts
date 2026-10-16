import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { Effect } from "effect";

import { apiFetch } from "./server/api-binding";

const API_PREFIX = "/api";

const isApiRequest = (url: URL) =>
  url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`);

const toApiRequest = (request: Request, url: URL) => {
  const target = new URL(url);
  target.pathname = url.pathname.slice(API_PREFIX.length) || "/";

  return new Request(target, request);
};

const renderFailed = (route: string, status: number) =>
  Effect.logError("render.failed").pipe(Effect.annotateLogs({ route, status }));

const render = (request: Request, route: string) =>
  Effect.tryPromise(
    // oxlint-disable-next-line typescript/promise-function-async -- TanStack Start's request handler is a native Promise boundary.
    () => Promise.resolve(handler.fetch(request))
  ).pipe(
    Effect.tap((response) =>
      response.status >= 500
        ? renderFailed(route, response.status)
        : Effect.void
    ),
    Effect.tapError(() => renderFailed(route, 500))
  );

export default createServerEntry({
  // oxlint-disable-next-line typescript/promise-function-async -- The Worker fetch handler is a native Promise boundary.
  fetch: (request) => {
    const url = new URL(request.url);

    return isApiRequest(url)
      ? apiFetch(toApiRequest(request, url))
      : Effect.runPromise(render(request, url.pathname));
  },
});

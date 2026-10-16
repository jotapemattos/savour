// @effect-diagnostics asyncFunction:off nodeBuiltinImport:off -- The fake API is a plain Worker that simulates upstream I/O with native Promises.
import { setTimeout as sleep } from "node:timers/promises";

const SLOW_UPSTREAM_MS = 120_000;

const stall = async () => {
  await sleep(SLOW_UPSTREAM_MS);

  return new Response("late");
};

const echo = async (request: Request) => {
  const body = await request.text();
  const url = new URL(request.url);

  return Response.json({
    body,
    method: request.method,
    path: url.pathname,
    search: url.search,
  });
};

export default {
  fetch: async (request: Request, env: { readonly MODE: string }) => {
    if (env.MODE === "hang") {
      return await stall();
    }

    if (env.MODE === "broken") {
      return new Response("<html>oops", { status: 500 });
    }

    return await echo(request);
  },
};
